import joplin from "api";
import * as child_process from "child_process";
import { Dependencies } from "./dependencies";
import { WAKATIME_API_KEY } from "./constants";
import { Logger } from "./loggers/logger";
import { quote, validateKey } from "./utilities";
import { Analytics } from "./analytics";

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

  public initialize(): void {
    this.dependencies = new Dependencies(this.logger, this.analytics);
    this.hasApiKey(async (hasApiKey: boolean) => {
      if (hasApiKey) {
        this.logger.debug("Setting up event listeners");
        var page = 1;
        var has_more = true;
        while (has_more) {
          let userNotes = await joplin.data.get(["notes"], {
            fields: ["title", "id"],
            page,
          });
          userNotes.items.forEach((note) => {
            this.notes[note.id] = note.title;
          });
          has_more = userNotes.has_more;
          page += 1;
        }
        this.setupEventListeners();
      }
    });
  }

  private hasApiKey(callback: (arg0: boolean) => void): void {
    joplin.settings
      .value(WAKATIME_API_KEY)
      .then((apiKey: string) => callback(validateKey(apiKey) === ""))
      .catch((err) => {
        this.logger.error(`Error reading api key: ${err}`);
        callback(false);
      });
  }

  private setupEventListeners(): void {
    joplin.workspace.onNoteChange(async (handler) => {
      this.onChange();
    });

    joplin.workspace.onNoteSelectionChange((event) => {
      this.onChange();
    });

    // Missing on save. Where to get it in joplin?
  }

  private onChange(): void {
    this.onEvent(false);
  }

  private onSave(): void {
    this.onEvent(true);
  }

  private async onEvent(isWrite: boolean) {
    let note = await joplin.workspace.selectedNote();
    if (this.notes[note.id] != note.title) {
      // Title is being changed
      this.notes[note.id] = note.title;
      return;
    }

    let file: string = note.title;
    let time: number = Date.now();
    if (isWrite || this.enoughTimePassed(time) || this.lastFile !== file) {
      this.sendHeartbeat(file, time, isWrite);
      this.lastFile = file;
      this.lastHeartbeat = time;
    }
  }

  private sendHeartbeat(file: string, time: number, isWrite: boolean): void {
    this._sendHeartbeat(file, time, isWrite);
  }

  private async _sendHeartbeat(file: string, time: number, isWrite: boolean) {
    if (
      !this.dependencies.isCliInstalled() ||
      (isWrite && this.isDuplicateHeartbeat(file, time))
    ) {
      return;
    }
    let folder = await joplin.workspace.selectedFolder();
    let apiKey: string = await joplin.settings.value(WAKATIME_API_KEY);

    let user_agent = this.agentName;
    let args = [
      "--entity",
      file,
      "--plugin",
      quote(user_agent),
      "--entity-type",
      "app",
      "--hide-branch-names",
      "--key",
      quote(apiKey),
    ];

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
          if (stderr && stderr.toString() != "")
            this.logger.error(stderr.toString());
          if (stdout && stdout.toString() != "")
            this.logger.error(stdout.toString());
          this.logger.error(error.toString());
        }
        this.logger.debug("heartbeat sent");
      }
    );
    proc.on("close", (code, _signal) => {
      if (code == 0) {
        let today = new Date();
        this.logger.debug(`last heartbeat sent ${this.formatDate(today)}`);
      } else if (code == 102) {
        this.logger.warn(
          `Api eror (102); Check your log file for more details`
        );
      } else if (code == 103) {
        let error_msg = `Config parsing error (103); Check your log file for more details`;
        this.logger.error(error_msg);
      } else if (code == 104) {
        let error_msg =
          "Invalid Api Key (104); Make sure your Api Key is correct!";
        this.logger.error(error_msg);
      } else {
        let error_msg = `Unknown Error (${code}); Check your log file for more details`;
        this.logger.error(error_msg);
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
