import { app, BrowserWindow } from "electron";
import path from "node:path";
import { Logger } from "../core/Logger";
import { getIconPath, getPreloadPath } from "./windowUtils";

const SETTINGS_WINDOW_MIN_WIDTH = 720;
const SETTINGS_WINDOW_WIDTH = 900;
const SETTINGS_WINDOW_HEIGHT = 600;

export class SettingsWindowManager {
  private static instance: BrowserWindow | null = null;

  static init(): void {
    // No-op; instance created on demand via open()
    Logger.debug("SettingsWindowManager", "Initialized");
  }

  static open(): void {
    if (this.instance && !this.instance.isDestroyed()) {
      this.instance.focus();
      return;
    }

    const iconPath = getIconPath();

    const win = new BrowserWindow({
      minWidth: SETTINGS_WINDOW_MIN_WIDTH,
      width: SETTINGS_WINDOW_WIDTH,
      height: SETTINGS_WINDOW_HEIGHT,
      resizable: true,
      show: false,
      title: "Settings — JanLauncher",
      icon: iconPath,
      autoHideMenuBar: true,
      webPreferences: {
        preload: getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    if (iconPath) {
      try {
        win.setIcon(iconPath);
      } catch {
        Logger.warn("SettingsWindowManager", "Failed to set window icon");
      }
    }

    win.once("ready-to-show", () => {
      win.show();
    });

    win.on("closed", () => {
      SettingsWindowManager.instance = null;
      Logger.debug("SettingsWindowManager", "Settings window closed");
    });

    this.instance = win;

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (!app.isPackaged && devServerUrl && typeof devServerUrl === "string" && devServerUrl.trim().length > 0) {
      const settingsUrl = devServerUrl.replace(/\/$/, "") + "/settings.html";
      win.loadURL(settingsUrl).catch((err) => {
        Logger.error("SettingsWindowManager", "Failed to load settings from dev server", err);
        win.loadFile(this.getSettingsHtmlPath());
      });
    } else {
      win.loadFile(this.getSettingsHtmlPath());
    }
  }

  private static getSettingsHtmlPath(): string {
    if (app.isPackaged) {
      return path.join(app.getAppPath(), "dist", "renderer", "settings.html");
    }
    return path.join(__dirname, "../renderer/settings.html");
  }
}
