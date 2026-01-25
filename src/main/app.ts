import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

const isPackaged = !__dirname.includes("node_modules") && 
                   (__dirname.includes("app.asar") || 
                    (typeof process !== "undefined" && process.execPath && !process.execPath.includes("electron")));

let envLoaded = false;

if (isPackaged) {
  const appEnv = path.join(__dirname, "../.env");
  console.log("[Env] Checking app directory:", appEnv, "exists:", fs.existsSync(appEnv));
  if (fs.existsSync(appEnv)) {
    dotenv.config({ path: appEnv });
    envLoaded = true;
    console.log("[Env] Loaded .env from app directory:", appEnv);
  }
  
  if (process.resourcesPath) {
    const resourcesEnv = path.join(process.resourcesPath, ".env");
    console.log("[Env] Checking resources directory:", resourcesEnv, "exists:", fs.existsSync(resourcesEnv));
    if (fs.existsSync(resourcesEnv)) {
      dotenv.config({ path: resourcesEnv });
      envLoaded = true;
      console.log("[Env] Loaded .env from resources directory:", resourcesEnv);
    }
  }
  
  const appPathEnv = path.join(__dirname, "../../.env");
  console.log("[Env] Checking app path:", appPathEnv, "exists:", fs.existsSync(appPathEnv));
  if (!envLoaded && fs.existsSync(appPathEnv)) {
    dotenv.config({ path: appPathEnv });
    envLoaded = true;
    console.log("[Env] Loaded .env from app path:", appPathEnv);
  }
}

if (!envLoaded) {
  const projectRootEnv = path.join(__dirname, "../../../.env");
  if (fs.existsSync(projectRootEnv)) {
    dotenv.config({ path: projectRootEnv });
    envLoaded = true;
    console.log("[Env] Loaded .env from project root:", projectRootEnv);
  }
}

if (!envLoaded) {
  const result = dotenv.config();
  if (!result.error) {
    console.log("[Env] Loaded .env from default location");
  } else {
    console.log("[Env] Failed to load .env:", result.error.message);
  }
}

console.log("[Env] CURSEFORGE_API_KEY:", process.env.CURSEFORGE_API_KEY ? "***SET***" : "NOT SET");

import { app, BrowserWindow } from "electron";
import { ConfigStore } from "./core/ConfigStore";
import { Logger } from "./core/Logger";
import { Paths } from "./core/Paths";
import { AuthManager } from "./core/auth/AuthManager";
import { SanasolAuth, HytaleOfficialAuth } from "./core/auth/providers";
import { registerIpcHandlers } from "./ipc";
import { createMainWindow } from "./windows/mainWindow";
import { UpdateService } from "./updater/UpdateService";

const initializeCore = () => {
  Paths.init();
  Logger.init("main");
  ConfigStore.init();
  
  AuthManager.init([
    new SanasolAuth(),
    new HytaleOfficialAuth()
  ]);
  
  registerIpcHandlers();
  Logger.info("App", "JanLauncher started");
  const mainWindow = createMainWindow();
  
  // Initialize update service after window is created
  UpdateService.init(mainWindow);
};

app.whenReady().then(initializeCore);

app.on("window-all-closed", () => {
  UpdateService.cleanup();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  UpdateService.cleanup();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const mainWindow = createMainWindow();
    UpdateService.init(mainWindow);
  }
});
