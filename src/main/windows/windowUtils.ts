import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import { Logger } from "../core/Logger";

export const getIconPath = (): string | undefined => {
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
        Logger.info("WindowUtils", `Found icon at: ${iconPath}`);
        return iconPath;
      }
    } catch {
      // skip
    }
  }

  Logger.warn("WindowUtils", "Icon not found in any of the expected locations");
  return undefined;
};

export const getPreloadPath = (): string =>
  app.isPackaged
    ? path.join(app.getAppPath(), "dist", "preload", "index.js")
    : path.join(__dirname, "../../preload/index.js");
