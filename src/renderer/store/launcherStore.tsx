import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { api } from "../services/api";
import type { GameProfile, PlayerProfile, AuthDomain } from "../../shared/types";

type LauncherStore = {
  playerProfiles: PlayerProfile[];
  gameProfiles: GameProfile[];
  selectedPlayerId: string;
  selectedGameId: string;
  selectedPlayer?: PlayerProfile;
  selectedGame?: GameProfile;
  setSelectedPlayerId: (id: string) => void;
  setSelectedGameId: (id: string) => void;
  addPlayerProfile: (nickname: string, authDomain?: AuthDomain) => void;
  updatePlayerProfile: (id: string, patch: Partial<PlayerProfile>) => void;
  syncPlayerProfile: (profile: PlayerProfile) => void;
  refreshPlayerProfiles: () => Promise<void>;
  deletePlayerProfile: (id: string) => void;
  addGameProfile: (name: string) => void;
  updateGameProfile: (id: string, patch: Partial<GameProfile>) => void;
};

const LauncherStoreContext = createContext<LauncherStore | undefined>(undefined);

export const LauncherStoreProvider = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const [playerProfiles, setPlayerProfiles] = useState<PlayerProfile[]>([]);
  const [gameProfiles, setGameProfiles] = useState<GameProfile[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.playerProfiles.list(),
      api.gameProfiles.list()
    ])
      .then(([players, games]) => {
        if (!isMounted) return;
        setPlayerProfiles(players);
        setGameProfiles(games);
        setSelectedPlayerId((prev) => prev || players[0]?.id || "");
        setSelectedGameId((prev) => prev || games[0]?.id || "");
      })
      .catch(() => {
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPlayerId && playerProfiles.length) {
      setSelectedPlayerId(playerProfiles[0].id);
    }
  }, [playerProfiles, selectedPlayerId]);

  useEffect(() => {
    if (!selectedGameId && gameProfiles.length) {
      setSelectedGameId(gameProfiles[0].id);
    }
  }, [gameProfiles, selectedGameId]);

  const addPlayerProfile = useCallback(async (nickname: string, authDomain?: AuthDomain) => {
    const trimmed = nickname.trim();
    if (!trimmed) return;

    try {
      const profile: PlayerProfile = {
        id: "",
        nickname: trimmed,
        authDomain
      };
      const created = await api.playerProfiles.create(profile);
      setPlayerProfiles((prev) => [created, ...prev]);
      setSelectedPlayerId(created.id);
    } catch (error) {
      throw error;
    }
  }, []);

  const updatePlayerProfile = useCallback(
    async (id: string, patch: Partial<PlayerProfile>) => {
      try {
        const updated = await api.playerProfiles.update(id, patch);
        setPlayerProfiles((prev) =>
          prev.map((item) => (item.id === id ? updated : item))
        );
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const syncPlayerProfile = useCallback((profile: PlayerProfile) => {
    setPlayerProfiles((prev) => {
      const exists = prev.some((item) => item.id === profile.id);
      if (!exists) {
        return [profile, ...prev];
      }
      return prev.map((item) => (item.id === profile.id ? profile : item));
    });
  }, []);

  const refreshPlayerProfiles = useCallback(async () => {
    try {
      const players = await api.playerProfiles.list();
      setPlayerProfiles(players);
      setSelectedPlayerId((prev) => {
        if (prev && players.some((p) => p.id === prev)) {
          return prev;
        }
        return players[0]?.id ?? "";
      });
    } catch {
    }
  }, []);

  const deletePlayerProfile = useCallback(
    async (id: string) => {
      try {
        await api.playerProfiles.remove(id);
        setPlayerProfiles((prev) => prev.filter((item) => item.id !== id));
        setSelectedPlayerId((prev) => {
          if (prev !== id) return prev;
          const next = playerProfiles.find((item) => item.id !== id);
          return next?.id ?? "";
        });
      } catch (error) {
        throw error;
      }
    },
    [playerProfiles]
  );

  const addGameProfile = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

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
      setGameProfiles((prev) => [created, ...prev]);
      setSelectedGameId(created.id);
    } catch (error) {
      throw error;
    }
  }, []);

  const updateGameProfile = useCallback(
    async (id: string, patch: Partial<GameProfile>) => {
      try {
        const updated = await api.gameProfiles.update(id, patch);
        setGameProfiles((prev) =>
          prev.map((item) => (item.id === id ? updated : item))
        );
      } catch (error) {
        throw error;
      }
    },
    []
  );

  const selectedPlayer = useMemo(
    () => playerProfiles.find((profile) => profile.id === selectedPlayerId),
    [playerProfiles, selectedPlayerId]
  );

  const selectedGame = useMemo(
    () => gameProfiles.find((profile) => profile.id === selectedGameId),
    [gameProfiles, selectedGameId]
  );

  const value = useMemo(
    () => ({
      playerProfiles,
      gameProfiles,
      selectedPlayerId,
      selectedGameId,
      selectedPlayer,
      selectedGame,
      setSelectedPlayerId,
      setSelectedGameId,
      addPlayerProfile,
      updatePlayerProfile,
      syncPlayerProfile,
      refreshPlayerProfiles,
      deletePlayerProfile,
      addGameProfile,
      updateGameProfile
    }),
    [
      playerProfiles,
      gameProfiles,
      selectedPlayerId,
      selectedGameId,
      selectedPlayer,
      selectedGame,
      addPlayerProfile,
      updatePlayerProfile,
      syncPlayerProfile,
      refreshPlayerProfiles,
      deletePlayerProfile,
      addGameProfile,
      updateGameProfile
    ]
  );

  return (
    <LauncherStoreContext.Provider value={value}>
      {children}
    </LauncherStoreContext.Provider>
  );
};

export const useLauncherStore = () => {
  const ctx = useContext(LauncherStoreContext);
  if (!ctx) {
    throw new Error("useLauncherStore must be used within LauncherStoreProvider");
  }
  return ctx;
};
