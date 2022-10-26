import joplin from "api";
import { LogLevel } from "./constants";
import { Dependencies } from "./dependencies";
import { Environment, getEnvironment } from "./environment";
import { ConsoleLogger } from "./loggers/console-logger";
import { Logger } from "./loggers/logger";
import { RollbarLogger } from "./loggers/rollbar-logger";
import { settings } from "./settings";
import { WakaTime } from "./wakatime";

joplin.plugins.register({
  onStart: async function () {
    const environment = getEnvironment();
    const isDevelopment = environment == Environment.Development;

    let logger: Logger = isDevelopment
      ? new ConsoleLogger(LogLevel.DEBUG)
      : new RollbarLogger(LogLevel.WARN);

    await settings.register();

    let dependencies = new Dependencies(logger);
    dependencies.checkAndInstall(() => {
      logger.debug("Finished wakatime-cli installation");
      let wakatime = new WakaTime(logger);
      wakatime.initialize();
    });
  },
});
