import { randomUUID } from "node:crypto";
import { ConfigStore } from "../core/ConfigStore";
import { Logger } from "../core/Logger";
import { AuthManager } from "../core/auth/AuthManager";
import type { PlayerProfile, AuthDomain } from "../../shared/types";

const DEFAULT_AUTH_DOMAIN: AuthDomain = "sanasol.ws";
const isAuthDomain = (value: string): value is AuthDomain =>
  value === "hytale.com" || value === "sanasol.ws";

/**
 * Manages player profiles (user accounts).
 * 
 * Handles creation, updates, removal, and authentication for player profiles.
 */
export class PlayerProfileManager {
  list(): PlayerProfile[] {
    try {
      ConfigStore.reloadPlayerProfiles();
      return ConfigStore.getPlayerProfiles();
    } catch (error) {
      Logger.error("PlayerProfileManager", "Failed to list player profiles", error);
      throw error;
    }
  }

  async create(nickname: string, authDomain?: string): Promise<PlayerProfile> {
    const trimmed = nickname.trim();
    if (!trimmed) {
      const error = new Error("Nickname cannot be empty");
      Logger.error("PlayerProfileManager", "Failed to create player profile", error);
      throw error;
    }

    try {
      const existing = ConfigStore.getPlayerProfiles();
      const isDuplicate = existing.some(
        (profile) => profile.nickname.toLowerCase() === trimmed.toLowerCase()
      );

      if (isDuplicate) {
        const error = new Error(`Player profile with nickname "${trimmed}" already exists`);
        Logger.error("PlayerProfileManager", "Failed to create player profile", error);
        throw error;
      }

      const resolvedAuthDomain = isAuthDomain(authDomain ?? "")
        ? (authDomain as AuthDomain)
        : DEFAULT_AUTH_DOMAIN;

      const profile: PlayerProfile = {
        id: randomUUID(),
        nickname: trimmed,
        authDomain: resolvedAuthDomain
      };

      ConfigStore.addPlayerProfile(profile);
      
      try {
        const providerId = resolvedAuthDomain as "hytale.com" | "sanasol.ws";
        await AuthManager.login(profile.id, providerId, {
          uuid: profile.id,
          username: profile.nickname
        });
        Logger.info(
          "PlayerProfileManager",
          `Fetched and saved auth session for profile: ${profile.id}`
        );
      } catch (error) {
        Logger.warn(
          "PlayerProfileManager",
          `Failed to fetch auth session for new profile: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      
      const finalProfile = ConfigStore.getPlayerProfiles().find((p) => p.id === profile.id);
      if (!finalProfile) {
        throw new Error("Failed to retrieve created profile");
      }
      
      Logger.info("PlayerProfileManager", `Created player profile: ${profile.id} (${profile.nickname})`);
      return finalProfile;
    } catch (error) {
      Logger.error("PlayerProfileManager", "Failed to create player profile", error);
      throw error;
    }
  }

  async update(id: string, patch: Partial<PlayerProfile>): Promise<PlayerProfile> {
    const trimmed = patch.nickname?.trim();
    if (patch.nickname !== undefined && !trimmed) {
      const error = new Error("Nickname cannot be empty");
      Logger.error("PlayerProfileManager", `Failed to update player profile: ${id}`, error);
      throw error;
    }

    try {
      const existing = ConfigStore.getPlayerProfiles();
      const profile = existing.find((p) => p.id === id);

      if (!profile) {
        const error = new Error(`Player profile not found: ${id}`);
        Logger.error("PlayerProfileManager", `Failed to update player profile: ${id}`, error);
        throw error;
      }

      if (trimmed) {
        const isDuplicate = existing.some(
          (p) => p.id !== id && p.nickname.toLowerCase() === trimmed.toLowerCase()
        );

        if (isDuplicate) {
          const error = new Error(`Player profile with nickname "${trimmed}" already exists`);
          Logger.error("PlayerProfileManager", `Failed to update player profile: ${id}`, error);
          throw error;
        }
      }

      const nextPatch: Partial<PlayerProfile> = {};
      const nicknameChanged = trimmed !== undefined && trimmed !== profile.nickname;
      const authDomainChanged = patch.authDomain !== undefined && patch.authDomain !== profile.authDomain;
      
      if (trimmed !== undefined) {
        nextPatch.nickname = trimmed;
      }
      if (patch.authDomain !== undefined) {
        nextPatch.authDomain = isAuthDomain(patch.authDomain)
          ? patch.authDomain
          : DEFAULT_AUTH_DOMAIN;
      }
      if (patch.authTokens !== undefined) {
        nextPatch.authTokens = patch.authTokens;
      }

      ConfigStore.updatePlayerProfile(id, nextPatch);
      
      if (nicknameChanged || authDomainChanged) {
        try {
          const providerId = (nextPatch.authDomain || DEFAULT_AUTH_DOMAIN) as "hytale.com" | "sanasol.ws";
          await AuthManager.login(id, providerId, {
            uuid: id,
            username: trimmed || profile.nickname
          });
          Logger.info(
            "PlayerProfileManager",
            `Fetched and saved new auth session for profile: ${id}`
          );
        } catch (error) {
          Logger.warn(
            "PlayerProfileManager",
            `Failed to fetch auth session after update: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      const updated = ConfigStore.getPlayerProfiles().find((p) => p.id === id);
      if (!updated) {
        throw new Error("Failed to retrieve updated profile");
      }
      Logger.info("PlayerProfileManager", `Updated player profile: ${id} (${updated.nickname})`);
      return updated;
    } catch (error) {
      Logger.error("PlayerProfileManager", `Failed to update player profile: ${id}`, error);
      throw error;
    }
  }

  getProfile(id: string): PlayerProfile {
    try {
      const profiles = ConfigStore.getPlayerProfiles();
      const profile = profiles.find((item) => item.id === id);
      if (!profile) {
        const error = new Error(`Player profile not found: ${id}`);
        Logger.error("PlayerProfileManager", `Failed to get player profile: ${id}`, error);
        throw error;
      }
      return profile;
    } catch (error) {
      Logger.error("PlayerProfileManager", `Failed to get player profile: ${id}`, error);
      throw error;
    }
  }

  remove(id: string): void {
    try {
      const existing = ConfigStore.getPlayerProfiles();
      const profile = existing.find((p) => p.id === id);

      if (!profile) {
        const error = new Error(`Player profile not found: ${id}`);
        Logger.error("PlayerProfileManager", `Failed to remove player profile: ${id}`, error);
        throw error;
      }

      ConfigStore.removePlayerProfile(id);
      Logger.info("PlayerProfileManager", `Removed player profile: ${id} (${profile.nickname})`);
    } catch (error) {
      Logger.error("PlayerProfileManager", `Failed to remove player profile: ${id}`, error);
      throw error;
    }
  }
}
