import { LogLevel } from "../constants";
import { Logger } from "./logger";

export class ConsoleLogger implements Logger {
  public level: LogLevel;

  constructor(level: LogLevel) {
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
      if (level == LogLevel.DEBUG) console.log(msg);
      if (level == LogLevel.INFO) console.info(msg);
      if (level == LogLevel.WARN) console.warn(msg);
      if (level == LogLevel.ERROR) console.error(msg);
    }
  }

  debug(msg: string): void {
    this.log(LogLevel.DEBUG, msg);
  }

  info(msg: string): void {
    this.log(LogLevel.INFO, msg);
  }

  warn(msg: string): void {
    this.log(LogLevel.WARN, msg);
  }

  warnException(msg: unknown): void {
    if ((msg as Error).message !== undefined) {
      this.log(LogLevel.WARN, (msg as Error).message);
    }
  }

  error(msg: string): void {
    this.log(LogLevel.ERROR, msg);
  }

  errorException(msg: unknown): void {
    if ((msg as Error).message !== undefined) {
      this.log(LogLevel.ERROR, (msg as Error).message);
    }
  }
}
