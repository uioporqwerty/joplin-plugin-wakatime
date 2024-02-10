import joplin from "api";
import { SettingItem, SettingItemType } from "api/types";
import { Analytics } from "./analytics";
import { ANALYTICS, WAKATIME_API_KEY } from "./constants";
import { Logger } from "./loggers/logger";

export class Settings {
  private SECTION = "WakaTime";
  private logger: Logger;
  private analytics: Analytics;

  constructor(logger: Logger, analytics: Analytics) {
    this.logger = logger;
    this.analytics = analytics;
  }

  async initialize(): Promise<void> {
    await this.register();
    await this.setupEventListeners();
  }

  private async register(): Promise<void> {
    await joplin.settings.registerSection(this.SECTION, {
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
      description: "Uses ~/.wakatime.cfg if empty. Requires restart",
      value: "",
      secure: true,
      section: this.SECTION,
    };

    PLUGIN_SETTINGS[ANALYTICS] = {
      public: true,
      type: SettingItemType.Bool,
      label: "Enable analytics",
      description:
        "Analytics allow the plugin developer to track how the plugin is being used. Notes and other personal data is not tracked.",
      value: true,
      section: this.SECTION,
    };

    await joplin.settings.registerSettings(PLUGIN_SETTINGS);
  }

  private async setupEventListeners(): Promise<void> {
    await joplin.settings.onChange((handler) => {
      handler.keys.forEach(async (key) => {
        this.logger.debug(`Setting value changed for ${key}`);

        if (key == ANALYTICS) {
          let enabled = await joplin.settings.value(ANALYTICS);
          if (!enabled) {
            this.analytics.disable();
          } else {
            this.analytics.enabled();
          }
        } else if (key == WAKATIME_API_KEY) {
          this.analytics.trackEvent("WakaTime API Key Entered");
        }
      });
    });
  }
}
