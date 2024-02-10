import joplin from "api";
import * as child_process from "child_process";
import { Dependencies } from "./dependencies";
import { JoplinEventType, WAKATIME_API_KEY } from "./constants";
import { Logger } from "./loggers/logger";
import { quote, validAPIKey } from "./utilities";
import { Analytics } from "./analytics";
import Config from "./config";

interface FileSelection {
  lastHeartbeatAt: number;
}

interface FileSelectionMap {
  [key: string]: FileSelection;
}

export class WakaTime {
  private agentName = "joplin";

  private lastFile: string;
  private lastHeartbeat: number = 0;
  private dependencies: Dependencies;
  private analytics: Analytics;
  private logger: Logger;
  private dedupe: FileSelectionMap = {};
  private notes: Record<string, string> = {};

  constructor(logger: Logger, analytics: Analytics) {
    this.logger = logger;
    this.analytics = analytics;
  }

  public async initialize(): Promise<void> {
    this.dependencies = new Dependencies(this.logger, this.analytics);
    if (await this.hasApiKey()) {
      this.logger.debug("Setting up event listeners");
      await this.populateNotes();
      await this.setupEventListeners();
    }
  }

  private async populateNotes(): Promise<void> {
    var page = 1;
    var has_more = true;
    while (has_more) {
      let userNotes = await joplin.data.get(["notes"], {
        fields: ["title", "id"],
        page,
      });
      userNotes.items.forEach(
        (note: { id: string | number; title: string }) => {
          this.notes[note.id] = note.title;
        }
      );
      has_more = userNotes.has_more;
      page += 1;
    }
  }

  private async hasApiKey(): Promise<boolean> {
    const apiKey = await joplin.settings.value(WAKATIME_API_KEY);
    return Promise.resolve(validAPIKey(apiKey));
  }

  private async setupEventListeners(): Promise<void> {
    await joplin.workspace.onNoteChange(async (handler) => {
      if (handler.event.valueOf() == JoplinEventType.CREATED.valueOf()) {
        const note = await joplin.workspace.selectedNote();
        this.logger.debug(`New note ${note.id} created. Adding to notes.`);
        this.notes[note.id] = "";
      } else {
        await this.onChange();
      }
    });

    await joplin.workspace.onNoteSelectionChange(async (_: any) => {
      await this.onChange();
    });

    // Missing on save. Where to get it in joplin?
  }

  private onChange(): Promise<void> {
    return this.onEvent(false);
  }

  private onSave(): Promise<void> {
    return this.onEvent(true);
  }

  private async onEvent(isWrite: boolean): Promise<void> {
    let note = await joplin.workspace.selectedNote();
    if (this.notes[note.id] != note.title) {
      // Title is being changed
      this.notes[note.id] = note.title;
      return;
    }

    let file: string = note.title;
    let time: number = Date.now();
    if (isWrite || this.enoughTimePassed(time) || this.lastFile !== file) {
      await this.sendHeartbeat(file, time, isWrite);
      this.lastFile = file;
      this.lastHeartbeat = time;
    }
  }

  private async sendHeartbeat(
    file: string,
    time: number,
    isWrite: boolean
  ): Promise<void> {
    if (
      !this.dependencies.isCliInstalled() ||
      (isWrite && this.isDuplicateHeartbeat(file, time))
    ) {
      return;
    }
    let folder = await joplin.workspace.selectedFolder();
    let apiKey: string = await joplin.settings.value(WAKATIME_API_KEY);

    var versionNumber = "2.8.8"; //Assumption until new version released with versionInfo API support.

    try {
      versionNumber = (await joplin.versionInfo()).version;
    } catch {
      this.logger.info("Version API not available.");
    }

    let user_agent = `${this.agentName}/${versionNumber} joplin-wakatime/${Config.pluginVersion}`;
    let args = [
      "--entity",
      quote(file),
      "--plugin",
      quote(user_agent),
      "--entity-type",
      "app",
      "--category",
      "designing", // TODO: Replace with a different category once the cli allows.
    ];

    if (apiKey) {
      args.push("--key", quote(apiKey));
    }

    let project = folder.title;
    if (project) {
      args.push("--project", quote(project));
    }

    if (isWrite) {
      args.push("--write");
    }

    const binary = this.dependencies.getCliLocation();
    this.logger.debug(
      `Sending heartbeat: ${this.formatArguments(binary, args)}`
    );

    const options = this.dependencies.buildOptions();
    let proc = child_process.execFile(
      binary,
      args,
      options,
      (error, stdout, stderr) => {
        if (error != null) {
          if (stderr && stderr.toString() != "") {
            this.logger.error(this.obfuscateKeyInError(stderr.toString()));
          }

          if (stdout && stdout.toString() != "") {
            this.logger.error(this.obfuscateKeyInError(stdout.toString()));
          }

          this.logger.error(this.obfuscateKeyInError(error.toString()));
        }
      }
    );

    proc.on("close", (code, _signal) => {
      if (code == 0) {
        let today = new Date();
        this.logger.debug(`last heartbeat sent ${this.formatDate(today)}`);
      } else if (code == 102) {
        this.logger.warn(
          "Api eror (102); Check your log file for more details"
        );
      } else if (code == 103) {
        this.logger.error(
          "Config parsing error (103); Check your log file for more details"
        );
      } else if (code == 104) {
        this.logger.error(
          "Invalid Api Key (104); Make sure your Api Key is correct!"
        );
      } else {
        this.logger.error(
          `Unknown Error (${code}); Check your log file for more details`
        );
      }
    });
  }

  private formatDate(date: Date): String {
    let months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    let ampm = "AM";
    let hour = date.getHours();
    if (hour > 11) {
      ampm = "PM";
      hour = hour - 12;
    }
    if (hour == 0) {
      hour = 12;
    }
    let minute = date.getMinutes();
    return `${
      months[date.getMonth()]
    } ${date.getDate()}, ${date.getFullYear()} ${hour}:${
      minute < 10 ? `0${minute}` : minute
    } ${ampm}`;
  }

  private enoughTimePassed(time: number): boolean {
    return this.lastHeartbeat + 120000 < time;
  }

  private isDuplicateHeartbeat(file: string, time: number): boolean {
    let duplicate = false;
    let minutes = 30;
    let milliseconds = minutes * 60000;
    if (
      this.dedupe[file] &&
      this.dedupe[file].lastHeartbeatAt + milliseconds < time
    ) {
      duplicate = true;
    }
    this.dedupe[file] = {
      lastHeartbeatAt: time,
    };
    return duplicate;
  }

  private obfuscateKeyInError(error: string): string {
    var parts = error.split(" ");
    for (let index = 1; index < parts.length; index++) {
      if (parts[index - 1] === "--key") {
        parts[index] = this.obfuscateKey(parts[index]);
      }
    }

    return parts.join(" ");
  }

  private obfuscateKey(key: string): string {
    let newKey = "";
    if (key) {
      newKey = key;
      if (key.length > 4)
        newKey =
          "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX" + key.substring(key.length - 4);
    }
    return newKey;
  }

  private wrapArg(arg: string): string {
    if (arg.indexOf(" ") > -1) return '"' + arg.replace(/"/g, '\\"') + '"';
    return arg;
  }

  private formatArguments(binary: string, args: string[]): string {
    let clone = args.slice(0);
    clone.unshift(this.wrapArg(binary));
    let newCmds: string[] = [];
    let lastCmd = "";
    for (let i = 0; i < clone.length; i++) {
      if (lastCmd == "--key")
        newCmds.push(this.wrapArg(this.obfuscateKey(clone[i])));
      else newCmds.push(this.wrapArg(clone[i]));
      lastCmd = clone[i];
    }
    return newCmds.join(" ");
  }
}
