import { ipcMain, IpcMainInvokeEvent } from "electron";
import { UpdateService } from "./UpdateService";
import { Logger } from "../core/Logger";

/**
 * IPC handlers for update functionality.
 * 
 * Provides renderer process with update checking, downloading, and installation control.
 */
export const registerUpdateHandlers = (): void => {
  Logger.info("UpdateIPC", "Registering update IPC handlers");

  /**
   * Check for updates.
   * 
   * IPC: updater:check
   */
  ipcMain.handle("updater:check", async (event: IpcMainInvokeEvent): Promise<void> => {
    Logger.info("UpdateIPC", "updater:check invoked");
    await UpdateService.checkForUpdates(true);
  });

  /**
   * Get current update status.
   * 
   * IPC: updater:status
   */
  ipcMain.handle("updater:status", async (event: IpcMainInvokeEvent) => {
    const status = UpdateService.getStatus();
    Logger.debug("UpdateIPC", `updater:status - ${status.status}`);
    return status;
  });

  /**
   * Download available update.
   * 
   * IPC: updater:download
   */
  ipcMain.handle("updater:download", async (event: IpcMainInvokeEvent): Promise<void> => {
    Logger.info("UpdateIPC", "updater:download invoked");
    await UpdateService.downloadUpdate();
  });

  /**
   * Schedule update installation on quit.
   * 
   * IPC: updater:installOnQuit
   */
  ipcMain.handle("updater:installOnQuit", async (event: IpcMainInvokeEvent): Promise<void> => {
    Logger.info("UpdateIPC", "updater:installOnQuit invoked");
    UpdateService.installOnQuit();
  });

  /**
   * Quit and install update immediately.
   * 
   * IPC: updater:quitAndInstall
   */
  ipcMain.handle("updater:quitAndInstall", async (event: IpcMainInvokeEvent): Promise<void> => {
    Logger.info("UpdateIPC", "updater:quitAndInstall invoked");
    UpdateService.quitAndInstall();
  });

  Logger.info("UpdateIPC", "Update IPC handlers registered");
};
