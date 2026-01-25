import type {
  CurseForgeMod,
  CurseForgeSearchResult,
  GameProfile,
  GameStatus,
  Mod,
  NewsArticle,
  PlayerProfile,
  Settings
} from "../../shared/types";
import type {
  AuthProviderInfo,
  AuthProviderId,
  AuthSession,
  LoginParams,
  AccountValidationResult
} from "../../main/core/auth/auth.types";

if (!window.api) {
  throw new Error("window.api is not available. Make sure preload script is loaded.");
}

const apiInstance = window.api;

export const api = {
  settings: {
    get: (): Promise<Settings> => apiInstance.settings.get(),
    update: (patch: Partial<Settings>): Promise<void> =>
      apiInstance.settings.update(patch)
  },
  playerProfiles: {
    list: (): Promise<PlayerProfile[]> => apiInstance.playerProfiles.list(),
    create: (profile: PlayerProfile): Promise<PlayerProfile> =>
      apiInstance.playerProfiles.create(profile),
    update: (
      id: string,
      patch: Partial<PlayerProfile>
    ): Promise<PlayerProfile> => apiInstance.playerProfiles.update(id, patch),
    remove: (id: string): Promise<void> =>
      apiInstance.playerProfiles.remove(id),
    validate: (id: string): Promise<PlayerProfile> =>
      apiInstance.playerProfiles.validate(id)
  },
  gameProfiles: {
    list: (): Promise<GameProfile[]> => apiInstance.gameProfiles.list(),
    create: (profile: GameProfile): Promise<GameProfile> =>
      apiInstance.gameProfiles.create(profile),
    update: (
      id: string,
      patch: Partial<GameProfile>
    ): Promise<GameProfile> => apiInstance.gameProfiles.update(id, patch),
    remove: (id: string): Promise<void> =>
      apiInstance.gameProfiles.remove(id)
  },
  logs: {
    read: (): Promise<string[]> => apiInstance.logs.read(),
    onNewLine: (callback: (line: string) => void): (() => void) =>
      apiInstance.logs.onNewLine(callback)
  },
  gameLauncher: {
    launch: (options: {
      playerProfileId: string;
      gameProfileId: string;
    }): Promise<void> => apiInstance.gameLauncher.launch(options),
    onStdout: (callback: (line: string) => void): (() => void) =>
      apiInstance.gameLauncher.onStdout(callback),
    onStderr: (callback: (line: string) => void): (() => void) =>
      apiInstance.gameLauncher.onStderr(callback),
    onError: (callback: (message: string) => void): (() => void) =>
      apiInstance.gameLauncher.onError(callback)
  },
  gameInstaller: {
    install: (options: {
      gameProfileId: string;
    }): Promise<void> => apiInstance.gameInstaller.install(options),
    onProgress: (
      callback: (progress: { message: string; percent?: number }) => void
    ): (() => void) => apiInstance.gameInstaller.onProgress(callback),
    onError: (callback: (message: string) => void): (() => void) =>
      apiInstance.gameInstaller.onError(callback)
  },
  mods: {
    search: (options: {
      query: string;
      pageIndex?: number;
      pageSize?: number;
      sortField?: "downloads" | "dateCreated" | "dateModified" | "name";
      sortOrder?: "asc" | "desc";
      language?: "ru" | "en" | "uk" | "pl" | "be";
    }): Promise<CurseForgeSearchResult> => apiInstance.mods.search(options),
    getDetails: (modId: number, language?: "ru" | "en" | "uk" | "pl" | "be"): Promise<CurseForgeMod> =>
      (apiInstance.mods.getDetails as (modId: number, language?: "ru" | "en" | "uk" | "pl" | "be") => Promise<CurseForgeMod>)(modId, language),
    loadInstalled: (gameProfileId: string, language?: "ru" | "en" | "uk" | "pl" | "be"): Promise<Mod[]> =>
      (apiInstance.mods.loadInstalled as (gameProfileId: string, language?: "ru" | "en" | "uk" | "pl" | "be") => Promise<Mod[]>)(gameProfileId, language),
    install: (options: {
      gameProfileId: string;
      modId: number;
      fileId?: number;
    }): Promise<Mod> => apiInstance.mods.install(options),
    toggle: (options: {
      gameProfileId: string;
      modId: string;
    }): Promise<void> => apiInstance.mods.toggle(options),
    uninstall: (options: {
      gameProfileId: string;
      modId: string;
    }): Promise<void> => apiInstance.mods.uninstall(options),
    openUrl: (url: string): Promise<void> => apiInstance.mods.openUrl(url)
  },
  news: {
    loadCached: (language?: "ru" | "en" | "uk" | "pl" | "be"): Promise<NewsArticle[] | null> =>
      apiInstance.news.loadCached(language),
    refresh: (language?: "ru" | "en" | "uk" | "pl" | "be"): Promise<NewsArticle[]> =>
      apiInstance.news.refresh(language),
    fetch: (language?: "ru" | "en" | "uk" | "pl" | "be"): Promise<NewsArticle[]> =>
      apiInstance.news.fetch(language),
    openUrl: (url: string): Promise<void> => apiInstance.news.openUrl(url)
  },
  auth: {
    getProviders: (): Promise<AuthProviderInfo[]> => apiInstance.auth.getProviders(),
    login: (
      profileId: string,
      providerId: AuthProviderId,
      params: LoginParams
    ): Promise<void> => apiInstance.auth.login(profileId, providerId, params),
    logout: (profileId: string): Promise<void> => apiInstance.auth.logout(profileId),
    getSession: (profileId: string): Promise<AuthSession | null> =>
      apiInstance.auth.getSession(profileId),
    refreshSession: (profileId: string): Promise<AuthSession | null> =>
      apiInstance.auth.refreshSession(profileId),
    validateAccount: (profileId: string): Promise<AccountValidationResult> =>
      apiInstance.auth.validateAccount(profileId),
    getAccountState: (profileId: string): Promise<AccountValidationResult> =>
      apiInstance.auth.getAccountState(profileId),
    handleAuthError: (profileId: string, error: unknown): Promise<AccountValidationResult> =>
      apiInstance.auth.handleAuthError(profileId, error)
  },
  translation: {
    clearCache: (): Promise<void> => apiInstance.translation.clearCache()
  },
  updater: {
    check: (): Promise<void> => apiInstance.updater.check(),
    status: (): Promise<{
      status: "idle" | "checking" | "update-available" | "downloading" | "downloaded" | "error";
      version?: string;
      progress?: number;
      error?: string;
    }> => apiInstance.updater.status(),
    download: (): Promise<void> => apiInstance.updater.download(),
    installOnQuit: (): Promise<void> => apiInstance.updater.installOnQuit(),
    quitAndInstall: (): Promise<void> => apiInstance.updater.quitAndInstall(),
    onUpdateAvailable: (
      callback: (data: { version: string; releaseDate?: string; releaseNotes?: string }) => void
    ): (() => void) => apiInstance.updater.onUpdateAvailable(callback),
    onUpdateNotAvailable: (callback: () => void): (() => void) =>
      apiInstance.updater.onUpdateNotAvailable(callback),
    onDownloadProgress: (
      callback: (data: { percent: number; transferred: number; total: number }) => void
    ): (() => void) => apiInstance.updater.onDownloadProgress(callback),
    onUpdateDownloaded: (
      callback: (data: { version: string; releaseDate?: string; releaseNotes?: string }) => void
    ): (() => void) => apiInstance.updater.onUpdateDownloaded(callback),
    onError: (callback: (data: { error: string }) => void): (() => void) =>
      apiInstance.updater.onError(callback)
  }
};
