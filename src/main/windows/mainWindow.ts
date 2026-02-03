import { app, BrowserWindow } from "electron";
import path from "node:path";
import fs from "node:fs";
import { Logger } from "../core/Logger";

const getIconPath = (): string | undefined => {
  const iconName = "icon.png";
  const possiblePaths: string[] = [];
  
  if (app.isPackaged) {
    const appPath = app.getAppPath();
    const resourcesPath = process.resourcesPath || "";
    
    possiblePaths.push(path.join(appPath, "build", iconName));
    
    if (resourcesPath) {
      possiblePaths.push(path.join(resourcesPath, "build", iconName));
    }
    
    possiblePaths.push(path.join(appPath, iconName));
    
    if (resourcesPath) {
      possiblePaths.push(path.join(resourcesPath, iconName));
    }
    
    if (process.env.APPIMAGE) {
      const appImagePath = path.dirname(process.env.APPIMAGE);
      possiblePaths.push(path.join(appImagePath, "build", iconName));
      possiblePaths.push(path.join(appImagePath, iconName));
  }
  } else {
    possiblePaths.push(path.join(__dirname, "../../../build", iconName));
    possiblePaths.push(path.join(__dirname, "../../../../build", iconName));
  }
  
  for (const iconPath of possiblePaths) {
    try {
      if (fs.existsSync(iconPath)) {
        Logger.info("MainWindow", `Found icon at: ${iconPath}`);
        return iconPath;
      }
    } catch (error) {
    }
  }
  
  Logger.warn("MainWindow", "Icon not found in any of the expected locations");
  Logger.debug("MainWindow", `Tried paths: ${possiblePaths.join(", ")}`);
  return undefined;
};

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
      preload: app.isPackaged
        ? path.join(app.getAppPath(), "dist", "preload", "index.js")
        : path.join(__dirname, "../../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const finalIconPath = iconPath || getIconPath();
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

  // Only use dev server in development mode, never in packaged app
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
    // Always use local HTML file in packaged app
    win.loadFile(getHtmlPath());
  }

  return win;
};
