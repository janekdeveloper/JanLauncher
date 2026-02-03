import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";
import { ConfigStore } from "../core/ConfigStore";
import { ButlerManager } from "../services/ButlerManager";
import { VersionStorage } from "./VersionStorage";
import {
  AVAILABLE_BRANCHES,
  type ActiveGameVersion,
  type GameVersionBranch,
  type GameVersionInfo,
  type InstalledVersionRecord
} from "./VersionManifest";

const PATCH_BASE_URL = "https://game-patches.hytale.com/patches";
const CONSECUTIVE_MISSES_TO_STOP = 5;

type PatchPair = { prev: number; target: number };

export type VersionInstallProgress = {
  message: string;
  percent?: number;
};

export class VersionManager {
  private static pwrCache = new Map<GameVersionBranch, Set<string>>();

  static async getAvailableVersions(branch: GameVersionBranch): Promise<GameVersionInfo[]> {
    this.ensureBranch(branch);
    VersionStorage.ensureLayout();

    const pwrSet = new Set<string>();
    let maxVersion = 0;
    let consecutiveMisses = 0;
    let version = 1;

    Logger.info("VersionManager", `Discovering versions for branch ${branch}`);

    while (consecutiveMisses < CONSECUTIVE_MISSES_TO_STOP) {
      const url = this.buildPatchUrl(branch, 0, version);
      const exists = await this.headPatch(url);
      if (exists) {
        maxVersion = version;
        pwrSet.add(this.patchKey(0, version));
        consecutiveMisses = 0;
      } else {
        consecutiveMisses += 1;
      }
      version += 1;
    }

    for (let prev = 1; prev < maxVersion; prev += 1) {
      consecutiveMisses = 0;
      let target = prev + 1;
      while (
        consecutiveMisses < CONSECUTIVE_MISSES_TO_STOP &&
        target <= maxVersion + CONSECUTIVE_MISSES_TO_STOP
      ) {
        const url = this.buildPatchUrl(branch, prev, target);
        const exists = await this.headPatch(url);
        if (exists) {
          pwrSet.add(this.patchKey(prev, target));
          consecutiveMisses = 0;
        } else {
          consecutiveMisses += 1;
        }
        target += 1;
      }
    }

    this.pwrCache.set(branch, pwrSet);

    const targets = Array.from(
      new Set(
        Array.from(pwrSet)
          .map((key) => this.parsePatchKey(key).target)
          .filter((value) => value > 0)
      )
    ).sort((a, b) => b - a);

    Logger.info(
      "VersionManager",
      `Found ${pwrSet.size} patch files for branch ${branch}: ${Array.from(pwrSet).join(", ")}`
    );
    console.log(
      `[VersionManager] Found ${pwrSet.size} patch files for branch ${branch}:`,
      Array.from(pwrSet)
    );

    if (!targets.length) {
      Logger.warn("VersionManager", `No versions found for branch ${branch}`);
      console.warn(`[VersionManager] No versions found for branch ${branch}`);
      return [];
    }

    Logger.info(
      "VersionManager",
      `Discovered ${targets.length} unique versions for branch ${branch}: ${targets.join(", ")}`
    );
    console.log(
      `[VersionManager] Discovered ${targets.length} unique versions for branch ${branch}:`,
      targets
    );

    const installed = await this.getInstalledVersions(branch);
    const installedSet = new Set(installed.map((entry) => entry.id));
    const latest = targets[0];

    const versions = targets.map((target) => ({
      id: String(target),
      branch,
      version: target,
      label: `v${target}`,
      isLatest: target === latest,
      installed: installedSet.has(String(target))
    }));

    const versionsInfo = versions
      .map(
        (v) =>
          `v${v.version}${v.isLatest ? " (latest)" : ""}${v.installed ? " [installed]" : ""}`
      )
      .join(", ");

    Logger.info(
      "VersionManager",
      `Available versions for branch ${branch}: ${versionsInfo}`
    );
    console.log(
      `[VersionManager] Available versions for branch ${branch}:`,
      versions.map((v) => ({
        version: v.version,
        label: v.label,
        isLatest: v.isLatest,
        installed: v.installed
      }))
    );

    return versions;
  }

  static async getInstalledVersions(
    branch?: GameVersionBranch
  ): Promise<InstalledVersionRecord[]> {
    VersionStorage.ensureLayout();
    const installed = VersionStorage.refreshIndex();
    if (!branch) return installed;
    return installed.filter((entry) => entry.branch === branch);
  }

  static getInstalledVersionsAsInfo(
    branch?: GameVersionBranch
  ): GameVersionInfo[] {
    VersionStorage.ensureLayout();
    const installed = VersionStorage.refreshIndex();
    const filtered = branch ? installed.filter((entry) => entry.branch === branch) : installed;
    
    return filtered.map((record) => ({
      id: record.id,
      branch: record.branch,
      version: record.version,
      label: `v${record.version}`,
      isLatest: false,
      installed: true,
      localOnly: true
    }));
  }

  static getActiveVersion(profileId: string): ActiveGameVersion {
    const profile = this.getProfile(profileId);
    const branch = profile.versionBranch ?? "release";
    const versionId = profile.versionId ?? null;
    return { branch, versionId };
  }

  static setActiveVersion(profileId: string, branch: GameVersionBranch, versionId: string | null): void {
    this.ensureBranch(branch);
    const profile = this.getProfile(profileId);
    ConfigStore.updateGameProfile(profile.id, {
      versionBranch: branch,
      versionId
    });
    Logger.info(
      "VersionManager",
      `Set active version for profile ${profileId}: ${branch}/${versionId ?? "none"}`
    );
  }

  static async installVersion(options: {
    branch: GameVersionBranch;
    versionId: string;
    force?: boolean;
    onProgress?: (progress: VersionInstallProgress) => void;
  }): Promise<void> {
    const { branch, versionId, onProgress, force = false } = options;
    this.ensureBranch(branch);
    const targetVersion = this.parseVersion(versionId);

    VersionStorage.ensureLayout();

    const versionDir = VersionStorage.getVersionDir(branch, versionId);
    const metadata = VersionStorage.readMetadata(branch, versionId);
    const installedVersion = metadata?.version ?? 0;

    if (!force && installedVersion === targetVersion && this.isValidInstallation(versionDir)) {
      this.reportProgress(onProgress, "Version already installed", 100);
      return;
    }

    this.reportProgress(onProgress, "Preparing installation", 5);
    await ButlerManager.ensureButler();

    const patchSet = await this.ensurePatchCache(branch);
    const baseVersion = force ? 0 : installedVersion;
    let updatePath = this.findUpdatePath(baseVersion, targetVersion, patchSet);
    if (!updatePath.length) {
      updatePath = [{ prev: 0, target: targetVersion }];
    }

    const stagingDir = this.createStagingDir(branch, versionId);
    const butlerStagingDir = path.join(stagingDir, ".butler-staging");
    const needsBaseCopy = baseVersion > 0 && updatePath[0]?.prev !== 0;

    if (needsBaseCopy) {
      this.reportProgress(onProgress, "Preparing base files", 10);
      this.copyDirectory(versionDir, stagingDir);
    } else {
      fs.mkdirSync(stagingDir, { recursive: true });
    }

    try {
      for (const pair of updatePath) {
        const label =
          pair.prev === 0
            ? `Downloading v${pair.target}`
            : `Downloading patch ${pair.prev}→${pair.target}`;
        this.reportProgress(onProgress, label, 20);

        const patchPath = await this.downloadPatch(branch, pair.prev, pair.target);
        this.reportProgress(onProgress, "Applying patch", 60);

        try {
          await ButlerManager.applyPatch({
            pwrFile: patchPath,
            targetDir: stagingDir,
            stagingDir: butlerStagingDir
          });
        } catch (error) {
          Logger.error(
            "VersionManager",
            `Patch failed for ${branch} ${pair.prev}->${pair.target}`,
            error
          );
          if (pair.prev > 0) {
            Logger.warn("VersionManager", "Patch failed, retrying with full install");
            this.safeRemoveDir(stagingDir);
            return await this.installVersion({
              branch,
              versionId,
              onProgress,
              force: true
            });
          }
          throw error;
        }

        this.safeRemoveDir(butlerStagingDir);

        if (!this.isValidInstallation(stagingDir)) {
          if (pair.prev > 0) {
            Logger.warn(
              "VersionManager",
              "Corrupted executable after patch, retrying with full install"
            );
            this.safeRemoveDir(stagingDir);
            return await this.installVersion({
              branch,
              versionId,
              onProgress,
              force: true
            });
          }
          throw new Error("Game files corrupted after patch.");
        }
      }

      const metadataRecord = {
        id: versionId,
        branch,
        version: targetVersion,
        installedAt: new Date().toISOString(),
        sizeBytes: this.getDirectorySize(stagingDir)
      };

      VersionStorage.writeMetadataToDir(stagingDir, metadataRecord);

      this.reportProgress(onProgress, "Finalizing installation", 90);
      this.swapVersionDirectory(versionDir, stagingDir);
      VersionStorage.markInstalled(metadataRecord);

      this.reportProgress(onProgress, "Installation completed", 100);
      Logger.info("VersionManager", `Installed ${branch}/${versionId}`);
    } catch (error) {
      this.safeRemoveDir(stagingDir);
      throw error;
    }
  }

  static async removeVersion(branch: GameVersionBranch, versionId: string): Promise<void> {
    this.ensureBranch(branch);
    const inUse = this.isVersionInUse(branch, versionId);
    if (inUse) {
      throw new Error("Version is currently active in a profile");
    }

    const versionDir = VersionStorage.getVersionDir(branch, versionId);
    if (fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true, force: true });
    }
    VersionStorage.removeInstalled(branch, versionId);
    Logger.info("VersionManager", `Removed ${branch}/${versionId}`);
  }

  static resolveActiveVersion(profileId: string): { branch: GameVersionBranch; versionId: string } {
    const active = this.getActiveVersion(profileId);
    if (!active.versionId) {
      throw new Error("No active game version selected for this profile");
    }
    return { branch: active.branch, versionId: active.versionId };
  }

  static isVersionInstalled(branch: GameVersionBranch, versionId: string): boolean {
    const versionDir = VersionStorage.getVersionDir(branch, versionId);
    const metadata = VersionStorage.readMetadata(branch, versionId);
    if (!metadata) return false;
    return metadata.id === versionId && this.isValidInstallation(versionDir);
  }

  static migrateLegacyInstall(): void {
    VersionStorage.ensureLayout();
    const legacyDir = Paths.gameInstallDir;
    if (!fs.existsSync(legacyDir)) return;
    const clientPath = Paths.findClientExecutable(legacyDir);
    if (!clientPath) return;

    const settings = ConfigStore.getSettings();
    const legacyVersion = settings.installedGameVersion?.replace(".pwr", "") ?? null;
    if (!legacyVersion) {
      Logger.warn(
        "VersionManager",
        "Legacy install found but no version info available. Assuming manual reinstall is required."
      );
      return;
    }

    const branch: GameVersionBranch = "release";
    Logger.warn(
      "VersionManager",
      `Migrating legacy install as ${branch}/${legacyVersion}. Branch assumed as release.`
    );

    let versionNumber: number;
    try {
      versionNumber = this.parseVersion(legacyVersion);
    } catch (error) {
      Logger.warn(
        "VersionManager",
        `Legacy version id is invalid (${legacyVersion}). Migration skipped.`
      );
      return;
    }

    const targetDir = VersionStorage.getVersionDir(branch, legacyVersion);
    if (fs.existsSync(targetDir)) {
      Logger.warn(
        "VersionManager",
        "Version directory already exists, skipping legacy migration"
      );
      return;
    }

    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.renameSync(legacyDir, targetDir);

    const metadataRecord = {
      id: legacyVersion,
      branch,
      version: versionNumber,
      installedAt: new Date().toISOString(),
      sizeBytes: this.getDirectorySize(targetDir)
    };
    VersionStorage.writeMetadata(branch, legacyVersion, metadataRecord);
    VersionStorage.markInstalled(metadataRecord);

    ConfigStore.updateSettings({ installedGameVersion: null });
  }

  private static ensureBranch(branch: GameVersionBranch): void {
    if (!AVAILABLE_BRANCHES.includes(branch)) {
      throw new Error(`Unsupported branch: ${branch}`);
    }
  }

  private static getProfile(profileId: string) {
    const profiles = ConfigStore.getGameProfiles();
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) {
      throw new Error(`Game profile not found: ${profileId}`);
    }
    return profile;
  }

  private static reportProgress(
    onProgress: ((progress: VersionInstallProgress) => void) | undefined,
    message: string,
    percent?: number
  ): void {
    if (onProgress) {
      onProgress({ message, percent });
    }
  }

  private static createStagingDir(branch: GameVersionBranch, versionId: string): string {
    const stagingRoot = VersionStorage.getStagingRoot();
    const dirName = `${branch}-${versionId}-${Date.now()}`;
    const stagingDir = path.join(stagingRoot, dirName);
    fs.mkdirSync(stagingDir, { recursive: true });
    return stagingDir;
  }

  private static async ensurePatchCache(branch: GameVersionBranch): Promise<Set<string>> {
    const existing = this.pwrCache.get(branch);
    if (existing) return existing;
    await this.getAvailableVersions(branch);
    return this.pwrCache.get(branch) ?? new Set<string>();
  }

  private static patchKey(prev: number, target: number): string {
    return `${prev}:${target}`;
  }

  private static parsePatchKey(key: string): PatchPair {
    const [prev, target] = key.split(":").map((part) => Number.parseInt(part, 10));
    return { prev, target };
  }

  private static findUpdatePath(
    fromVersion: number,
    toVersion: number,
    available: Set<string>
  ): PatchPair[] {
    if (fromVersion >= toVersion) {
      return [];
    }

    const directKey = this.patchKey(fromVersion, toVersion);
    if (available.has(directKey)) {
      return [{ prev: fromVersion, target: toVersion }];
    }

    const path: PatchPair[] = [];
    let current = fromVersion;
    while (current < toVersion) {
      const candidates = Array.from(available)
        .map((key) => this.parsePatchKey(key))
        .filter((pair) => pair.prev === current && pair.target <= toVersion)
        .sort((a, b) => b.target - a.target);

      const best = candidates[0];
      if (!best) {
        return [{ prev: 0, target: toVersion }];
      }

      path.push(best);
      current = best.target;
    }

    return path;
  }

  private static parseVersion(versionId: string): number {
    const parsed = Number.parseInt(versionId, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid version id: ${versionId}`);
    }
    return parsed;
  }

  private static buildPatchUrl(branch: GameVersionBranch, prev: number, target: number): string {
    const os = this.mapOs();
    const arch = this.mapArch();
    return `${PATCH_BASE_URL}/${os}/${arch}/${branch}/${prev}/${target}.pwr`;
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

  private static async headPatch(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "JanLauncher-VersionManager"
        }
      });
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    }
  }

  private static async getPatchSize(url: string): Promise<number | null> {
    try {
      const response = await axios.head(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "JanLauncher-VersionManager"
        }
      });
      const size = response.headers["content-length"];
      if (!size) return null;
      const parsed = Number.parseInt(size, 10);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private static async downloadPatch(
    branch: GameVersionBranch,
    prev: number,
    target: number
  ): Promise<string> {
    const cacheDir = VersionStorage.getCacheDir();
    const fileName = `${branch}_${prev}_${target}.pwr`;
    const filePath = path.join(cacheDir, fileName);
    const url = this.buildPatchUrl(branch, prev, target);

    const expectedSize = await this.getPatchSize(url);
    if (fs.existsSync(filePath) && expectedSize) {
      const stat = fs.statSync(filePath);
      if (stat.size === expectedSize) {
        return filePath;
      }
      fs.unlinkSync(filePath);
    } else if (fs.existsSync(filePath) && !expectedSize) {
      return filePath;
    }

    const tempPath = `${filePath}.tmp`;
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 10 * 60 * 1000,
      headers: {
        "User-Agent": "JanLauncher-VersionManager",
        Accept: "*/*"
      }
    });

    fs.mkdirSync(cacheDir, { recursive: true });
    const writer = fs.createWriteStream(tempPath);
    await new Promise<void>((resolve, reject) => {
      response.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    fs.renameSync(tempPath, filePath);

    if (expectedSize) {
      const stat = fs.statSync(filePath);
      if (stat.size !== expectedSize) {
        fs.unlinkSync(filePath);
        throw new Error(
          `Patch download incomplete: ${stat.size}/${expectedSize} bytes`
        );
      }
    }

    return filePath;
  }

  private static isValidInstallation(root: string): boolean {
    const executable = Paths.findClientExecutable(root);
    if (!executable) return false;
    return this.isValidExecutable(executable);
  }

  private static isValidExecutable(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    if (!stats.isFile() || stats.size < 4096) return false;

    const fd = fs.openSync(filePath, "r");
    try {
      const buffer = Buffer.alloc(4);
      fs.readSync(fd, buffer, 0, 4, 0);

      switch (process.platform) {
        case "win32": {
          if (buffer[0] !== 0x4d || buffer[1] !== 0x5a) return false;
          const offsetBuffer = Buffer.alloc(4);
          fs.readSync(fd, offsetBuffer, 0, 4, 0x3c);
          const peOffset = offsetBuffer.readInt32LE(0);
          if (peOffset <= 0 || peOffset > stats.size - 4) return false;
          const peBuffer = Buffer.alloc(4);
          fs.readSync(fd, peBuffer, 0, 4, peOffset);
          return (
            peBuffer[0] === 0x50 &&
            peBuffer[1] === 0x45 &&
            peBuffer[2] === 0x00 &&
            peBuffer[3] === 0x00
          );
        }
        case "linux":
          return (
            buffer[0] === 0x7f &&
            buffer[1] === 0x45 &&
            buffer[2] === 0x4c &&
            buffer[3] === 0x46
          );
        case "darwin": {
          const isMachO64 =
            buffer[0] === 0xcf &&
            buffer[1] === 0xfa &&
            buffer[2] === 0xed &&
            buffer[3] === 0xfe;
          const isMachO32 =
            buffer[0] === 0xce &&
            buffer[1] === 0xfa &&
            buffer[2] === 0xed &&
            buffer[3] === 0xfe;
          const isUniversal =
            buffer[0] === 0xca &&
            buffer[1] === 0xfe &&
            buffer[2] === 0xba &&
            buffer[3] === 0xbe;
          return isMachO64 || isMachO32 || isUniversal;
        }
        default:
          return false;
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  private static swapVersionDirectory(versionDir: string, stagingDir: string): void {
    const backupDir = `${versionDir}.backup-${Date.now()}`;
    const parentDir = path.dirname(versionDir);
    
    try {
      fs.mkdirSync(parentDir, { recursive: true });
      
      if (fs.existsSync(versionDir)) {
        fs.renameSync(versionDir, backupDir);
      }
      fs.renameSync(stagingDir, versionDir);
      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
    } catch (error) {
      Logger.error("VersionManager", "Failed to finalize install, rolling back", error);
      if (fs.existsSync(backupDir)) {
        fs.renameSync(backupDir, versionDir);
      }
      throw error;
    }
  }

  private static copyDirectory(source: string, target: string): void {
    if (!fs.existsSync(source)) {
      throw new Error(`Base version directory not found: ${source}`);
    }
    fs.cpSync(source, target, { recursive: true });
  }

  private static getDirectorySize(dir: string): number {
    let total = 0;
    if (!fs.existsSync(dir)) return total;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += this.getDirectorySize(entryPath);
      } else if (entry.isFile()) {
        total += fs.statSync(entryPath).size;
      }
    });
    return total;
  }

  private static isVersionInUse(branch: GameVersionBranch, versionId: string): boolean {
    const profiles = ConfigStore.getGameProfiles();
    return profiles.some(
      (profile) =>
        profile.versionBranch === branch && profile.versionId === versionId
    );
  }

  private static safeRemoveDir(dirPath: string): void {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (error) {
      Logger.warn(
        "VersionManager",
        `Failed to remove directory ${dirPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
