import { app, BrowserWindow } from "electron";
import path from "node:path";
import { Logger } from "../core/Logger";
import { getIconPath, getPreloadPath } from "./windowUtils";

export const createMainWindow = (): BrowserWindow => {
  const iconPath = getIconPath();

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: "JanLauncher",
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const finalIconPath = iconPath ?? getIconPath();
  if (finalIconPath) {
    try {
      win.setIcon(finalIconPath);
      Logger.info("MainWindow", `Window icon set to: ${finalIconPath}`);
    } catch (error) {
      Logger.warn("MainWindow", `Failed to set window icon: ${error}`);
    }
  } else {
    Logger.warn("MainWindow", "Could not find icon file for window");
  }

  win.once("ready-to-show", () => {
    win.show();
  });

  const getHtmlPath = (): string => {
    if (app.isPackaged) {
      const htmlPath = path.join(app.getAppPath(), "dist", "renderer", "index.html");
      Logger.info("MainWindow", `Loading HTML from packaged app: ${htmlPath}`);
      return htmlPath;
    } else {
      return path.join(__dirname, "../renderer/index.html");
    }
  };

  if (!app.isPackaged) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl && typeof devServerUrl === "string" && devServerUrl.trim().length > 0) {
      try {
        win.loadURL(devServerUrl);
        Logger.info("MainWindow", `Loading from dev server: ${devServerUrl}`);
      } catch (error) {
        Logger.error("MainWindow", `Failed to load dev server URL: ${devServerUrl}`, error);
        win.loadFile(getHtmlPath());
      }
    } else {
      win.loadFile(getHtmlPath());
    }
  } else {
    win.loadFile(getHtmlPath());
  }

  return win;
};
