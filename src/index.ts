import joplin from "api";
import { LogLevel } from "./constants";
import { Dependencies } from "./dependencies";
import { ConsoleLogger } from "./loggers/console-logger";
import { settings } from "./settings";

joplin.plugins.register({
  onStart: async function () {
    let logger = new ConsoleLogger(LogLevel.DEBUG);

    await settings.register();

    let dependencies = new Dependencies(logger);
    dependencies.checkAndInstall(() => {
      logger.debug("Finished wakatime-cli installation");
    });
  },
});
