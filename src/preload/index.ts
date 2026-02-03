import { contextBridge, ipcRenderer } from "electron";
import type {
  CurseForgeMod,
  CurseForgeSearchResult,
  GameProfile,
  GameStatus,
  Mod,
  NewsArticle,
  PlayerProfile,
  Settings,
  GameVersionBranch,
  GameVersionInfo,
  ActiveGameVersion,
  InstalledGameVersion
} from "../shared/types";
import type {
  AuthProviderInfo,
  AuthProviderId,
  AuthSession,
  LoginParams,
  AccountValidationResult
} from "../main/core/auth/auth.types";

export interface PreloadApi {
  settings: {
    get(): Promise<Settings>;
    update(patch: Partial<Settings>): Promise<void>;
  };
  playerProfiles: {
    list(): Promise<PlayerProfile[]>;
    create(profile: PlayerProfile): Promise<PlayerProfile>;
    update(id: string, patch: Partial<PlayerProfile>): Promise<PlayerProfile>;
    remove(id: string): Promise<void>;
    validate(id: string): Promise<PlayerProfile>;
  };
  gameProfiles: {
    list(): Promise<GameProfile[]>;
    create(profile: GameProfile): Promise<GameProfile>;
    update(id: string, patch: Partial<GameProfile>): Promise<GameProfile>;
    remove(id: string): Promise<void>;
  };
  logs: {
    read(): Promise<string[]>;
    onNewLine(callback: (line: string) => void): () => void;
  };
  gameLauncher: {
    launch(options: { playerProfileId: string; gameProfileId: string }): Promise<void>;
    onStdout(callback: (line: string) => void): () => void;
    onStderr(callback: (line: string) => void): () => void;
    onError(callback: (message: string) => void): () => void;
  };
  gameInstaller: {
    install(options: { gameProfileId: string }): Promise<void>;
    onProgress(callback: (progress: { message: string; percent?: number }) => void): () => void;
    onError(callback: (message: string) => void): () => void;
  };
  mods: {
    search(options: {
      query: string;
      pageIndex?: number;
      pageSize?: number;
      sortField?: "downloads" | "dateCreated" | "dateModified" | "name";
      sortOrder?: "asc" | "desc";
      language?: "ru" | "en" | "uk" | "pl" | "be";
    }): Promise<CurseForgeSearchResult>;
    getDetails(modId: number, language?: "ru" | "en" | "uk" | "pl" | "be"): Promise<CurseForgeMod>;
    loadInstalled(gameProfileId: string, language?: "ru" | "en" | "uk" | "pl" | "be"): Promise<Mod[]>;
    install(options: { gameProfileId: string; modId: number; fileId?: number }): Promise<Mod>;
    toggle(options: { gameProfileId: string; modId: string }): Promise<void>;
    uninstall(options: { gameProfileId: string; modId: string }): Promise<void>;
    openUrl(url: string): Promise<void>;
  };
  versions: {
    getAvailable(branch: GameVersionBranch): Promise<GameVersionInfo[]>;
    getInstalled(branch?: GameVersionBranch): Promise<InstalledGameVersion[]>;
    getInstalledAsInfo(branch?: GameVersionBranch): Promise<GameVersionInfo[]>;
    getActive(profileId: string): Promise<ActiveGameVersion>;
    setActive(options: { profileId: string; branch: GameVersionBranch; versionId: string | null }): Promise<void>;
    install(options: { branch: GameVersionBranch; versionId: string }): Promise<void>;
    remove(options: { branch: GameVersionBranch; versionId: string }): Promise<void>;
    onProgress(callback: (progress: { message: string; percent?: number }) => void): () => void;
    onError(callback: (message: string) => void): () => void;
  };
  news: {
    loadCached(language?: "ru" | "en" | "uk" | "pl" | "be"): Promise<NewsArticle[] | null>;
    refresh(language?: "ru" | "en" | "uk" | "pl" | "be"): Promise<NewsArticle[]>;
    fetch(language?: "ru" | "en" | "uk" | "pl" | "be"): Promise<NewsArticle[]>;
    openUrl(url: string): Promise<void>;
  };
  auth: {
    getProviders(): Promise<AuthProviderInfo[]>;
    login(profileId: string, providerId: AuthProviderId, params: LoginParams): Promise<void>;
    logout(profileId: string): Promise<void>;
    getSession(profileId: string): Promise<AuthSession | null>;
    refreshSession(profileId: string): Promise<AuthSession | null>;
    validateAccount(profileId: string): Promise<AccountValidationResult>;
    getAccountState(profileId: string): Promise<AccountValidationResult>;
    handleAuthError(profileId: string, error: unknown): Promise<AccountValidationResult>;
  };
  translation: {
    clearCache(): Promise<void>;
  };
  paths: {
    openGameDir(): Promise<void>;
    openConfigDir(): Promise<void>;
    openUserDataDir(gameProfileId: string): Promise<void>;
    openLogsDir(): Promise<void>;
  };
  updater: {
    check(): Promise<void>;
    status(): Promise<{
      status: "idle" | "checking" | "update-available" | "downloading" | "downloaded" | "error";
      version?: string;
      progress?: number;
      error?: string;
    }>;
    download(): Promise<void>;
    installOnQuit(): Promise<void>;
    quitAndInstall(): Promise<void>;
    onUpdateAvailable(callback: (data: { version: string; releaseDate?: string; releaseNotes?: string }) => void): () => void;
    onUpdateNotAvailable(callback: () => void): () => void;
    onDownloadProgress(callback: (data: { percent: number; transferred: number; total: number }) => void): () => void;
    onUpdateDownloaded(callback: (data: { version: string; releaseDate?: string; releaseNotes?: string }) => void): () => void;
    onError(callback: (data: { error: string }) => void): () => void;
  };
  system: {
    /**
     * Returns total physical memory in megabytes.
     */
    getTotalMemoryMB(): Promise<number>;
  };
}

const api: PreloadApi = {
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    update: (patch) => ipcRenderer.invoke("settings:update", patch)
  },
  playerProfiles: {
    list: () => ipcRenderer.invoke("playerProfiles:list"),
    create: (profile) => ipcRenderer.invoke("playerProfiles:create", profile),
    update: (id, patch) =>
      ipcRenderer.invoke("playerProfiles:update", id, patch),
    remove: (id) => ipcRenderer.invoke("playerProfiles:remove", id),
    validate: (id) => ipcRenderer.invoke("playerProfiles:validate", id)
  },
  gameProfiles: {
    list: () => ipcRenderer.invoke("gameProfiles:list"),
    create: (profile) => ipcRenderer.invoke("gameProfiles:create", profile),
    update: (id, patch) => ipcRenderer.invoke("gameProfiles:update", id, patch),
    remove: (id) => ipcRenderer.invoke("gameProfiles:remove", id)
  },
  logs: {
    read: () => ipcRenderer.invoke("logs:read"),
    onNewLine: (callback) => {
      const handler = (_event: unknown, line: string) => {
        callback(line);
      };
      ipcRenderer.on("logs:newLine", handler);
      ipcRenderer.invoke("logs:subscribe").catch(() => {
      });
      return () => {
        ipcRenderer.removeListener("logs:newLine", handler);
        ipcRenderer.send("logs:unsubscribe");
      };
    }
  },
  gameLauncher: {
    launch: (options) => ipcRenderer.invoke("game:launch", options),
    onStdout: (callback) => {
      const handler = (_event: unknown, line: string) => {
        callback(line);
      };
      ipcRenderer.on("game:stdout", handler);
      return () => {
        ipcRenderer.removeListener("game:stdout", handler);
      };
    },
    onStderr: (callback) => {
      const handler = (_event: unknown, line: string) => {
        callback(line);
      };
      ipcRenderer.on("game:stderr", handler);
      return () => {
        ipcRenderer.removeListener("game:stderr", handler);
      };
    },
    onError: (callback) => {
      const handler = (_event: unknown, message: string) => {
        callback(message);
      };
      ipcRenderer.on("game:error", handler);
      return () => {
        ipcRenderer.removeListener("game:error", handler);
      };
    }
  },
  gameInstaller: {
    install: (options) => ipcRenderer.invoke("game:install", options),
    onProgress: (callback) => {
      const handler = (_event: unknown, progress: { message: string; percent?: number }) => {
        callback(progress);
      };
      ipcRenderer.on("game:install:progress", handler);
      return () => {
        ipcRenderer.removeListener("game:install:progress", handler);
      };
    },
    onError: (callback) => {
      const handler = (_event: unknown, message: string) => {
        callback(message);
      };
      ipcRenderer.on("game:install:error", handler);
      return () => {
        ipcRenderer.removeListener("game:install:error", handler);
      };
    }
  },
  mods: {
    search: (options) => ipcRenderer.invoke("mods:search", options),
    getDetails: (modId, language) => ipcRenderer.invoke("mods:getDetails", modId, language),
    loadInstalled: (gameProfileId, language) => ipcRenderer.invoke("mods:loadInstalled", gameProfileId, language),
    install: (options) => ipcRenderer.invoke("mods:install", options),
    toggle: (options) => ipcRenderer.invoke("mods:toggle", options),
    uninstall: (options) => ipcRenderer.invoke("mods:uninstall", options),
    openUrl: (url) => ipcRenderer.invoke("mods:openUrl", url)
  },
  versions: {
    getAvailable: (branch) => ipcRenderer.invoke("versions:getAvailable", branch),
    getInstalled: (branch?: GameVersionBranch) => ipcRenderer.invoke("versions:getInstalled", branch),
    getInstalledAsInfo: (branch?: GameVersionBranch) => ipcRenderer.invoke("versions:getInstalledAsInfo", branch),
    getActive: (profileId: string) => ipcRenderer.invoke("versions:getActive", profileId),
    setActive: (options) => ipcRenderer.invoke("versions:setActive", options),
    install: (options) => ipcRenderer.invoke("versions:install", options),
    remove: (options) => ipcRenderer.invoke("versions:remove", options),
    onProgress: (callback) => {
      const handler = (_event: unknown, progress: { message: string; percent?: number }) => {
        callback(progress);
      };
      ipcRenderer.on("versions:install:progress", handler);
      return () => {
        ipcRenderer.removeListener("versions:install:progress", handler);
      };
    },
    onError: (callback) => {
      const handler = (_event: unknown, message: string) => {
        callback(message);
      };
      ipcRenderer.on("versions:install:error", handler);
      return () => {
        ipcRenderer.removeListener("versions:install:error", handler);
      };
    }
  },
  news: {
    loadCached: (language?: "ru" | "en" | "uk" | "pl" | "be") =>
      ipcRenderer.invoke("news:loadCached", language),
    refresh: (language?: "ru" | "en" | "uk" | "pl" | "be") =>
      ipcRenderer.invoke("news:refresh", language),
    fetch: (language?: "ru" | "en" | "uk" | "pl" | "be") =>
      ipcRenderer.invoke("news:fetch", language),
    openUrl: (url) => ipcRenderer.invoke("news:openUrl", url)
  },
  auth: {
    getProviders: () => ipcRenderer.invoke("auth:getProviders"),
    login: (profileId: string, providerId: AuthProviderId, params: LoginParams) =>
      ipcRenderer.invoke("auth:login", profileId, providerId, params),
    logout: (profileId: string) => ipcRenderer.invoke("auth:logout", profileId),
    getSession: (profileId: string) => ipcRenderer.invoke("auth:getSession", profileId),
    refreshSession: (profileId: string) => ipcRenderer.invoke("auth:refreshSession", profileId),
    validateAccount: (profileId: string) => ipcRenderer.invoke("auth:validateAccount", profileId),
    getAccountState: (profileId: string) => ipcRenderer.invoke("auth:getAccountState", profileId),
    handleAuthError: (profileId: string, error: unknown) =>
      ipcRenderer.invoke("auth:handleAuthError", profileId, error)
  },
  translation: {
    clearCache: () => ipcRenderer.invoke("translation:clearCache")
  },
  paths: {
    openGameDir: () => ipcRenderer.invoke("paths:openGameDir"),
    openConfigDir: () => ipcRenderer.invoke("paths:openConfigDir"),
    openUserDataDir: (gameProfileId: string) =>
      ipcRenderer.invoke("paths:openUserDataDir", gameProfileId),
    openLogsDir: () => ipcRenderer.invoke("paths:openLogsDir")
  },
  updater: {
    check: () => ipcRenderer.invoke("updater:check"),
    status: () => ipcRenderer.invoke("updater:status"),
    download: () => ipcRenderer.invoke("updater:download"),
    installOnQuit: () => ipcRenderer.invoke("updater:installOnQuit"),
    quitAndInstall: () => ipcRenderer.invoke("updater:quitAndInstall"),
    onUpdateAvailable: (callback) => {
      const handler = (_event: unknown, data: { version: string; releaseDate?: string; releaseNotes?: string }) => {
        callback(data);
      };
      ipcRenderer.on("updater:update-available", handler);
      return () => {
        ipcRenderer.removeListener("updater:update-available", handler);
      };
    },
    onUpdateNotAvailable: (callback) => {
      const handler = () => {
        callback();
      };
      ipcRenderer.on("updater:update-not-available", handler);
      return () => {
        ipcRenderer.removeListener("updater:update-not-available", handler);
      };
    },
    onDownloadProgress: (callback) => {
      const handler = (_event: unknown, data: { percent: number; transferred: number; total: number }) => {
        callback(data);
      };
      ipcRenderer.on("updater:download-progress", handler);
      return () => {
        ipcRenderer.removeListener("updater:download-progress", handler);
      };
    },
    onUpdateDownloaded: (callback) => {
      const handler = (_event: unknown, data: { version: string; releaseDate?: string; releaseNotes?: string }) => {
        callback(data);
      };
      ipcRenderer.on("updater:update-downloaded", handler);
      return () => {
        ipcRenderer.removeListener("updater:update-downloaded", handler);
      };
    },
    onError: (callback) => {
      const handler = (_event: unknown, data: { error: string }) => {
        callback(data);
      };
      ipcRenderer.on("updater:error", handler);
      return () => {
        ipcRenderer.removeListener("updater:error", handler);
      };
    }
  },
  system: {
    getTotalMemoryMB: () => ipcRenderer.invoke("system:getTotalMemory")
  }
};

contextBridge.exposeInMainWorld("api", api);
