export type AuthTokens = {
  identityToken: string;
  sessionToken: string;
};

export type PlayerProfile = {
  id: string;
  nickname: string;
  authDomain?: AuthDomain;
  authTokens?: AuthTokens;
  authInvalid?: boolean;
};

export type AuthDomain = "hytale.com" | "auth.sanasol.ws";

export type GameOptions = {
  minMemory: number;
  maxMemory: number;
  args: string[];
};

export type GameVersionBranch = "release" | "pre-release" | "beta" | "alpha";

export type ActiveGameVersion = {
  branch: GameVersionBranch;
  versionId: string | null;
};

export type GameVersionInfo = {
  id: string;
  branch: GameVersionBranch;
  version: number;
  label: string;
  isLatest: boolean;
  installed: boolean;
  localOnly?: boolean;
};

export type InstalledGameVersion = {
  id: string;
  branch: GameVersionBranch;
  version: number;
  installedAt: string;
  sizeBytes?: number;
};

export type Mod = {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
  fileName: string;
  fileSize: number;
  dateInstalled: string;
  curseForgeId?: number;
  curseForgeFileId?: number;
  missing?: boolean;
};

export type GameProfile = {
  id: string;
  name: string;
  created: number;
  lastUsed: number | null;
  mods: Mod[];
  javaPath: string | null;
  gameOptions: GameOptions;
  versionBranch?: GameVersionBranch;
  versionId?: string | null;
};

export type Settings = {
  javaPath: string | null;
  jvmArgs: string[];
  installedGameVersion?: string | null;
  launcherLanguage?: string;
  enableRussianLocalization?: boolean;
};

export type GameStatus = "idle" | "ready" | "running" | "error";

export type LogLevel = "info" | "warn" | "error" | "debug";

export type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
};

export type CurseForgeMod = {
  id: number;
  name: string;
  summary: string;
  authors: Array<{ name: string; url: string }>;
  latestFilesIndexes: Array<{
    gameVersion: string;
    fileId: number;
    filename: string;
  }>;
  dateModified: string;
  dateCreated?: string;
  downloadCount: number;
  logo?: {
    thumbnailUrl?: string;
    url?: string;
  };
  websiteUrl?: string;
  slug?: string;
};

export type CurseForgeSearchResult = {
  data: CurseForgeMod[];
  pagination: {
    index: number;
    pageSize: number;
    resultCount: number;
    totalCount: number;
  };
};

export type NewsArticle = {
  title: string;
  description: string;
  destUrl: string;
  imageUrl: string;
  date?: string;
};
