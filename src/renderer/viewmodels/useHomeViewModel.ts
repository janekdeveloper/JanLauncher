import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { useLauncherStore } from "../store/launcherStore";
import type { AuthDomain, PlayerProfile } from "../../shared/types";
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
  const isValidatingRef = useRef(false);
  const isEditingPlayer = Boolean(editingPlayerId);

  const canLaunch = Boolean(selectedPlayerId && selectedGameId && isAccountValid === true);

  const getDefaultAuthDomain = (): AuthDomain => {
    const availableProvider = authProviders.find((p) => p.isAvailable);
    if (availableProvider) {
      return availableProvider.id as AuthDomain;
    }
    return (authProviders[0]?.id as AuthDomain) || "sanasol.ws";
  };

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
    let isMounted = true;
    api.auth
      .getProviders()
      .then((providers) => {
        if (!isMounted) return;
        setAuthProviders(providers);
        setAuthDomainDraft((prev) => {
          if (prev !== null) return prev;
          const defaultProvider = providers.find((p) => p.isAvailable) || providers[0];
          return defaultProvider ? (defaultProvider.id as AuthDomain) : "sanasol.ws";
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setAuthDomainDraft((prev) => prev ?? "sanasol.ws");
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
    authProviders
  };
};
