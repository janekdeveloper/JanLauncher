import { ipcMain, BrowserWindow } from "electron";
import { Logger } from "../core/Logger";
import type { Settings } from "../../shared/types";

/**
 * Registers IPC handlers for settings management.
 */
export const registerSettingsHandlers = (): void => {
  ipcMain.handle("settings:get", async (): Promise<Settings> => {
    Logger.debug("IPC", "settings:get");
    const { ConfigStore } = await import("../core/ConfigStore");
    return ConfigStore.getSettings();
  });

  ipcMain.handle(
    "settings:update",
    async (_event, patch: Partial<Settings>): Promise<void> => {
      if (!patch || typeof patch !== "object") {
        throw new Error("Invalid settings patch");
      }

      Logger.debug("IPC", `settings:update ${JSON.stringify(patch)}`);
      const { ConfigStore } = await import("../core/ConfigStore");
      ConfigStore.updateSettings(patch);

      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed() && win.webContents) {
          win.webContents.send("settings:updated", patch);
        }
      });
    }
  );
};
