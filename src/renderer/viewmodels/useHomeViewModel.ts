import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { useLauncherStore } from "../store/launcherStore";
import type {
  AuthDomain,
  PlayerProfile,
  GameVersionBranch,
  GameVersionInfo,
  Settings
} from "../../shared/types";
import type {
  AuthProviderInfo,
  AuthSession,
  AccountValidationResult
} from "../../main/core/auth/auth.types";
import { AccountState } from "../../main/core/auth/auth.types";

export const useHomeViewModel = () => {
  const {
    playerProfiles,
    gameProfiles,
    selectedPlayerId,
    setSelectedPlayerId,
    selectedGameId,
    setSelectedGameId,
    selectedPlayer,
    selectedGame,
    addPlayerProfile,
    addGameProfile,
    updatePlayerProfile,
    deletePlayerProfile,
    syncPlayerProfile,
    refreshPlayerProfiles
  } = useLauncherStore();
  const [isLaunching, setIsLaunching] = useState(false);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installCompleted, setInstallCompleted] = useState(false);
  const [installProgress, setInstallProgress] = useState<{
    message: string;
    percent?: number;
  } | null>(null);
  const [playerDraft, setPlayerDraft] = useState("");
  const [gameDraft, setGameDraft] = useState("");
  const [authDomainDraft, setAuthDomainDraft] = useState<AuthDomain | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [isAccountValid, setIsAccountValid] = useState<boolean | null>(null);
  const [isValidatingAccount, setIsValidatingAccount] = useState(false);
  const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([]);
  const [versionBranch, setVersionBranch] = useState<GameVersionBranch>("release");
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [availableVersions, setAvailableVersions] = useState<GameVersionInfo[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsLoadingAvailable, setVersionsLoadingAvailable] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [versionInstallProgress, setVersionInstallProgress] = useState<{
    message: string;
    percent?: number;
  } | null>(null);
  const [isVersionInstalling, setIsVersionInstalling] = useState(false);
  const [showVersionBranchSelector, setShowVersionBranchSelector] = useState(false);
  const isValidatingRef = useRef(false);
  const isEditingPlayer = Boolean(editingPlayerId);

  const canLaunch = Boolean(
    selectedPlayerId &&
      selectedGameId &&
      isAccountValid === true &&
      activeVersionId
  );

  const getDefaultAuthDomain = (): AuthDomain => {
    const availableProvider = authProviders.find((p) => p.isAvailable);
    if (availableProvider) {
      return availableProvider.id as AuthDomain;
    }
    return (authProviders[0]?.id as AuthDomain) || "";
  };

  useEffect(() => {
    let isMounted = true;

    api.settings
      .get()
      .then((data) => {
        if (!isMounted) return;
        setShowVersionBranchSelector(
          data.showVersionBranchSelector ?? false
        );
      })
      .catch(() => {
        if (!isMounted) return;
        setShowVersionBranchSelector(false);
      });

    const handleSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<Partial<Settings>>;
      if (
        Object.prototype.hasOwnProperty.call(
          customEvent.detail ?? {},
          "showVersionBranchSelector"
        )
      ) {
        setShowVersionBranchSelector(
          Boolean(customEvent.detail?.showVersionBranchSelector)
        );
      }
    };

    window.addEventListener("janlauncher:settings-updated", handleSettingsUpdated);

    return () => {
      isMounted = false;
      window.removeEventListener(
        "janlauncher:settings-updated",
        handleSettingsUpdated
      );
    };
  }, []);

  useEffect(() => {
    const cleanupStdout = api.gameLauncher.onStdout((line) => {
    });

    const cleanupStderr = api.gameLauncher.onStderr((line) => {
    });

    const cleanupError = api.gameLauncher.onError((message) => {
      setErrorMessage(message);
      setErrorModalOpen(true);
      setIsLaunching(false);
    });

    return () => {
      cleanupStdout();
      cleanupStderr();
      cleanupError();
    };
  }, []);

  useEffect(() => {
    const cleanupProgress = api.gameInstaller.onProgress((progress) => {
      setInstallProgress(progress);
      setIsInstalling(true);
      setInstallCompleted(false);
      if (!errorModalOpen) {
        setErrorModalOpen(true);
      }
      if (!errorMessage) {
        setErrorMessage("Game is not installed");
      }
      if (progress.percent !== undefined && progress.percent >= 100) {
        setIsInstalling(false);
        setInstallCompleted(true);
      }
    });

    const cleanupError = api.gameInstaller.onError((message) => {
      setErrorMessage(message);
      setErrorModalOpen(true);
      setIsInstalling(false);
      setInstallCompleted(false);
      setInstallProgress(null);
    });

    return () => {
      cleanupProgress();
      cleanupError();
    };
  }, []);

  useEffect(() => {
    const cleanupProgress = api.versions.onProgress((progress) => {
      setVersionInstallProgress(progress);
      setIsVersionInstalling(true);
      if (progress.percent !== undefined && progress.percent >= 100) {
        setIsVersionInstalling(false);
      }
    });

    const cleanupError = api.versions.onError((message) => {
      setVersionsError(message);
      setIsVersionInstalling(false);
      setVersionInstallProgress(null);
    });

    return () => {
      cleanupProgress();
      cleanupError();
    };
  }, []);

  useEffect(() => {
    if (!selectedGameId) {
      setActiveVersionId(null);
      return;
    }
    api.versions
      .getActive(selectedGameId)
      .then((active) => {
        const branchToUse: GameVersionBranch = showVersionBranchSelector
          ? active.branch
          : "release";
        setVersionBranch(branchToUse);
        setActiveVersionId(active.versionId ?? null);
      })
      .catch((error) => {
        setVersionsError(error instanceof Error ? error.message : "Failed to load active version");
      });
  }, [selectedGameId, showVersionBranchSelector]);

  useEffect(() => {
    if (!versionBranch) return;
    
    let isMounted = true;
    setVersionsError(null);
    
    const mergeVersions = (installed: GameVersionInfo[], available: GameVersionInfo[]): GameVersionInfo[] => {
      const merged = new Map<string, GameVersionInfo>();
      
      installed.forEach((version) => {
        merged.set(version.id, { ...version, installed: true, localOnly: true });
      });
      
      available.forEach((version) => {
        const existing = merged.get(version.id);
        if (existing) {
          merged.set(version.id, {
            ...version,
            installed: true,
            localOnly: false
          });
        } else {
          merged.set(version.id, {
            ...version,
            installed: false,
            localOnly: false
          });
        }
      });
      
      const result = Array.from(merged.values());
      
      const latest = available.find((v) => v.isLatest);
      if (latest) {
        result.forEach((v) => {
          if (v.id === latest.id) {
            v.isLatest = true;
          } else {
            v.isLatest = false;
          }
        });
      }
      
      return result.sort((a, b) => b.version - a.version);
    };
    
    const loadInstalledFirst = async () => {
      try {
        const installed = await api.versions.getInstalledAsInfo(versionBranch);
        if (!isMounted) return;
        
        setAvailableVersions(installed);
      } catch (error) {
        if (!isMounted) return;
        console.warn("[HomeViewModel] Failed to load installed versions", error);
        setAvailableVersions([]);
      }
    };
    
    const loadAvailableInBackground = async () => {
      setVersionsLoadingAvailable(true);
      try {
        const available = await api.versions.getAvailable(versionBranch);
        if (!isMounted) return;
        
        setAvailableVersions((current) => {
          const installed = current.filter((v) => v.installed);
          return mergeVersions(installed, available);
        });
      } catch (error) {
        if (!isMounted) return;
        console.warn("[HomeViewModel] Failed to load available versions", error);
        setVersionsError(error instanceof Error ? error.message : "Failed to load available versions");
      } finally {
        if (isMounted) {
          setVersionsLoadingAvailable(false);
        }
      }
    };
    
    loadInstalledFirst().then(() => {
      loadAvailableInBackground();
    });
    
    return () => {
      isMounted = false;
    };
  }, [versionBranch]);

  useEffect(() => {
    let isMounted = true;
    api.auth
      .getProviders()
      .then((providers) => {
        if (!isMounted) return;
        setAuthProviders(providers);
        setAuthDomainDraft((prev) => {
          if (prev !== null) return prev;
          const defaultProvider = providers.find((p) => p.isAvailable) || providers[0];
          return defaultProvider ? (defaultProvider.id as AuthDomain) : null;
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setAuthDomainDraft((prev) => prev ?? null);
      });
    
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPlayerId) {
      setIsAccountValid(null);
      return;
    }

    if (isValidatingRef.current) {
      return;
    }

    setIsValidatingAccount(true);
    setIsAccountValid(null);
    isValidatingRef.current = true;

    let isCancelled = false;

    api.auth
      .validateAccount(selectedPlayerId)
      .then((result: AccountValidationResult) => {
        if (isCancelled) return;

        const isValid = result.state === AccountState.VALID && result.canLaunch;
        setIsAccountValid(isValid);

        const currentPlayer = playerProfiles.find((p) => p.id === selectedPlayerId);
        if (!currentPlayer) return;

        if (result.session) {
          syncPlayerProfile({
            ...currentPlayer,
            authDomain: result.session.providerId as AuthDomain,
            authTokens: {
              identityToken: result.session.identityToken,
              sessionToken: result.session.sessionToken
            },
            authInvalid: !isValid
          });
        } else {
          syncPlayerProfile({
            ...currentPlayer,
            authInvalid: !isValid
          });
        }
      })
      .catch(() => {
        if (isCancelled) return;

        setIsAccountValid(false);
        const currentPlayer = playerProfiles.find((p) => p.id === selectedPlayerId);
        if (currentPlayer) {
          syncPlayerProfile({
            ...currentPlayer,
            authInvalid: true
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
        isValidatingRef.current = false;
        setIsValidatingAccount(false);
        }
      });

    return () => {
      isCancelled = true;
      isValidatingRef.current = false;
    };
  }, [selectedPlayerId]);

  const launch = async () => {
    if (!canLaunch || !selectedPlayerId || !selectedGameId) return;

    setIsLaunching(true);
    try {
      await api.gameLauncher.launch({
        playerProfileId: selectedPlayerId,
        gameProfileId: selectedGameId
      });
      setIsLaunching(false);
    } catch (error) {
      setIsLaunching(false);
    }
  };

  const openPlayerModal = () => setIsPlayerModalOpen(true);
  const closePlayerModal = () => {
    setIsPlayerModalOpen(false);
    setPlayerDraft("");
    setAuthDomainDraft(getDefaultAuthDomain());
    setEditingPlayerId(null);
  };

  const openGameModal = () => setIsGameModalOpen(true);
  const closeGameModal = () => {
    setIsGameModalOpen(false);
    setGameDraft("");
  };

  const createPlayerProfile = () => {
    if (!playerDraft.trim()) return;
    const selectedAuthDomain = authDomainDraft ?? getDefaultAuthDomain();
    if (editingPlayerId) {
      updatePlayerProfile(editingPlayerId, {
        nickname: playerDraft.trim(),
        authDomain: selectedAuthDomain
      });
    } else {
      addPlayerProfile(playerDraft, selectedAuthDomain);
    }
    closePlayerModal();
  };

  const openEditPlayerModal = (id: string) => {
    const profile = playerProfiles.find((item) => item.id === id);
    if (!profile) return;
    setEditingPlayerId(id);
    setPlayerDraft(profile.nickname);
    setAuthDomainDraft(profile.authDomain ?? getDefaultAuthDomain());
    setIsPlayerModalOpen(true);
  };

  const openDeleteConfirm = (id: string) => {
    setDeletingPlayerId(id);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setDeletingPlayerId(null);
  };

  const confirmDeletePlayer = () => {
    if (deletingPlayerId) {
      deletePlayerProfile(deletingPlayerId);
      closeDeleteConfirm();
    }
  };

  const createGameProfile = () => {
    if (!gameDraft.trim()) return;
    addGameProfile(gameDraft);
    closeGameModal();
  };

  const closeErrorModal = () => {
    if (!isInstalling) {
      setErrorModalOpen(false);
      setErrorMessage(null);
      setInstallProgress(null);
      setInstallCompleted(false);
    }
  };

  const handleInstallGame = async () => {
    if (!selectedGameId || isInstalling) return;

    setIsInstalling(true);
    setInstallCompleted(false);
    setInstallProgress({ message: "Starting installation...", percent: 0 });
    setErrorModalOpen(true);
    setErrorMessage("Game is not installed");

    try {
      await api.gameInstaller.install({
        gameProfileId: selectedGameId
      });
      setIsInstalling(false);
      setInstallCompleted(true);
    } catch (error) {
      setIsInstalling(false);
    }
  };

  const isGameNotInstalled = errorMessage === "Game is not installed";

  const refreshVersions = async (branchOverride?: GameVersionBranch) => {
    const targetBranch = branchOverride ?? versionBranch;
    if (!targetBranch) return;
    
    setVersionsError(null);
    
    const mergeVersions = (installed: GameVersionInfo[], available: GameVersionInfo[]): GameVersionInfo[] => {
      const merged = new Map<string, GameVersionInfo>();
      
      installed.forEach((version) => {
        merged.set(version.id, { ...version, installed: true, localOnly: true });
      });
      
      available.forEach((version) => {
        const existing = merged.get(version.id);
        if (existing) {
          merged.set(version.id, {
            ...version,
            installed: true,
            localOnly: false
          });
        } else {
          merged.set(version.id, {
            ...version,
            installed: false,
            localOnly: false
          });
        }
      });
      
      const result = Array.from(merged.values());
      
      const latest = available.find((v) => v.isLatest);
      if (latest) {
        result.forEach((v) => {
          if (v.id === latest.id) {
            v.isLatest = true;
          } else {
            v.isLatest = false;
          }
        });
      }
      
      return result.sort((a, b) => b.version - a.version);
    };
    
    try {
      const [installed, available] = await Promise.all([
        api.versions.getInstalledAsInfo(targetBranch),
        api.versions.getAvailable(targetBranch)
      ]);
      setAvailableVersions(mergeVersions(installed, available));
    } catch (error) {
      setVersionsError(error instanceof Error ? error.message : "Failed to load versions");
      try {
        const installed = await api.versions.getInstalledAsInfo(targetBranch);
        setAvailableVersions(installed);
      } catch (installedError) {
        setAvailableVersions([]);
      }
    }
  };

  const setActiveBranch = async (branch: GameVersionBranch) => {
    if (!selectedGameId) return;
    setVersionsError(null);
    setVersionBranch(branch);
    setActiveVersionId(null);
    await api.versions.setActive({
      profileId: selectedGameId,
      branch,
      versionId: null
    });
  };

  const setActiveVersion = async (versionId: string) => {
    if (!selectedGameId) return;
    setVersionsError(null);
    await api.versions.setActive({
      profileId: selectedGameId,
      branch: versionBranch,
      versionId
    });
    setActiveVersionId(versionId);
  };

  const installVersion = async (versionId: string) => {
    setVersionsError(null);
    setIsVersionInstalling(true);
    setVersionInstallProgress({ message: "Starting installation...", percent: 0 });
    try {
      await api.versions.install({ branch: versionBranch, versionId });
      await refreshVersions();
    } finally {
      setIsVersionInstalling(false);
    }
  };

  const removeVersion = async (versionId: string) => {
    setVersionsError(null);
    try {
      await api.versions.remove({ branch: versionBranch, versionId });
      await refreshVersions();
    } catch (error) {
      setVersionsError(error instanceof Error ? error.message : "Failed to remove version");
    }
  };

  return {
    playerProfiles,
    gameProfiles,
    selectedPlayerId,
    setSelectedPlayerId,
    selectedGameId,
    setSelectedGameId,
    isLaunching,
    launch,
    selectedPlayer,
    selectedGame,
    canLaunch,
    isPlayerModalOpen,
    isGameModalOpen,
    playerDraft,
    gameDraft,
    setPlayerDraft,
    setGameDraft,
    authDomainDraft,
    setAuthDomainDraft,
    openPlayerModal,
    closePlayerModal,
    openEditPlayerModal,
    openDeleteConfirm,
    deleteConfirmOpen,
    deletingPlayerId,
    closeDeleteConfirm,
    confirmDeletePlayer,
    openGameModal,
    closeGameModal,
    createPlayerProfile,
    createGameProfile,
    isEditingPlayer,
    errorModalOpen,
    errorMessage,
    closeErrorModal,
    isInstalling,
    installCompleted,
    installProgress,
    handleInstallGame,
    isGameNotInstalled,
    isAccountValid,
    isValidatingAccount,
    refreshPlayerProfiles,
    authProviders,
    versionBranch,
    activeVersionId,
    availableVersions,
    versionsLoading,
    versionsLoadingAvailable,
    versionsError,
    setVersionsError,
    versionInstallProgress,
    isVersionInstalling,
    showVersionBranchSelector,
    setActiveBranch,
    setActiveVersion,
    installVersion,
    removeVersion
  };
};
