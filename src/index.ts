import joplin from "api";
import { settings } from "./settings";

joplin.plugins.register({
  onStart: async function () {
    await settings.register();
  },
});
