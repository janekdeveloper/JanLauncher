import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { ConfigStore } from "../core/ConfigStore";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";
import { JavaManager } from "./JavaManager";
import type { GameProfile, GameOptions } from "../../shared/types";

/**
 * Manages game profiles (game configurations).
 * 
 * Handles creation, updates, removal, and directory management for game profiles.
 */
export class GameProfileManager {
  list(): GameProfile[] {
    try {
      return ConfigStore.getGameProfiles();
    } catch (error) {
      Logger.error("GameProfileManager", "Failed to list game profiles", error);
      throw error;
    }
  }

  getProfile(id: string): GameProfile {
    try {
      const profiles = ConfigStore.getGameProfiles();
      const profile = profiles.find((item) => item.id === id);
      if (!profile) {
        const error = new Error(`Game profile not found: ${id}`);
        Logger.error("GameProfileManager", `Failed to get game profile: ${id}`, error);
        throw error;
      }
      return profile;
    } catch (error) {
      Logger.error("GameProfileManager", `Failed to get game profile: ${id}`, error);
      throw error;
    }
  }

  create(name: string): GameProfile {
    const trimmed = name.trim();
    if (!trimmed) {
      const error = new Error("Game profile name cannot be empty");
      Logger.error("GameProfileManager", "Failed to create game profile", error);
      throw error;
    }

    try {
      const existing = ConfigStore.getGameProfiles();
      const isDuplicate = existing.some(
        (profile) => profile.name.toLowerCase() === trimmed.toLowerCase()
      );

      if (isDuplicate) {
        const error = new Error(`Game profile with name "${trimmed}" already exists`);
        Logger.error("GameProfileManager", "Failed to create game profile", error);
        throw error;
      }

      const id = randomUUID();
      const gameOptions: GameOptions = {
        minMemory: 1024,
        maxMemory: 4096,
        args: []
      };

      const bundledJavaPath = JavaManager.getBundledJavaPath();

      const profile: GameProfile = {
        id,
        name: trimmed,
        created: Date.now(),
        lastUsed: null,
        mods: [],
        javaPath: bundledJavaPath,
        gameOptions,
        versionBranch: "release",
        versionId: null
      };

      const profileDir = Paths.gameProfileDir(id);
      const modsDir = Paths.gameProfileModsDir(id);
      fs.mkdirSync(modsDir, { recursive: true });

      ConfigStore.addGameProfile(profile);
      Logger.info("GameProfileManager", `Created game profile: ${id} (${profile.name})`);
      return profile;
    } catch (error) {
      Logger.error("GameProfileManager", "Failed to create game profile", error);
      throw error;
    }
  }

  update(id: string, patch: Partial<GameProfile>): GameProfile {
    try {
      const existing = ConfigStore.getGameProfiles();
      const profile = existing.find((p) => p.id === id);

      if (!profile) {
        const error = new Error(`Game profile not found: ${id}`);
        Logger.error("GameProfileManager", `Failed to update game profile: ${id}`, error);
        throw error;
      }

      if (patch.name !== undefined) {
        const trimmed = patch.name.trim();
        if (!trimmed) {
          const error = new Error("Game profile name cannot be empty");
          Logger.error("GameProfileManager", `Failed to update game profile: ${id}`, error);
          throw error;
        }

        const isDuplicate = existing.some(
          (p) => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase()
        );

        if (isDuplicate) {
          const error = new Error(`Game profile with name "${trimmed}" already exists`);
          Logger.error("GameProfileManager", `Failed to update game profile: ${id}`, error);
          throw error;
        }
      }

      ConfigStore.updateGameProfile(id, patch);
      const updated = ConfigStore.getGameProfiles().find((p) => p.id === id);
      if (!updated) {
        throw new Error("Failed to retrieve updated profile");
      }
      Logger.info("GameProfileManager", `Updated game profile: ${id} (${updated.name})`);
      return updated;
    } catch (error) {
      Logger.error("GameProfileManager", `Failed to update game profile: ${id}`, error);
      throw error;
    }
  }

  updateProfile(id: string, patch: Partial<GameProfile>): GameProfile {
    return this.update(id, patch);
  }

  remove(id: string): void {
    try {
      const existing = ConfigStore.getGameProfiles();
      const profile = existing.find((p) => p.id === id);

      if (!profile) {
        const error = new Error(`Game profile not found: ${id}`);
        Logger.error("GameProfileManager", `Failed to remove game profile: ${id}`, error);
        throw error;
      }

      ConfigStore.removeGameProfile(id);
      
      try {
        const profileDir = Paths.gameProfileDir(id);
        if (fs.existsSync(profileDir)) {
          fs.rmSync(profileDir, { recursive: true, force: true });
          Logger.info("GameProfileManager", `Removed profile directory: ${profileDir}`);
        }
      } catch (dirError) {
        Logger.warn("GameProfileManager", `Failed to remove profile directory: ${dirError instanceof Error ? dirError.message : String(dirError)}`);
      }
      
      Logger.info("GameProfileManager", `Removed game profile: ${id} (${profile.name})`);
    } catch (error) {
      Logger.error("GameProfileManager", `Failed to remove game profile: ${id}`, error);
      throw error;
    }
  }

  markUsed(id: string): void {
    try {
      const existing = ConfigStore.getGameProfiles();
      const profile = existing.find((p) => p.id === id);

      if (!profile) {
        const error = new Error(`Game profile not found: ${id}`);
        Logger.error("GameProfileManager", `Failed to mark game profile as used: ${id}`, error);
        throw error;
      }

      ConfigStore.updateGameProfile(id, { lastUsed: Date.now() });
      Logger.debug("GameProfileManager", `Marked game profile as used: ${id}`);
    } catch (error) {
      Logger.error("GameProfileManager", `Failed to mark game profile as used: ${id}`, error);
      throw error;
    }
  }
}
