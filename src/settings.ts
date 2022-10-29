import joplin from "api";
import { SettingItem, SettingItemType } from "api/types";
import { ANALYTICS, WAKATIME_API_KEY } from "./constants";

export namespace settings {
  const SECTION = "WakaTime";

  export async function register() {
    await joplin.settings.registerSection(SECTION, {
      label: "WakaTime",
      iconName: "fas fa-clock",
      description:
        "For support, go to https://github.com/uioporqwerty/joplin-plugin-wakatime/issues",
    });

    let PLUGIN_SETTINGS: Record<string, SettingItem> = {};

    PLUGIN_SETTINGS[WAKATIME_API_KEY] = {
      public: true,
      type: SettingItemType.String,
      label: "WakaTime API Key",
      description: "Requires restart",
      value: "",
      secure: true,
      section: SECTION,
    };

    PLUGIN_SETTINGS[ANALYTICS] = {
      public: true,
      type: SettingItemType.Bool,
      label: "Enable analytics",
      description:
        "Analytics allow the plugin developer to track how the plugin is being used. Notes and other personal data is not tracked.",
      value: true,
      section: SECTION,
    };

    await joplin.settings.registerSettings(PLUGIN_SETTINGS);
  }

  export async function setupEventListeners() {
    await joplin.settings.onChange((handler) => {
      handler.keys.forEach(async (key) => {
        if (key == ANALYTICS) {
          let enabled = await joplin.settings.value(ANALYTICS);
          if (!enabled) {
            this.disable();
          } else {
            this.enabled();
          }
        }
      });
    });
  }
}
