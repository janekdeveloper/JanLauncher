import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import axios from "axios";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";
import { ButlerManager } from "./ButlerManager";
import { JavaManager } from "./JavaManager";
import { ConfigStore } from "../core/ConfigStore";
import { VersionManager } from "./VersionManager";
import { UpdateService } from "../updater/UpdateService";
import type { GameProfile } from "../../shared/types";

const PATCH_BASE_URL = "https://game-patches.hytale.com/patches";
const PATCH_CHANNEL = "release";
const PATCH_BRANCH = "0";

export type InstallProgress = {
  message: string;
  percent?: number;
};

type InstallOptions = {
  profileId: string;
  onProgress?: (p: InstallProgress) => void;
};

type UserDataBackup = {
  relativePath: string;
  sourcePath: string;
};

/**
 * Handles game installation, updates, and repair.
 * 
 * Manages patch downloads, butler integration, and UserData backup/restore.
 */
export class GameInstaller {
  /**
   * Checks if game is installed.
   * 
   * @returns True if game executable is found
   */
  static isGameInstalled(): boolean {
    const currentDir = this.getCurrentDir();
    if (!fs.existsSync(currentDir)) {
      return false;
    }

    const executable = Paths.findClientExecutable(currentDir);
    return executable !== null;
  }

  /**
   * Installs the game.
   * 
   * @param options - Installation options including profile ID and progress callback
   */
  static async installGame(options: InstallOptions): Promise<void> {
    const { profileId, onProgress } = options;
    Logger.info("GameInstaller", "Starting game installation");

    UpdateService.setGameInstalling(true);

    this.reportProgress(onProgress, "Preparing installation", 5);
    await JavaManager.ensureJava();

    this.reportProgress(onProgress, "Ensuring butler", 10);
    await ButlerManager.ensureButler();

    const gameRoot = this.getGameRoot();
    const currentDir = this.getCurrentDir();
    const stagingDir = this.getStagingDir();

    this.prepareDirectory(stagingDir);

    const version = await VersionManager.getLatestVersion();
    const patchFile = await this.downloadPatch(version, onProgress, gameRoot);

    try {
      this.reportProgress(onProgress, "Applying patch", 60);
      await ButlerManager.applyPatch({
        pwrFile: patchFile,
        targetDir: stagingDir,
        onOutput: (line) => {
          Logger.debug("GameInstaller", `butler: ${line}`);
        }
      });

      this.ensureExecutablePermissions(stagingDir);

      const userDataBackupRoot = this.createUserDataBackupRoot(gameRoot);
      const userDataBackups = this.backupUserData(currentDir, userDataBackupRoot);

      this.reportProgress(onProgress, "Finalizing installation", 85);
      this.replaceCurrentWithStaging(currentDir, stagingDir, gameRoot, userDataBackups, userDataBackupRoot);

      VersionManager.setInstalledVersion(version);
      this.reportProgress(onProgress, "Installation completed", 100);
      Logger.info("GameInstaller", `Installation completed, version ${version} saved`);
    } catch (error) {
      Logger.error("GameInstaller", "Installation failed", error);
      throw error;
    } finally {
      UpdateService.setGameInstalling(false);
      this.safeRemoveFile(patchFile);
      this.safeRemoveDir(stagingDir);
    }
  }

  /**
   * Updates the installed game.
   * 
   * @param options - Update options including profile ID and progress callback
   */
  static async updateGame(options: InstallOptions): Promise<void> {
    const { profileId, onProgress } = options;

    if (!this.isGameInstalled()) {
      throw new Error("Game is not installed");
    }

    Logger.info("GameInstaller", "Updating game");

    UpdateService.setGameInstalling(true);

    this.reportProgress(onProgress, "Preparing update", 5);
    await JavaManager.ensureJava();

    this.reportProgress(onProgress, "Ensuring butler", 10);
    await ButlerManager.ensureButler();

    const gameRoot = this.getGameRoot();
    const currentDir = this.getCurrentDir();
    const stagingDir = this.getStagingDir();

    this.prepareDirectory(stagingDir);

    const version = await VersionManager.getLatestVersion();
    const patchFile = await this.downloadPatch(version, onProgress, gameRoot);
    const userDataBackupRoot = this.createUserDataBackupRoot(gameRoot);
    const userDataBackups = this.backupUserData(currentDir, userDataBackupRoot, true);
    const backupDir = this.createCurrentBackupDir(gameRoot);

    try {
      this.reportProgress(onProgress, "Applying patch", 60);
      await ButlerManager.applyPatch({
        pwrFile: patchFile,
        targetDir: stagingDir,
        onOutput: (line) => {
          Logger.debug("GameInstaller", `butler: ${line}`);
        }
      });

      this.ensureExecutablePermissions(stagingDir);

      this.reportProgress(onProgress, "Finalizing update", 85);
      this.swapWithRollback(currentDir, stagingDir, backupDir, userDataBackups, userDataBackupRoot);

      VersionManager.setInstalledVersion(version);
      this.reportProgress(onProgress, "Update completed", 100);
      Logger.info("GameInstaller", `Update completed, version ${version} saved`);
    } catch (error) {
      Logger.error("GameInstaller", "Update failed", error);
      throw error;
    } finally {
      UpdateService.setGameInstalling(false);
      this.safeRemoveFile(patchFile);
      this.safeRemoveDir(stagingDir);
    }
  }

  static async repairGame(options: InstallOptions): Promise<void> {
    const { profileId, onProgress } = options;

    if (!this.isGameInstalled()) {
      throw new Error("Game is not installed");
    }

    Logger.info("GameInstaller", "Repairing game");

    const gameRoot = this.getGameRoot();
    const currentDir = this.getCurrentDir();

    const userDataBackupRoot = this.createUserDataBackupRoot(gameRoot);
    const userDataBackups = this.backupUserData(currentDir, userDataBackupRoot, true);

    this.safeRemoveDir(currentDir);

    try {
      await this.installGame({ profileId, onProgress });
      this.restoreUserData(currentDir, userDataBackupRoot, userDataBackups);
      this.safeRemoveDir(userDataBackupRoot);
      Logger.info("GameInstaller", "Repair completed");
    } catch (error) {
      Logger.error("GameInstaller", "Repair failed", error);
      throw error;
    }
  }

  private static reportProgress(
    onProgress: InstallOptions["onProgress"],
    message: string,
    percent?: number
  ): void {
    if (onProgress) {
      onProgress({ message, percent });
    }
  }

  private static getGameRoot(): string {
    return path.join(Paths.dataRoot, "game");
  }

  private static getCurrentDir(): string {
    return Paths.gameInstallDir;
  }

  private static getStagingDir(): string {
    return Paths.gameStagingDir;
  }

  private static getProfile(profileId: string): GameProfile {
    const profiles = ConfigStore.getGameProfiles();
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) {
      throw new Error(`Game profile not found: ${profileId}`);
    }
    return profile;
  }

  private static prepareDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
    fs.mkdirSync(dirPath, { recursive: true });
  }

  private static mapOs(): "windows" | "linux" | "darwin" {
    switch (process.platform) {
      case "win32":
        return "windows";
      case "linux":
        return "linux";
      case "darwin":
        return "darwin";
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
  }

  private static mapArch(): "amd64" | "arm64" {
    switch (process.arch) {
      case "x64":
        return "amd64";
      case "arm64":
        return "arm64";
      default:
        throw new Error(`Unsupported architecture: ${process.arch}`);
    }
  }

  private static buildPatchUrl(version: string): string {
    const os = this.mapOs();
    const arch = this.mapArch();
    const versionFile = version.endsWith(".pwr") ? version : `${version}.pwr`;
    return `${PATCH_BASE_URL}/${os}/${arch}/${PATCH_CHANNEL}/${PATCH_BRANCH}/${versionFile}`;
  }

  private static async downloadPatch(
    version: string,
    onProgress: InstallOptions["onProgress"],
    gameRoot: string
  ): Promise<string> {
    this.reportProgress(onProgress, "Downloading patch", 30);
    const url = this.buildPatchUrl(version);

    const patchPath = path.join(
      gameRoot,
      `.patch-${Date.now()}-${Math.random().toString(16).slice(2)}.pwr`
    );
    const tempPath = `${patchPath}.download`;

    try {
      const response = await this.requestPatchStream(url);

      fs.mkdirSync(gameRoot, { recursive: true });
      const writer = fs.createWriteStream(tempPath);
      const totalSize = Number(response.headers["content-length"] ?? 0);
      let downloaded = 0;
      let lastReport = 0;

      response.data.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
        if (!totalSize) return;
        const now = Date.now();
        if (now - lastReport < 500) return;
        lastReport = now;
        const ratio = Math.min(downloaded / totalSize, 1);
        const percent = 30 + Math.round(ratio * 20);
        this.reportProgress(onProgress, "Downloading patch", percent);
      });

      await pipeline(response.data, writer);
      fs.renameSync(tempPath, patchPath);

      this.reportProgress(onProgress, "Download completed", 50);
      return patchPath;
    } catch (error) {
      Logger.error("GameInstaller", `Failed to download patch from ${url}`, error);
      this.safeRemoveFile(tempPath);
      throw error;
    }
  }

  private static async requestPatchStream(url: string) {
    try {
      return await axios.get(url, {
        responseType: "stream",
        timeout: 5 * 60 * 1000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        }
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status === 403 && url.startsWith("https://")) {
        const httpUrl = url.replace("https://", "http://");
        Logger.warn("GameInstaller", `Patch download forbidden, retrying via HTTP: ${httpUrl}`);
        return await axios.get(httpUrl, {
          responseType: "stream",
          timeout: 5 * 60 * 1000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            Pragma: "no-cache"
          }
        });
      }
      throw error;
    }
  }

  private static createUserDataBackupRoot(gameRoot: string): string {
    return path.join(
      gameRoot,
      `.userdata-backup-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }

  private static backupUserData(
    currentDir: string,
    backupRoot: string,
    required = false
  ): UserDataBackup[] {
    if (!fs.existsSync(currentDir)) {
      if (required) {
        throw new Error("Game installation not found for UserData backup");
      }
      return [];
    }

    const userDataDirs = this.findUserDataDirs(currentDir);
    if (userDataDirs.length === 0) {
      if (required) {
        throw new Error("UserData not found in current installation");
      }
      return [];
    }

    fs.mkdirSync(backupRoot, { recursive: true });

    return userDataDirs.map((dirPath) => {
      const relativePath = path.relative(currentDir, dirPath);
      const targetPath = path.join(backupRoot, relativePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.cpSync(dirPath, targetPath, { recursive: true });
      return { relativePath, sourcePath: dirPath };
    });
  }

  private static restoreUserData(
    currentDir: string,
    backupRoot: string,
    backups: UserDataBackup[]
  ): void {
    if (!backups.length) return;

    backups.forEach((backup) => {
      const sourcePath = path.join(backupRoot, backup.relativePath);
      const targetPath = path.join(currentDir, backup.relativePath);
      if (!fs.existsSync(sourcePath)) return;

      fs.rmSync(targetPath, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.cpSync(sourcePath, targetPath, { recursive: true });
    });
  }

  private static replaceCurrentWithStaging(
    currentDir: string,
    stagingDir: string,
    gameRoot: string,
    userDataBackups: UserDataBackup[],
    userDataBackupRoot: string
  ): void {
    const backupDir = this.createCurrentBackupDir(gameRoot);

    try {
      if (fs.existsSync(currentDir)) {
        fs.renameSync(currentDir, backupDir);
      }

      fs.renameSync(stagingDir, currentDir);
      this.restoreUserData(currentDir, userDataBackupRoot, userDataBackups);

      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
      this.safeRemoveDir(userDataBackupRoot);
    } catch (error) {
      Logger.error("GameInstaller", "Failed to finalize installation", error);
      this.rollbackCurrent(currentDir, backupDir);
      throw error;
    }
  }

  private static swapWithRollback(
    currentDir: string,
    stagingDir: string,
    backupDir: string,
    userDataBackups: UserDataBackup[],
    userDataBackupRoot: string
  ): void {
    try {
      if (fs.existsSync(currentDir)) {
        fs.renameSync(currentDir, backupDir);
      }

      fs.renameSync(stagingDir, currentDir);
      this.restoreUserData(currentDir, userDataBackupRoot, userDataBackups);

      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
      this.safeRemoveDir(userDataBackupRoot);
    } catch (error) {
      Logger.error("GameInstaller", "Failed to finalize update", error);
      this.rollbackCurrent(currentDir, backupDir);
      throw error;
    }
  }

  private static createCurrentBackupDir(gameRoot: string): string {
    return path.join(
      gameRoot,
      `.backup-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }

  private static rollbackCurrent(currentDir: string, backupDir: string): void {
    if (fs.existsSync(currentDir)) {
      this.safeRemoveDir(currentDir);
    }
    if (fs.existsSync(backupDir)) {
      try {
        fs.renameSync(backupDir, currentDir);
      } catch (error) {
        Logger.error("GameInstaller", "Rollback failed", error);
      }
    }
  }

  private static findUserDataDirs(root: string): string[] {
    const results: string[] = [];
    const stack: string[] = [root];

    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;

      const entries = fs.readdirSync(current, { withFileTypes: true });
      entries.forEach((entry) => {
        if (!entry.isDirectory()) return;
        const entryPath = path.join(current, entry.name);
        if (entry.name === "UserData") {
          results.push(entryPath);
          return;
        }
        stack.push(entryPath);
      });
    }

    return results;
  }

  private static ensureExecutablePermissions(root: string): void {
    if (process.platform === "win32") {
      return;
    }

    const executable = Paths.findClientExecutable(root);
    if (!executable) {
      Logger.warn("GameInstaller", "No executable found to update permissions");
      return;
    }

      try {
      const stats = fs.statSync(executable);
      if (stats.isFile()) {
        fs.chmodSync(executable, 0o755);
      }
      } catch (error) {
      Logger.warn("GameInstaller", `Failed to set executable permissions: ${executable}`);
    }
  }

  private static safeRemoveDir(dirPath: string): void {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (error) {
      Logger.error("GameInstaller", `Failed to remove directory: ${dirPath}`, error);
    }
  }

  private static safeRemoveFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      Logger.error("GameInstaller", `Failed to remove file: ${filePath}`, error);
    }
  }
}
