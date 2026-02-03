import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import type { GameProfile, PlayerProfile } from "../../shared/types";

type ProfilesStore = {
  playerProfiles: PlayerProfile[];
  playerProfilesLoading: boolean;
  playerProfilesError: string | null;
  loadPlayerProfiles: () => Promise<void>;
  createPlayerProfile: (nickname: string) => Promise<PlayerProfile>;
  updatePlayerProfile: (id: string, nickname: string) => Promise<void>;
  removePlayerProfile: (id: string) => Promise<void>;

  gameProfiles: GameProfile[];
  gameProfilesLoading: boolean;
  gameProfilesError: string | null;
  loadGameProfiles: () => Promise<void>;
  createGameProfile: (name: string) => Promise<GameProfile>;
  updateGameProfile: (id: string, patch: Partial<GameProfile>) => Promise<void>;
  removeGameProfile: (id: string) => Promise<void>;
};

const ProfilesStoreContext = createContext<ProfilesStore | undefined>(undefined);

export const ProfilesStoreProvider = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfile[]>([]);
  const [playerProfilesLoading, setPlayerProfilesLoading] = useState(false);
  const [playerProfilesError, setPlayerProfilesError] = useState<string | null>(null);

  const [gameProfiles, setGameProfiles] = useState<GameProfile[]>([]);
  const [gameProfilesLoading, setGameProfilesLoading] = useState(false);
  const     [gameProfilesError, setGameProfilesError] = useState<string | null>(null);

  const loadPlayerProfiles = useCallback(async () => {
    setPlayerProfilesLoading(true);
    setPlayerProfilesError(null);
    try {
      const profiles = await api.playerProfiles.list();
      setPlayerProfiles(profiles);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load player profiles";
      setPlayerProfilesError(message);
      throw error;
    } finally {
      setPlayerProfilesLoading(false);
    }
  }, []);

  const createPlayerProfile = useCallback(async (nickname: string) => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      throw new Error("Nickname cannot be empty");
    }

    setPlayerProfilesError(null);
    try {
      const profile: PlayerProfile = {
        id: "",
        nickname: trimmed
      };
      const created = await api.playerProfiles.create(profile);
      await loadPlayerProfiles();
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create player profile";
      setPlayerProfilesError(message);
      throw error;
    }
  }, [loadPlayerProfiles]);

  const updatePlayerProfile = useCallback(async (id: string, nickname: string) => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      throw new Error("Nickname cannot be empty");
    }

    setPlayerProfilesError(null);
    try {
      await api.playerProfiles.update(id, { nickname: trimmed });
      await loadPlayerProfiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update player profile";
      setPlayerProfilesError(message);
      throw error;
    }
  }, [loadPlayerProfiles]);

  const removePlayerProfile = useCallback(async (id: string) => {
    setPlayerProfilesError(null);
    try {
      await api.playerProfiles.remove(id);
      await loadPlayerProfiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove player profile";
      setPlayerProfilesError(message);
      throw error;
    }
  }, [loadPlayerProfiles]);

  const loadGameProfiles = useCallback(async () => {
    setGameProfilesLoading(true);
    setGameProfilesError(null);
    try {
      const profiles = await api.gameProfiles.list();
      setGameProfiles(profiles);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load game profiles";
      setGameProfilesError(message);
      throw error;
    } finally {
      setGameProfilesLoading(false);
    }
  }, []);

  const createGameProfile = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Game profile name cannot be empty");
    }

    setGameProfilesError(null);
    try {
      const profile: GameProfile = {
        id: "",
        name: trimmed,
        created: Date.now(),
        lastUsed: null,
        mods: [],
        javaPath: null,
        gameOptions: {
          minMemory: 1024,
          maxMemory: 4096,
          args: []
        },
        versionBranch: "release",
        versionId: null
      };
      const created = await api.gameProfiles.create(profile);
      await loadGameProfiles();
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create game profile";
      setGameProfilesError(message);
      throw error;
    }
  }, [loadGameProfiles]);

  const updateGameProfile = useCallback(async (id: string, patch: Partial<GameProfile>) => {
    setGameProfilesError(null);
    try {
      await api.gameProfiles.update(id, patch);
      await loadGameProfiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update game profile";
      setGameProfilesError(message);
      throw error;
    }
  }, [loadGameProfiles]);

  const removeGameProfile = useCallback(async (id: string) => {
    setGameProfilesError(null);
    try {
      await api.gameProfiles.remove(id);
      await loadGameProfiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove game profile";
      setGameProfilesError(message);
      throw error;
    }
  }, [loadGameProfiles]);

  const value = useMemo(
    () => ({
      playerProfiles,
      playerProfilesLoading,
      playerProfilesError,
      loadPlayerProfiles,
      createPlayerProfile,
      updatePlayerProfile,
      removePlayerProfile,
      gameProfiles,
      gameProfilesLoading,
      gameProfilesError,
      loadGameProfiles,
      createGameProfile,
      updateGameProfile,
      removeGameProfile
    }),
    [
      playerProfiles,
      playerProfilesLoading,
      playerProfilesError,
      loadPlayerProfiles,
      createPlayerProfile,
      updatePlayerProfile,
      removePlayerProfile,
      gameProfiles,
      gameProfilesLoading,
      gameProfilesError,
      loadGameProfiles,
      createGameProfile,
      updateGameProfile,
      removeGameProfile
    ]
  );

  return (
    <ProfilesStoreContext.Provider value={value}>
      {children}
    </ProfilesStoreContext.Provider>
  );
};

export const useProfilesStore = () => {
  const ctx = useContext(ProfilesStoreContext);
  if (!ctx) {
    throw new Error("useProfilesStore must be used within ProfilesStoreProvider");
  }
  return ctx;
};
