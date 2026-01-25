import { ipcMain } from "electron";
import { Logger } from "../core/Logger";
import { PlayerProfileManager } from "../services/PlayerProfileManager";
import { AuthManager } from "../core/auth/AuthManager";
import type { PlayerProfile } from "../../shared/types";

const manager = new PlayerProfileManager();

/**
 * Registers IPC handlers for player profile management.
 */
export const registerPlayerProfilesHandlers = (): void => {
  ipcMain.handle("playerProfiles:list", async (): Promise<PlayerProfile[]> => {
    Logger.debug("IPC", "playerProfiles:list");
    try {
      return manager.list();
    } catch (error) {
      Logger.error("IPC", "playerProfiles:list failed", error);
      throw error;
    }
  });

  ipcMain.handle(
    "playerProfiles:create",
    async (_event, profile: PlayerProfile): Promise<PlayerProfile> => {
      if (!profile || typeof profile !== "object") {
        throw new Error("Invalid profile data");
      }
      if (!profile.nickname || typeof profile.nickname !== "string") {
        throw new Error("Invalid nickname");
      }
      if (profile.authDomain !== undefined && typeof profile.authDomain !== "string") {
        throw new Error("Invalid authDomain");
      }

      Logger.debug("IPC", `playerProfiles:create ${profile.nickname}`);
      try {
        return await manager.create(profile.nickname, profile.authDomain);
      } catch (error) {
        Logger.error("IPC", "playerProfiles:create failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "playerProfiles:update",
    async (
      _event,
      id: string,
      patch: Partial<PlayerProfile>
    ): Promise<PlayerProfile> => {
      if (!id || typeof id !== "string") {
        throw new Error("Invalid profile id");
      }
      if (!patch || typeof patch !== "object") {
        throw new Error("Invalid patch data");
      }
      if (patch.nickname !== undefined && typeof patch.nickname !== "string") {
        throw new Error("Invalid nickname");
      }
      if (patch.authDomain !== undefined && typeof patch.authDomain !== "string") {
        throw new Error("Invalid authDomain");
      }
      if (patch.nickname === undefined && patch.authDomain === undefined) {
        throw new Error("Nothing to update");
      }

      Logger.debug("IPC", `playerProfiles:update ${id} ${JSON.stringify(patch)}`);
      try {
        return await manager.update(id, patch);
      } catch (error) {
        Logger.error("IPC", "playerProfiles:update failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "playerProfiles:remove",
    async (_event, id: string): Promise<void> => {
      if (!id || typeof id !== "string") {
        throw new Error("Invalid profile id");
      }

      Logger.debug("IPC", `playerProfiles:remove ${id}`);
      try {
        manager.remove(id);
      } catch (error) {
        Logger.error("IPC", "playerProfiles:remove failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "playerProfiles:validate",
    async (_event, id: string): Promise<PlayerProfile> => {
      if (!id || typeof id !== "string") {
        throw new Error("Invalid profile id");
      }

      Logger.debug("IPC", `playerProfiles:validate ${id}`);
      try {
        await AuthManager.ensureSession(id, { reason: "validate" });
        return manager.getProfile(id);
      } catch (error) {
        Logger.error("IPC", "playerProfiles:validate failed", error);
        try {
          return manager.getProfile(id);
        } catch {
          throw error;
        }
      }
    }
  );
};
