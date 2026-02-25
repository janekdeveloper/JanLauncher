/// <reference types="vite/client" />

import type {
  CurseForgeCategory,
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
  InstalledGameVersion,
  FeaturedServersResponse,
  ServerLaunchOptions
} from "./shared/types";
import type {
  AuthProviderInfo,
  AuthProviderId,
  AuthSession,
  LoginParams,
  AccountValidationResult
} from "./main/core/auth/auth.types";

declare global {
  interface Window {
    api?: {
      openExternal(url: string): Promise<void>;
      app: {
        getAppInfo(): Promise<{ version: string; platform: string }>;
      };
      window: {
        openSettings(): Promise<void>;
      };
      settings: {
        get(): Promise<Settings>;
        update(patch: Partial<Settings>): Promise<void>;
        onUpdated(callback: (patch: Partial<Settings>) => void): () => void;
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
        }): Promise<CurseForgeSearchResult>;
        getDetails(modId: number): Promise<CurseForgeMod>;
        loadInstalled(gameProfileId: string): Promise<Mod[]>;
        getCategories(language?: "ru" | "en" | "uk" | "pl" | "be" | "es"): Promise<CurseForgeCategory[]>;
        getGameVersions(): Promise<string[]>;
        install(options: { gameProfileId: string; modId: number; fileId?: number }): Promise<Mod>;
        toggle(options: { gameProfileId: string; modId: string }): Promise<void>;
        uninstall(options: { gameProfileId: string; modId: string }): Promise<void>;
        openUrl(url: string): Promise<void>;
        enrichProfileModIcons(gameProfileId: string): Promise<void>;
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
        loadCached(language?: "ru" | "en" | "uk" | "pl" | "be" | "es"): Promise<NewsArticle[] | null>;
        refresh(language?: "ru" | "en" | "uk" | "pl" | "be" | "es"): Promise<NewsArticle[]>;
        fetch(language?: "ru" | "en" | "uk" | "pl" | "be" | "es"): Promise<NewsArticle[]>;
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
      servers: {
        getFeatured(): Promise<FeaturedServersResponse>;
        launch(options: ServerLaunchOptions): Promise<void>;
        copyAddress(ip: string, port: number): Promise<void>;
        openAdvertise(url: string): Promise<void>;
        openAdvertiseContact(type: "telegram" | "discord"): Promise<void>;
        open(ip: string, port: number, playerProfileId: string, gameProfileId: string): Promise<void>;
      };
    };
  }
}

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

export {};
