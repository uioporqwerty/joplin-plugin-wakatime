import joplin from "api";
import Config from "./config";
import { compareVersions } from "compare-versions";
import { LogLevel } from "./constants";
import { Dependencies } from "./dependencies";
import { Environment, getEnvironment } from "./environment";
import { ConsoleLogger } from "./loggers/console-logger";
import { Logger } from "./loggers/logger";
import { RollbarLogger } from "./loggers/rollbar-logger";
import { AppInformation } from "./models/app-information";
import { settings } from "./settings";
import { WakaTime } from "./wakatime";

joplin.plugins.register({
  onStart: async function () {
    const environment = getEnvironment();
    const isDevelopment = environment == Environment.Development;

    let logger: Logger = isDevelopment
      ? new ConsoleLogger(LogLevel.DEBUG)
      : new RollbarLogger(LogLevel.WARN);

    const appInformationUrl =
      "https://raw.githubusercontent.com/uioporqwerty/joplin-plugin-wakatime/main/app-information.json";

    try {
      const appInformation = (await (
        await fetch(appInformationUrl)
      ).json()) as AppInformation;
      let compareResult = compareVersions(
        appInformation.minimumVersion,
        Config.pluginVersion
      );
      if (compareResult) {
        await joplin.views.dialogs.showMessageBox(
          "WakaTime plugin requires an update. Go to Joplin settings to update the plugin."
        );
        return;
      }
    } catch (error) {
      logger.error(error.message);
    }

    await settings.register();

    let dependencies = new Dependencies(logger);
    dependencies.checkAndInstall(() => {
      logger.debug("Finished wakatime-cli installation");
      let wakatime = new WakaTime(logger);
      wakatime.initialize();
    });
  },
});
