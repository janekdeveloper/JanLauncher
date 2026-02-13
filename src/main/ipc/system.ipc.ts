import { ipcMain } from "electron";
import os from "node:os";
import { Logger } from "../core/Logger";

/**
 * Registers IPC handlers for system information.
 */
export const registerSystemHandlers = (): void => {
  ipcMain.handle("system:getTotalMemory", async (): Promise<number> => {
    try {
      const totalBytes = os.totalmem();
      const totalMb = Math.floor(totalBytes / (1024 * 1024));
      Logger.debug("IPC", `system:getTotalMemory -> ${totalMb} MB`);
      return totalMb;
    } catch (error) {
      Logger.error("IPC", "system:getTotalMemory failed", error);
      return 16 * 1024;
    }
  });
};

