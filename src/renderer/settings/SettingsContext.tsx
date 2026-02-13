import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
import type { GameProfile, Settings } from "../../shared/types";

type SettingsContextValue = {
  settings: Settings | null;
  gameProfiles: GameProfile[];
  isLoading: boolean;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  refreshGameProfiles: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const useSettingsContext = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (ctx === undefined) {
    throw new Error("useSettingsContext must be used within SettingsProvider");
  }
  return ctx;
};

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gameProfiles, setGameProfiles] = useState<GameProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([api.settings.get(), api.gameProfiles.list()])
      .then(([s, profiles]) => {
        if (!isMounted) return;
        setSettings(s);
        setGameProfiles(profiles);
      })
      .catch(() => {
        if (!isMounted) return;
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = api.settings.onUpdated((patch) => {
      setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    });
    return unsubscribe;
  }, []);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
    await api.settings.update(patch);
  }, []);

  const refreshGameProfiles = useCallback(async () => {
    const profiles = await api.gameProfiles.list();
    setGameProfiles(profiles);
  }, []);

  const value: SettingsContextValue = {
    settings,
    gameProfiles,
    isLoading,
    updateSettings,
    refreshGameProfiles
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
