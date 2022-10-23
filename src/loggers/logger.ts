import { LogLevel } from "../constants";

export interface Logger {
  getLevel(): LogLevel;
  setLevel(level: LogLevel): void;
  log(level: LogLevel, msg: string): void;
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  warnException(msg: unknown): void;
  error(msg: string): void;
  errorException(msg: unknown): void;
}
