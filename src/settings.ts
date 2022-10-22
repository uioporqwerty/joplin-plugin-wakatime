import joplin from "api";
import { SettingItem, SettingItemType } from "api/types";
import { WAKATIME_API_KEY } from "./constants";

export namespace settings {
  const SECTION = "WakaTime";

  export async function register() {
    await joplin.settings.registerSection(SECTION, {
      label: "WakaTime",
      iconName: "fas fa-tools",
    });

    let PLUGIN_SETTINGS: Record<string, SettingItem> = {};

    PLUGIN_SETTINGS[WAKATIME_API_KEY] = {
      public: true,
      type: SettingItemType.String,
      label: "WakaTime API Key",
      value: "",
      section: SECTION,
    };

    await joplin.settings.registerSettings(PLUGIN_SETTINGS);
  }
}
