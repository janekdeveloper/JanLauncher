import { ipcMain } from "electron";
import { Logger } from "../core/Logger";
import { SettingsWindowManager } from "../windows/SettingsWindowManager";

export const registerWindowHandlers = (): void => {
  ipcMain.handle("window:openSettings", async (): Promise<void> => {
    Logger.debug("IPC", "window:openSettings");
    SettingsWindowManager.open();
  });
};
