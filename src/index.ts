import joplin from "api";
import { LogLevel } from "./constants";
import { Dependencies } from "./dependencies";
import { ConsoleLogger } from "./loggers/console-logger";
import { settings } from "./settings";
import { WakaTime } from "./wakatime";

joplin.plugins.register({
  onStart: async function () {
    let logger = new ConsoleLogger(LogLevel.DEBUG);

    await settings.register();

    let dependencies = new Dependencies(logger);
    dependencies.checkAndInstall(() => {
      logger.debug("Finished wakatime-cli installation");
      let wakatime = new WakaTime(logger);
      wakatime.initialize();
    });

    // let note = await joplin.workspace.selectedNote();
    // let folder = await joplin.workspace.selectedFolder();
    // console.dir(note);
    // console.dir(folder);
  },
});
