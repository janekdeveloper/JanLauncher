import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Manages all application paths and directories.
 * 
 * Separates config root (settings, logs) from data root (game files, Java, mods).
 * Automatically creates required directories on initialization.
 */
export class Paths {
  private static initialized = false;

  private static _configRoot = "";
  private static _dataRoot = "";
  private static _configDir = "";
  private static _settingsFile = "";
  private static _playerProfilesFile = "";
  private static _gameProfilesFile = "";
  private static _logsDir = "";
  private static _logsMainDir = "";
  private static _logsRendererDir = "";
  private static _logsGameDir = "";
  private static _gameInstallDir = "";
  private static _gameStagingDir = "";
  private static _gameVersionsDir = "";
  private static _gameCacheDir = "";
  private static _gameProfilesDir = "";
  private static _javaDir = "";
  private static _newsCacheFile = "";
  private static _modTranslationsCacheFile = "";

  /**
   * Initializes Paths and creates required directories.
   * 
   * Must be called after app.whenReady().
   */
  static init(): void {
    if (this.initialized) return;
    if (!app.isReady()) {
      throw new Error("Paths.init() must be called after app.whenReady().");
    }

    this._configRoot = app.getPath("userData");

    if (process.platform === "win32") {
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) {
        this._dataRoot = path.join(localAppData, "JanLauncher");
      } else {
        const userData = app.getPath("userData");
        const appData = path.dirname(userData);
        this._dataRoot = path.join(appData, "Local", "JanLauncher");
      }
    } else {
      const xdgDataHome = process.env.XDG_DATA_HOME;
      if (xdgDataHome) {
        this._dataRoot = path.join(xdgDataHome, "JanLauncher");
      } else {
        const homeDir = os.homedir();
        this._dataRoot = path.join(homeDir, ".local", "share", "JanLauncher");
      }
    }

    this._configDir = path.join(this._configRoot, "config");
    this._settingsFile = path.join(this._configDir, "settings.json");
    this._playerProfilesFile = path.join(this._configDir, "playerProfiles.json");
    this._gameProfilesFile = path.join(this._configDir, "gameProfiles.json");
    this._newsCacheFile = path.join(this._configDir, "news-cache.json");
    this._modTranslationsCacheFile = path.join(this._configDir, "mod-translations-cache.json");

    this._logsDir = path.join(this._configRoot, "logs");
    this._logsMainDir = path.join(this._logsDir, "main");
    this._logsRendererDir = path.join(this._logsDir, "renderer");
    this._logsGameDir = path.join(this._logsDir, "game");

    this._gameInstallDir = path.join(this._dataRoot, "game", "current");
    this._gameStagingDir = path.join(this._dataRoot, "game", "staging");
    this._gameVersionsDir = path.join(this._dataRoot, "game", "versions");
    this._gameCacheDir = path.join(this._dataRoot, "game", "cache");
    this._gameProfilesDir = path.join(this._dataRoot, "game-profiles");
    this._javaDir = path.join(this._dataRoot, "java");

    const directories = [
      this._configRoot,
      this._configDir,
      this._logsDir,
      this._logsMainDir,
      this._logsRendererDir,
      this._logsGameDir,
      this._dataRoot,
      this._gameInstallDir,
      this._gameStagingDir,
      this._gameVersionsDir,
      this._gameCacheDir,
      this._gameProfilesDir,
      this._javaDir
    ];

    directories.forEach((dir) => {
      fs.mkdirSync(dir, { recursive: true });
    });

    this.initialized = true;
  }

  private static ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("Paths.init() must be called before using Paths.");
    }
  }

  static get configRoot(): string {
    this.ensureInitialized();
    return this._configRoot;
  }

  static get dataRoot(): string {
    this.ensureInitialized();
    return this._dataRoot;
  }

  static get configDir(): string {
    this.ensureInitialized();
    return this._configDir;
  }

  static get settingsFile(): string {
    this.ensureInitialized();
    return this._settingsFile;
  }

  static get playerProfilesFile(): string {
    this.ensureInitialized();
    return this._playerProfilesFile;
  }

  static get gameProfilesFile(): string {
    this.ensureInitialized();
    return this._gameProfilesFile;
  }

  static get newsCacheFile(): string {
    this.ensureInitialized();
    return this._newsCacheFile;
  }

  static get modTranslationsCacheFile(): string {
    this.ensureInitialized();
    return this._modTranslationsCacheFile;
  }

  static get logsDir(): string {
    this.ensureInitialized();
    return this._logsDir;
  }

  static get logsMainDir(): string {
    this.ensureInitialized();
    return this._logsMainDir;
  }

  static get logsRendererDir(): string {
    this.ensureInitialized();
    return this._logsRendererDir;
  }

  static get logsGameDir(): string {
    this.ensureInitialized();
    return this._logsGameDir;
  }

  static get gameInstallDir(): string {
    this.ensureInitialized();
    return this._gameInstallDir;
  }

  static get gameStagingDir(): string {
    this.ensureInitialized();
    return this._gameStagingDir;
  }

  static get gameVersionsDir(): string {
    this.ensureInitialized();
    return this._gameVersionsDir;
  }

  static get gameCacheDir(): string {
    this.ensureInitialized();
    return this._gameCacheDir;
  }

  static get gameProfilesDir(): string {
    this.ensureInitialized();
    return this._gameProfilesDir;
  }

  static gameProfileDir(profileId: string): string {
    this.ensureInitialized();
    return path.join(this._gameProfilesDir, profileId);
  }

  static gameProfileModsDir(profileId: string): string {
    return path.join(this.gameProfileDir(profileId), "UserData", "Mods");
  }

  static async getModsPath(gameProfileId: string): Promise<string> {
    this.ensureInitialized();
    const modsDir = this.gameProfileModsDir(gameProfileId);
    fs.mkdirSync(modsDir, { recursive: true });
    return modsDir;
  }

  static get javaDir(): string {
    this.ensureInitialized();
    return this._javaDir;
  }

  /**
   * Gets game installation directory.
   */
  static getGameDir(): string {
    this.ensureInitialized();
    return this._gameVersionsDir;
  }

  static getGameVersionDir(branch: string, versionId: string): string {
    this.ensureInitialized();
    return path.join(this._gameVersionsDir, branch, versionId);
  }

  /**
   * Gets UserData directory for a game profile.
   */
  static getUserDataDir(gameProfileId: string): string {
    this.ensureInitialized();
    return path.join(this.gameProfileDir(gameProfileId), "UserData");
  }

  /**
   * Finds client executable in game directory.
   * 
   * Searches common locations and executable names for the game client.
   */
  static findClientExecutable(gameDir: string): string | null {
    this.ensureInitialized();
    const candidates = this.getExecutableCandidates(gameDir);
    for (const candidate of candidates) {
      if (this.isExecutableFile(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private static getExecutableCandidates(root: string): string[] {
    const winCandidates = ["Hytale.exe", "HytaleClient.exe", "client.exe", "client.jar"];
    const unixCandidates = [
      "Hytale",
      "HytaleClient",
      "client",
      "client.jar",
      "HytaleClient.jar",
      "Hytale.jar"
    ];
    const names = process.platform === "win32" ? winCandidates : unixCandidates;
    const dirs = [
      root,
      path.join(root, "bin"),
      path.join(root, "client"),
      path.join(root, "Client")
    ];

    const candidates: string[] = [];
    dirs.forEach((dir) => {
      names.forEach((name) => {
        candidates.push(path.join(dir, name));
      });
    });

    return candidates;
  }

  private static isExecutableFile(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return false;

    if (filePath.toLowerCase().endsWith(".jar")) {
      return true;
    }

    if (process.platform === "win32") {
      return true;
    }

    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
}
