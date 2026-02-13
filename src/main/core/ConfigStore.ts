import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Logger } from "./Logger";
import { Paths } from "./Paths";
import { JavaManager } from "../services/JavaManager";
import type {
  AuthTokens,
  Settings,
  PlayerProfile,
  GameProfile,
  GameOptions,
  Mod,
  GameVersionBranch
} from "../../shared/types";
import { isThemeId } from "../../shared/theme";

const getDefaultJavaPath = (): string => {
  try {
    return JavaManager.getBundledJavaPath();
  } catch {
    let dataRoot: string;
    if (process.platform === "win32") {
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) {
        dataRoot = path.join(localAppData, "JanLauncher");
      } else {
        const homeDir = os.homedir();
        dataRoot = path.join(homeDir, "AppData", "Local", "JanLauncher");
      }
    } else {
      const xdgDataHome = process.env.XDG_DATA_HOME;
      if (xdgDataHome) {
        dataRoot = path.join(xdgDataHome, "JanLauncher");
      } else {
        const homeDir = os.homedir();
        dataRoot = path.join(homeDir, ".local", "share", "JanLauncher");
      }
    }
    const javaBinaryName = process.platform === "win32" ? "java.exe" : "java";
    return path.join(dataRoot, "java", "current", "bin", javaBinaryName);
  }
};

const DEFAULT_SETTINGS: Settings = {
  installedGameVersion: null,
  launcherLanguage: undefined,
  enableRussianLocalization: false,
  showVersionBranchSelector: false,
  sidebarPosition: "left",
  showLogsNav: false,
  themeId: "classic",
  hasCompletedOnboarding: false
};

const DEFAULT_PLAYER_PROFILES: PlayerProfile[] = [];
const DEFAULT_GAME_PROFILES: GameProfile[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);
const isNullableString = (value: unknown): value is string | null =>
  value === null || isString(value);
const isGameVersionBranch = (value: unknown): value is GameVersionBranch =>
  value === "release" || value === "pre-release" || value === "beta" || value === "alpha";

const isSettings = (value: unknown): value is Settings =>
  isRecord(value) &&
  (value.installedGameVersion === undefined ||
    isNullableString(value.installedGameVersion)) &&
  (value.launcherLanguage === undefined || isString(value.launcherLanguage)) &&
  (value.enableRussianLocalization === undefined ||
    isBoolean(value.enableRussianLocalization)) &&
  (value.showVersionBranchSelector === undefined ||
    isBoolean(value.showVersionBranchSelector)) &&
  (value.sidebarPosition === undefined ||
    value.sidebarPosition === "left" ||
    value.sidebarPosition === "top") &&
  (value.showLogsNav === undefined || isBoolean(value.showLogsNav)) &&
  (value.themeId === undefined || (typeof value.themeId === "string" && value.themeId.length > 0)) &&
  (value.hasCompletedOnboarding === undefined || isBoolean(value.hasCompletedOnboarding));


const isAuthTokens = (value: unknown): value is AuthTokens =>
  isRecord(value) &&
  isString(value.identityToken) &&
  isString(value.sessionToken) &&
  (value.expiresAt === undefined || isNumber(value.expiresAt)) &&
  (value.authUuid === undefined || isString(value.authUuid)) &&
  (value.authUsername === undefined || isString(value.authUsername)) &&
  (value.refreshToken === undefined || isString(value.refreshToken));

const isPlayerProfile = (value: unknown): value is PlayerProfile =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.nickname) &&
  (value.authDomain === undefined || isString(value.authDomain)) &&
  (value.authTokens === undefined || isAuthTokens(value.authTokens)) &&
  (value.authInvalid === undefined || isBoolean(value.authInvalid));

const isGameOptions = (value: unknown): value is GameOptions =>
  isRecord(value) &&
  isNumber(value.minMemory) &&
  isNumber(value.maxMemory) &&
  isStringArray(value.args);

const isMod = (value: unknown): value is Mod =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.version) &&
  isString(value.fileName) &&
  isNumber(value.fileSize) &&
  isString(value.dateInstalled) &&
  isBoolean(value.enabled) &&
  (value.description === undefined || isString(value.description)) &&
  (value.author === undefined || isString(value.author)) &&
  (value.curseForgeId === undefined || isNumber(value.curseForgeId)) &&
  (value.curseForgeFileId === undefined || isNumber(value.curseForgeFileId)) &&
  (value.missing === undefined || isBoolean(value.missing));

const isGameProfile = (value: unknown): value is GameProfile =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isNumber(value.created) &&
  (value.lastUsed === null || isNumber(value.lastUsed)) &&
  Array.isArray(value.mods) &&
  value.mods.every(isMod) &&
  isNullableString(value.javaPath) &&
  isGameOptions(value.gameOptions) &&
  (value.versionBranch === undefined || isGameVersionBranch(value.versionBranch)) &&
  (value.versionId === undefined || isNullableString(value.versionId));

/**
 * Manages application configuration storage.
 * 
 * Handles reading, writing, and validating settings, player profiles, and game profiles
 * with automatic fallback to defaults on validation failures.
 */
export class ConfigStore {
  private static initialized = false;
  private static settings: Settings = DEFAULT_SETTINGS;
  private static playerProfiles: PlayerProfile[] = DEFAULT_PLAYER_PROFILES;
  private static gameProfiles: GameProfile[] = DEFAULT_GAME_PROFILES;

  /**
   * Initializes ConfigStore and loads configuration from disk.
   */
  static init(): void {
    if (this.initialized) return;

    try {
      Paths.configRoot;
    } catch (error) {
      Logger.error("ConfigStore", "Paths not initialized", error);
      throw error;
    }

    this.settings = this.readJsonFile(
      Paths.settingsFile,
      DEFAULT_SETTINGS,
      isSettings,
      "settings.json"
    );

    if (!("themeId" in this.settings) || !isThemeId(this.settings.themeId)) {
      (this.settings as Settings).themeId = "classic";
      this.writeJsonFile(Paths.settingsFile, this.settings);
    }

    if (!("showVersionBranchSelector" in this.settings)) {
      (this.settings as Settings & { showVersionBranchSelector?: boolean }).showVersionBranchSelector =
        false;
      this.writeJsonFile(Paths.settingsFile, this.settings);
    }

    if (!("sidebarPosition" in this.settings)) {
      (this.settings as Settings & { sidebarPosition?: "left" | "top" }).sidebarPosition =
        "left";
      this.writeJsonFile(Paths.settingsFile, this.settings);
    }

    if (!("showLogsNav" in this.settings)) {
      (this.settings as Settings & { showLogsNav?: boolean }).showLogsNav = false;
      this.writeJsonFile(Paths.settingsFile, this.settings);
    }

    if (!("hasCompletedOnboarding" in this.settings)) {
      (this.settings as Settings).hasCompletedOnboarding = false;
      this.writeJsonFile(Paths.settingsFile, this.settings);
    }

    this.playerProfiles = this.readJsonFile(
      Paths.playerProfilesFile,
      DEFAULT_PLAYER_PROFILES,
      (value): value is PlayerProfile[] =>
        Array.isArray(value) && value.every(isPlayerProfile),
      "playerProfiles.json"
    );

    this.gameProfiles = this.readJsonFile(
      Paths.gameProfilesFile,
      DEFAULT_GAME_PROFILES,
      (value): value is GameProfile[] =>
        Array.isArray(value) && value.every(isGameProfile),
      "gameProfiles.json"
    );

    const legacySettings = this.settings as Settings & { javaPath?: string | null; jvmArgs?: string[] };
    let profilesChanged = false;
    for (const profile of this.gameProfiles) {
      if (!profile.javaPath || profile.javaPath.trim() === "") {
        profile.javaPath = legacySettings.javaPath ?? getDefaultJavaPath();
        profilesChanged = true;
      }
      if (!profile.gameOptions.args || profile.gameOptions.args.length === 0) {
        profile.gameOptions.args = legacySettings.jvmArgs ?? [];
        profilesChanged = true;
      }
    }
    if (profilesChanged) {
      this.writeJsonFile(Paths.gameProfilesFile, this.gameProfiles);
    }
    if (legacySettings.javaPath !== undefined || legacySettings.jvmArgs !== undefined) {
      const { javaPath: _j, jvmArgs: _a, ...rest } = legacySettings;
      this.settings = this.sanitizeSettings(rest as Settings, this.settings);
      this.writeJsonFile(Paths.settingsFile, this.settings);
    }

    this.initialized = true;
  }

  static getSettings(): Settings {
    this.ensureInitialized();
    return this.clone(this.settings);
  }

  static updateSettings(patch: Partial<Settings>): void {
    this.ensureInitialized();
    const merged = { ...this.settings, ...patch };
    this.settings = this.sanitizeSettings(merged, this.settings);
    this.writeJsonFile(Paths.settingsFile, this.settings);
  }

  static getPlayerProfiles(): PlayerProfile[] {
    this.ensureInitialized();
    return this.clone(this.playerProfiles);
  }

  static reloadPlayerProfiles(): void {
    this.ensureInitialized();
    this.playerProfiles = this.readJsonFile(
      Paths.playerProfilesFile,
      DEFAULT_PLAYER_PROFILES,
      (value): value is PlayerProfile[] =>
        Array.isArray(value) && value.every(isPlayerProfile),
      "playerProfiles.json"
    );
  }

  static addPlayerProfile(profile: PlayerProfile): void {
    this.ensureInitialized();
    if (!isPlayerProfile(profile)) {
      Logger.warn("ConfigStore", "Invalid player profile");
      return;
    }
    if (this.playerProfiles.some((item) => item.id === profile.id)) {
      Logger.warn("ConfigStore", `Player profile already exists: ${profile.id}`);
      return;
    }
    this.playerProfiles = [...this.playerProfiles, profile];
    this.writeJsonFile(Paths.playerProfilesFile, this.playerProfiles);
  }

  static updatePlayerProfile(id: string, patch: Partial<PlayerProfile>): void {
    this.ensureInitialized();
    const index = this.playerProfiles.findIndex((item) => item.id === id);
    if (index === -1) {
      Logger.warn("ConfigStore", `Player profile not found: ${id}`);
      return;
    }
    const next = { ...this.playerProfiles[index], ...patch };
    if (!isPlayerProfile(next)) {
      Logger.warn("ConfigStore", `Invalid player profile update: ${id}`);
      return;
    }
    const updated = [...this.playerProfiles];
    updated[index] = next;
    this.playerProfiles = updated;
    this.writeJsonFile(Paths.playerProfilesFile, this.playerProfiles);
  }

  static removePlayerProfile(id: string): void {
    this.ensureInitialized();
    const next = this.playerProfiles.filter((item) => item.id !== id);
    if (next.length === this.playerProfiles.length) {
      Logger.warn("ConfigStore", `Player profile not found: ${id}`);
      return;
    }
    this.playerProfiles = next;
    this.writeJsonFile(Paths.playerProfilesFile, this.playerProfiles);
  }

  static getGameProfiles(): GameProfile[] {
    this.ensureInitialized();
    return this.clone(this.gameProfiles);
  }

  static addGameProfile(profile: GameProfile): void {
    this.ensureInitialized();
    if (!isGameProfile(profile)) {
      Logger.warn("ConfigStore", "Invalid game profile");
      return;
    }
    if (this.gameProfiles.some((item) => item.id === profile.id)) {
      Logger.warn("ConfigStore", `Game profile already exists: ${profile.id}`);
      return;
    }
    this.gameProfiles = [...this.gameProfiles, profile];
    this.writeJsonFile(Paths.gameProfilesFile, this.gameProfiles);
  }

  static updateGameProfile(id: string, patch: Partial<GameProfile>): void {
    this.ensureInitialized();
    const index = this.gameProfiles.findIndex((item) => item.id === id);
    if (index === -1) {
      Logger.warn("ConfigStore", `Game profile not found: ${id}`);
      return;
    }
    const next = { ...this.gameProfiles[index], ...patch };
    if (!isGameProfile(next)) {
      Logger.warn("ConfigStore", `Invalid game profile update: ${id}`);
      return;
    }
    const updated = [...this.gameProfiles];
    updated[index] = next;
    this.gameProfiles = updated;
    this.writeJsonFile(Paths.gameProfilesFile, this.gameProfiles);
  }

  static removeGameProfile(id: string): void {
    this.ensureInitialized();
    const next = this.gameProfiles.filter((item) => item.id !== id);
    if (next.length === this.gameProfiles.length) {
      Logger.warn("ConfigStore", `Game profile not found: ${id}`);
      return;
    }
    this.gameProfiles = next;
    this.writeJsonFile(Paths.gameProfilesFile, this.gameProfiles);
  }

  private static sanitizeSettings(
    next: Settings,
    fallback: Settings
  ): Settings {
    return {
      installedGameVersion: isNullableString(next.installedGameVersion)
        ? next.installedGameVersion
        : fallback.installedGameVersion ?? null,
      launcherLanguage: isString(next.launcherLanguage)
        ? next.launcherLanguage
        : fallback.launcherLanguage ?? undefined,
      enableRussianLocalization: isBoolean(next.enableRussianLocalization)
        ? next.enableRussianLocalization
        : fallback.enableRussianLocalization ?? false,
      showVersionBranchSelector: isBoolean(next.showVersionBranchSelector)
        ? next.showVersionBranchSelector
        : fallback.showVersionBranchSelector ?? false,
      sidebarPosition:
        next.sidebarPosition === "left" || next.sidebarPosition === "top"
          ? next.sidebarPosition
          : fallback.sidebarPosition ?? "left",
      showLogsNav: isBoolean(next.showLogsNav)
        ? next.showLogsNav
        : fallback.showLogsNav ?? false,
      themeId: isThemeId(next.themeId) ? next.themeId : fallback.themeId ?? "classic",
      hasCompletedOnboarding: isBoolean(next.hasCompletedOnboarding)
        ? next.hasCompletedOnboarding
        : fallback.hasCompletedOnboarding ?? false
    };
  }

  private static readJsonFile<T>(
    filePath: string,
    fallback: T,
    validator: (value: unknown) => value is T,
    label: string
  ): T {
    try {
      if (!fs.existsSync(filePath)) {
        this.writeJsonFile(filePath, fallback);
        return this.clone(fallback);
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      if (!raw.trim()) {
        Logger.warn("ConfigStore", `${label} is empty, resetting`);
        this.writeJsonFile(filePath, fallback);
        return this.clone(fallback);
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!validator(parsed)) {
        Logger.warn("ConfigStore", `${label} validation failed, resetting`);
        this.writeJsonFile(filePath, fallback);
        return this.clone(fallback);
      }
      return parsed;
    } catch (error) {
      Logger.error("ConfigStore", `Failed to read ${label}`, error);
      this.writeJsonFile(filePath, fallback);
      return this.clone(fallback);
    }
  }

  private static writeJsonFile<T>(filePath: string, data: T): void {
    const tempName = `.tmp-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
    const tempPath = path.join(path.dirname(filePath), `${path.basename(filePath)}${tempName}`);
    try {
      const content = JSON.stringify(data, null, 2);
      fs.writeFileSync(tempPath, content, "utf-8");
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      Logger.error("ConfigStore", `Failed to write ${path.basename(filePath)}`, error);
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (cleanupError) {
        Logger.error("ConfigStore", "Failed to cleanup temp file", cleanupError);
      }
    }
  }

  private static ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("ConfigStore.init() must be called before use.");
    }
  }

  private static clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
