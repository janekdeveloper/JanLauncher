import { ipcMain } from "electron";
import { Logger } from "../core/Logger";
import { GameProfileManager } from "../services/GameProfileManager";
import type { GameProfile } from "../../shared/types";

const manager = new GameProfileManager();

/**
 * Registers IPC handlers for game profile management.
 */
export const registerGameProfilesHandlers = (): void => {
  ipcMain.handle("gameProfiles:list", async (): Promise<GameProfile[]> => {
    Logger.debug("IPC", "gameProfiles:list");
    try {
      return manager.list();
    } catch (error) {
      Logger.error("IPC", "gameProfiles:list failed", error);
      throw error;
    }
  });

  ipcMain.handle(
    "gameProfiles:create",
    async (_event, profile: GameProfile): Promise<GameProfile> => {
      if (!profile || typeof profile !== "object") {
        throw new Error("Invalid profile data");
      }
      if (!profile.name || typeof profile.name !== "string") {
        throw new Error("Invalid profile name");
      }

      Logger.debug("IPC", `gameProfiles:create ${profile.name}`);
      try {
        return manager.create(profile.name);
      } catch (error) {
        Logger.error("IPC", "gameProfiles:create failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "gameProfiles:update",
    async (
      _event,
      id: string,
      patch: Partial<GameProfile>
    ): Promise<GameProfile> => {
      if (!id || typeof id !== "string") {
        throw new Error("Invalid profile id");
      }
      if (!patch || typeof patch !== "object") {
        throw new Error("Invalid patch data");
      }

      Logger.debug("IPC", `gameProfiles:update ${id} ${JSON.stringify(patch)}`);
      try {
        return manager.update(id, patch);
      } catch (error) {
        Logger.error("IPC", "gameProfiles:update failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "gameProfiles:remove",
    async (_event, id: string): Promise<void> => {
      if (!id || typeof id !== "string") {
        throw new Error("Invalid profile id");
      }

      Logger.debug("IPC", `gameProfiles:remove ${id}`);
      try {
        manager.remove(id);
      } catch (error) {
        Logger.error("IPC", "gameProfiles:remove failed", error);
        throw error;
      }
    }
  );
};
