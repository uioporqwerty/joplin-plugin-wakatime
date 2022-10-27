import joplin from "api";
import * as os from "os";
import * as path from "path";
import * as JSZip from "jszip";

import { ConsoleLogger } from "./loggers/console-logger";
const fs = joplin.require("fs-extra");

export class Dependencies {
  private logger: ConsoleLogger;
  private resourcesLocation?: string = undefined;
  private githubDownloadPrefix =
    "https://github.com/wakatime/wakatime-cli/releases/download";
  private githubReleasesStableUrl =
    "https://api.github.com/repos/wakatime/wakatime-cli/releases/latest";
  private latestCliVersion: string = "";

  constructor(logger: ConsoleLogger) {
    this.logger = logger;
  }

  checkAndInstall(callback?: () => void): void {
    this.checkAndInstallCli(callback);
  }

  private getResourcesLocation() {
    if (this.resourcesLocation) return this.resourcesLocation;

    const folder = path.join(Dependencies.getHomeDirectory(), ".wakatime");
    try {
      fs.mkdirSync(folder, { recursive: true });
      this.resourcesLocation = folder;
    } catch (e) {
      this.logger.errorException(e);
    }
    return this.resourcesLocation;
  }

  static getHomeDirectory(): string {
    let home = process.env.WAKATIME_HOME;
    if (home && home.trim() && fs.existsSync(home.trim())) return home.trim();

    return (
      process.env[Dependencies.isWindows() ? "USERPROFILE" : "HOME"] ||
      process.cwd()
    );
  }

  getCliLocation(): string {
    const ext = Dependencies.isWindows() ? ".exe" : "";
    let osname = os.platform() as string;
    if (osname == "win32") osname = "windows";
    const arch = this.architecture();
    return path.join(
      this.getResourcesLocation(),
      `wakatime-cli-${osname}-${arch}${ext}`
    );
  }

  isCliInstalled(): boolean {
    return fs.existsSync(this.getCliLocation());
  }

  static isWindows(): boolean {
    return os.platform() === "win32";
  }

  public buildOptions(): Object {
    const options = {};
    if (
      !Dependencies.isWindows() &&
      !process.env.WAKATIME_HOME &&
      !process.env.HOME
    ) {
      options["env"] = {
        ...process.env,
        WAKATIME_HOME: Dependencies.getHomeDirectory(),
      };
    }
    return options;
  }

  private checkAndInstallCli(callback: () => void): void {
    this.installCli(callback);
  }

  private getLatestCliVersion(callback: (arg0: string) => void): void {
    if (this.latestCliVersion) {
      callback(this.latestCliVersion);
      return;
    }

    try {
      fetch(this.githubReleasesStableUrl, {
        headers: {
          "Content-type": "application/json",
        },
      } as RequestInit)
        .then((response) => {
          if (response.status == 200 || response.status == 304) {
            this.logger.debug(`GitHub API Response ${response.status}`);
            response.json().then((data) => {
              this.latestCliVersion = data["tag_name"];
              this.logger.debug(
                `Latest wakatime-cli version from GitHub: ${this.latestCliVersion}`
              );
              callback(this.latestCliVersion);
              return;
            });
          } else {
            this.logger.warn(
              `GitHub API Response ${response.status}: ${response.statusText}`
            );
          }
        })
        .catch((err) => {
          this.logger.warn(`GitHub API Response Error: ${err}`);
          callback("");
        });
    } catch (e) {
      this.logger.warnException(e);
      callback("");
    }
  }

  private installCli(callback: () => void): void {
    this.getLatestCliVersion((version) => {
      if (!version) {
        callback();
        return;
      }
      this.logger.debug(`Downloading wakatime-cli ${version}...`);
      const url = this.cliDownloadUrl(version);
      this.logger.debug(`Using download url ${url}`);
      let zipFile = path.join(this.getResourcesLocation(), "wakatime-cli.zip");
      this.downloadFile(
        url,
        zipFile,
        () => {
          this.extractCli(zipFile, callback);
        },
        callback
      );
    });
  }

  private extractCli(zipFile: string, callback: () => void): void {
    this.logger.debug(
      `Extracting wakatime-cli into "${this.getResourcesLocation()}"...`
    );
    this.removeCli(() => {
      this.unzip(zipFile, this.getResourcesLocation(), () => {
        if (!Dependencies.isWindows()) {
          try {
            this.logger.debug("Chmod 755 wakatime-cli...");
            fs.chmodSync(this.getCliLocation(), 0o755);
          } catch (e) {
            this.logger.warnException(e);
          }
        }
        callback();
      });
      this.logger.debug("Finished extracting wakatime-cli.");
    });
  }

  private removeCli(callback: () => void): void {
    if (fs.existsSync(this.getCliLocation())) {
      fs.unlink(this.getCliLocation(), () => {
        callback();
      });
    } else {
      callback();
    }
  }

  private downloadFile(
    url: string,
    outputFile: string,
    callback: () => void,
    error: () => void
  ): void {
    try {
      fetch(url)
        .then(async (response) => {
          this.logger.debug(`Writing to ${outputFile}`);
          const buffer = await response.arrayBuffer();
          fs.writeFileSync(outputFile, Buffer.from(buffer));
          callback();
        })
        .catch((e) => {
          this.logger.warn(`Failed to download ${url}`);
          this.logger.warn(e.toString());
          error();
        });
    } catch (e) {
      this.logger.warnException(e);
      callback();
    }
  }

  private unzip(file: string, outputDir: string, callback: () => void): void {
    if (fs.existsSync(file)) {
      try {
        this.logger.debug(`Preparing to unzip ${file}`);
        const fileContents = fs.readFileSync(file);
        fs.chmodSync(outputDir, 0o755);
        var zip = new JSZip();
        zip.loadAsync(fileContents).then(function (contents) {
          Object.keys(contents.files).forEach(function (filename) {
            zip
              .file(filename)
              .async("nodebuffer")
              .then(function (content) {
                fs.writeFileSync(`${outputDir}/${filename}`, content);
                try {
                  fs.unlink(file, () => {
                    callback();
                  });
                } catch (e2) {
                  callback();
                }
              });
          });
        });
      } catch (e) {
        this.logger.errorException(e);
      }
    }
  }

  private architecture(): string {
    const arch = os.arch();
    if (arch.indexOf("32") > -1) return "386";
    if (arch.indexOf("x64") > -1) return "amd64";
    return arch;
  }

  private cliDownloadUrl(version: string): string {
    let osname = os.platform() as string;
    if (osname == "win32") osname = "windows";
    const arch = this.architecture();

    const validCombinations = [
      "darwin-amd64",
      "darwin-arm64",
      "freebsd-386",
      "freebsd-amd64",
      "freebsd-arm",
      "linux-386",
      "linux-amd64",
      "linux-arm",
      "linux-arm64",
      "netbsd-386",
      "netbsd-amd64",
      "netbsd-arm",
      "openbsd-386",
      "openbsd-amd64",
      "openbsd-arm",
      "openbsd-arm64",
      "windows-386",
      "windows-amd64",
      "windows-arm64",
    ];
    if (!validCombinations.includes(`${osname}-${arch}`))
      console.error(
        `Missing OS and architecture combindation: ${osname} ${arch}`
      );

    return `${this.githubDownloadPrefix}/${version}/wakatime-cli-${osname}-${arch}.zip`;
  }
}
