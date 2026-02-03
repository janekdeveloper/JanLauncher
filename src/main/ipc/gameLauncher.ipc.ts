import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Logger } from "../core/Logger";
import { GameInstaller } from "../services/GameInstaller";
import { GameLauncher } from "../services/GameLauncher";
import { VersionManager } from "../versioning/VersionManager";
import type { InstallProgress } from "../services/GameInstaller";

/**
 * Registers IPC handlers for game launching.
 */
export const registerGameLauncherHandlers = (): void => {
  ipcMain.handle(
    "game:launch",
    async (
      event: IpcMainInvokeEvent,
      options: { playerProfileId: string; gameProfileId: string }
    ): Promise<void> => {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid launch options");
      }
      if (!options.playerProfileId || typeof options.playerProfileId !== "string") {
        throw new Error("Invalid playerProfileId");
      }
      if (!options.gameProfileId || typeof options.gameProfileId !== "string") {
        throw new Error("Invalid gameProfileId");
      }

      Logger.info("IPC", `game:launch - player: ${options.playerProfileId}, game: ${options.gameProfileId}`);

      try {
        const activeVersion = VersionManager.getActiveVersion(options.gameProfileId);
        if (!activeVersion.versionId) {
          throw new Error("No active game version selected for this profile");
        }
        if (!GameInstaller.isGameInstalled(options.gameProfileId)) {
          Logger.info("IPC", "Game not installed, starting installation");
          await GameInstaller.installGame({
            profileId: options.gameProfileId,
            onProgress: (progress: InstallProgress) => {
              event.sender.send("game:install:progress", progress);
            }
          });
          Logger.info("IPC", "Game installation completed");
        }

        await GameLauncher.launch({
          playerProfileId: options.playerProfileId,
          gameProfileId: options.gameProfileId,
          onStdout: (line: string) => {
            event.sender.send("game:stdout", line);
          },
          onStderr: (line: string) => {
            event.sender.send("game:stderr", line);
          }
        });

        Logger.info("IPC", "game:launch completed successfully");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.error("IPC", "game:launch failed", error);
        event.sender.send("game:error", errorMessage);
        event.sender.send("game:install:error", errorMessage);
        throw error;
      }
    }
  );
};
