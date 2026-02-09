import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Settings } from "../../shared/types";
import { useLauncherStore } from "../store/launcherStore";

const MIN_MEMORY_MB = 2048;
const DEFAULT_MAX_MEMORY_MB = 16384;

export const useSettingsViewModel = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const { selectedGameId, gameProfiles, updateGameProfile } = useLauncherStore();

  const selectedGame = selectedGameId
    ? gameProfiles.find((item) => item.id === selectedGameId)
    : null;
  
  const [memoryLimit, setMemoryLimit] = useState<number>(DEFAULT_MAX_MEMORY_MB);
  const [memory, setMemory] = useState(
    selectedGame?.gameOptions?.maxMemory ?? 4096
  );

  useEffect(() => {
    setMemory(prev => {
      const next = selectedGame?.gameOptions?.maxMemory ?? 4096;
      return next > 0 ? next : prev;
    });
  }, [selectedGameId, selectedGame?.gameOptions?.maxMemory]);

  useEffect(() => {
    let isMounted = true;

    api.system
      .getTotalMemoryMB()
      .then((totalMb) => {
        if (!isMounted) return;
        const clampedTotal =
          Number.isFinite(totalMb) && totalMb > 0 ? totalMb : DEFAULT_MAX_MEMORY_MB;
        const maxFromSystem = Math.max(
          MIN_MEMORY_MB,
          Math.floor(clampedTotal / 512) * 512
        );
        setMemoryLimit(maxFromSystem);
        setMemory((prev) => {
          const next = prev || MIN_MEMORY_MB;
          return Math.min(Math.max(next, MIN_MEMORY_MB), maxFromSystem);
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setMemoryLimit(DEFAULT_MAX_MEMORY_MB);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
    const clamped = Math.min(
      Math.max(nextMemory, MIN_MEMORY_MB),
      memoryLimit || DEFAULT_MAX_MEMORY_MB
    );
    setMemory(clamped);

    if (selectedGameId) {
      const selectedGame = gameProfiles.find((item) => item.id === selectedGameId);
      if (selectedGame) {
        const nextGameOptions = {
          ...selectedGame.gameOptions,
          maxMemory: clamped
        };
        void updateGameProfile(selectedGameId, { gameOptions: nextGameOptions });
      }
    }
  };

  const updateJvmArgs = (jvmArgs: string) => {
    const argsArray = jvmArgs.trim() ? jvmArgs.trim().split(/\s+/) : [];
    setSettings((prev) => (prev ? { ...prev, jvmArgs: argsArray } : prev));
  };

  const updateRussianLocalization = (enabled: boolean) => {
    setSettings((prev) => (prev ? { ...prev, enableRussianLocalization: enabled } : prev));
  };

  const updateLauncherLanguage = (language: string) => {
    setSettings((prev) => (prev ? { ...prev, launcherLanguage: language } : prev));
  };

  const jvmArgsString = settings?.jvmArgs.join(" ") || "";

  const updateShowVersionBranchSelector = (enabled: boolean) => {
    setSettings((prev) =>
      prev ? { ...prev, showVersionBranchSelector: enabled } : prev
    );
    void api.settings.update({ showVersionBranchSelector: enabled });
    try {
      window.dispatchEvent(
        new CustomEvent("janlauncher:settings-updated", {
          detail: { showVersionBranchSelector: enabled }
        })
      );
    } catch {
      // No-op in non-browser environments
    }
  };

  const save = async (currentLanguage?: string) => {
    if (!settings) return;
    const settingsToSave = currentLanguage
      ? { ...settings, launcherLanguage: currentLanguage }
      : settings;
    await api.settings.update(settingsToSave);
  };

  return {
    settings,
    memory,
    memoryLimit,
    jvmArgsString,
    updateJavaPath,
    updateMemory,
    updateJvmArgs,
    updateRussianLocalization,
    updateLauncherLanguage,
    updateShowVersionBranchSelector,
    save
  };
};
