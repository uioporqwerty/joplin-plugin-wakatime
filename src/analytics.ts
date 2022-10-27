import mixpanel = require("mixpanel-browser");
import Config from "./config";
import { Environment, getEnvironment } from "./environment";

export class Analytics {
  private defaultProps = {
    "Plugin Version": Config.pluginVersion,
  };

  constructor() {
    mixpanel.init(Config.mixpanelToken, {
      debug: getEnvironment() == Environment.Development,
    });
  }

  trackEvent(name: string, props: Record<string, any> = undefined): void {
    mixpanel.track(name, { ...this.defaultProps, props });
  }
}
