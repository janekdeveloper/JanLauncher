import { ipcMain, shell } from "electron";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";

/**
 * Registers IPC handlers for opening directories.
 */
export const registerPathsHandlers = (): void => {
  ipcMain.handle("paths:openGameDir", async (): Promise<void> => {
    try {
      const gameDir = Paths.getGameDir();
      Logger.info("IPC", `Opening game directory: ${gameDir}`);
      await shell.openPath(gameDir);
    } catch (error) {
      Logger.error("IPC", "Failed to open game directory", error);
      throw error;
    }
  });

  ipcMain.handle("paths:openConfigDir", async (): Promise<void> => {
    try {
      const configDir = Paths.configDir;
      Logger.info("IPC", `Opening config directory: ${configDir}`);
      await shell.openPath(configDir);
    } catch (error) {
      Logger.error("IPC", "Failed to open config directory", error);
      throw error;
    }
  });

  ipcMain.handle(
    "paths:openUserDataDir",
    async (_event, gameProfileId: string): Promise<void> => {
      if (!gameProfileId || typeof gameProfileId !== "string") {
        throw new Error("Invalid gameProfileId");
      }

      try {
        const userDataDir = Paths.getUserDataDir(gameProfileId);
        Logger.info("IPC", `Opening user data directory: ${userDataDir}`);
        await shell.openPath(userDataDir);
      } catch (error) {
        Logger.error("IPC", "Failed to open user data directory", error);
        throw error;
      }
    }
  );

  ipcMain.handle("paths:openLogsDir", async (): Promise<void> => {
    try {
      const logsDir = Paths.logsDir;
      Logger.info("IPC", `Opening logs directory: ${logsDir}`);
      await shell.openPath(logsDir);
    } catch (error) {
      Logger.error("IPC", "Failed to open logs directory", error);
      throw error;
    }
  });
};
