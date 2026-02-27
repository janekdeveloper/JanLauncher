import { ipcMain, app } from "electron";

export type AppInfo = {
  version: string;
  platform: string;
};

/**
 * Registers IPC handlers for app-level information (version, platform).
 */
export const registerAppHandlers = (): void => {
  ipcMain.handle("app:getAppInfo", async (): Promise<AppInfo> => {
    return {
      version: app.getVersion(),
      platform: process.platform
    };
  });
};
