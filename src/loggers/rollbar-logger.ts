import Rollbar = require("rollbar");
import Config from "../config";
import { LogLevel } from "../constants";
import { Logger } from "./logger";

export class RollbarLogger implements Logger {
  public level: LogLevel;
  private rollbar: Rollbar;

  constructor(level: LogLevel) {
    this.rollbar = new Rollbar({
      accessToken: Config.rollbarAccessToken,
      captureUncaught: true,
      captureUnhandledRejections: true,
      environment: "Production",
    });
    this.setLevel(level);
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  log(level: LogLevel, msg: string): void {
    if (level >= this.level) {
      msg = `[WakaTime][${LogLevel[level]}] ${msg}`;
      if (level == LogLevel.DEBUG) this.rollbar.log(msg);
      if (level == LogLevel.INFO) this.rollbar.info(msg);
      if (level == LogLevel.WARN) this.rollbar.warn(msg);
      if (level == LogLevel.ERROR) this.rollbar.error(msg);
    }
  }

  debug(msg: string): void {
    this.rollbar.debug(msg);
  }

  info(msg: string): void {
    this.rollbar.info(msg);
  }

  warn(msg: string): void {
    this.rollbar.warn(msg);
  }

  warnException(msg: unknown): void {
    throw new Error("Method not implemented.");
  }

  error(msg: string): void {
    this.rollbar.error(msg);
  }

  errorException(msg: unknown): void {
    throw new Error("Method not implemented.");
  }
}
