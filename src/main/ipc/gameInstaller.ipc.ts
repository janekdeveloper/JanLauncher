import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Logger } from "../core/Logger";
import { GameInstaller } from "../services/GameInstaller";
import type { InstallProgress } from "../services/GameInstaller";

/**
 * Registers IPC handlers for game installation.
 */
export const registerGameInstallerHandlers = (): void => {
  ipcMain.handle(
    "game:install",
    async (
      event: IpcMainInvokeEvent,
      options: { gameProfileId: string }
    ): Promise<void> => {
      Logger.info("IPC", `game:install - game: ${options.gameProfileId}`);

      try {
        await GameInstaller.installGame({
          profileId: options.gameProfileId,
          onProgress: (progress: InstallProgress) => {
            event.sender.send("game:install:progress", progress);
          }
        });

        Logger.info("IPC", "game:install completed successfully");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.error("IPC", "game:install failed", error);
        event.sender.send("game:install:error", errorMessage);
        throw error;
      }
    }
  );
};
