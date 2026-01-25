import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Settings } from "../../shared/types";
import { useLauncherStore } from "../store/launcherStore";

export const useSettingsViewModel = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const { selectedGameId, gameProfiles, updateGameProfile } = useLauncherStore();

  const selectedGame = selectedGameId
    ? gameProfiles.find((item) => item.id === selectedGameId)
    : null;
  
  const [memory, setMemory] = useState(
    selectedGame?.gameOptions?.maxMemory ?? 4096
  );

  useEffect(() => {
    setMemory(selectedGame?.gameOptions?.maxMemory ?? 4096);
  }, [selectedGameId, selectedGame?.gameOptions?.maxMemory]);

  useEffect(() => {
    let isMounted = true;
    api.settings.get().then((data) => {
      if (!isMounted) return;
      setSettings(data);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateJavaPath = (javaPath: string) => {
    setSettings((prev) => (prev ? { ...prev, javaPath } : prev));
  };

  const updateMemory = (nextMemory: number) => {
    if (selectedGameId) {
      const selectedGame = gameProfiles.find((item) => item.id === selectedGameId);
      if (selectedGame) {
        const nextGameOptions = {
          ...selectedGame.gameOptions,
          maxMemory: nextMemory
        };
        void updateGameProfile(selectedGameId, { gameOptions: nextGameOptions });
      }
    }
  };

  const updateJvmArgs = (jvmArgs: string) => {
    const argsArray = jvmArgs.trim() ? jvmArgs.trim().split(/\s+/) : [];
    setSettings((prev) => (prev ? { ...prev, jvmArgs: argsArray } : prev));
  };

  const jvmArgsString = settings?.jvmArgs.join(" ") || "";

  const save = async () => {
    if (!settings) return;
    await api.settings.update(settings);
  };

  return {
    settings,
    memory,
    jvmArgsString,
    updateJavaPath,
    updateMemory,
    updateJvmArgs,
    save
  };
};
