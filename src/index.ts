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
import { WakaTime } from "./wakatime";
import { Analytics } from "./analytics";
import { Settings } from "./settings";

joplin.plugins.register({
  onStart: async function () {
    const environment = getEnvironment();
    const isDevelopment = environment == Environment.Development;

    let logger: Logger = isDevelopment
      ? new ConsoleLogger(LogLevel.DEBUG)
      : new RollbarLogger(LogLevel.WARN);

    let analytics = new Analytics();
    let settings = new Settings(logger, analytics);
    let wakatime = new WakaTime(logger, analytics);
    let dependencies = new Dependencies(logger, analytics);

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
      if (compareResult === 1) {
        await joplin.views.dialogs.showMessageBox(
          "WakaTime plugin requires an update. Go to Joplin settings to update the plugin."
        );
        analytics.trackEvent("Required Update prompt dismisesed");
        return;
      }
    } catch (error) {
      logger.error(error.message);
    }

    await settings.initialize();

    dependencies.checkAndInstall(() => {
      logger.debug("Finished wakatime-cli installation");
      wakatime.initialize();
    });
  },
});
