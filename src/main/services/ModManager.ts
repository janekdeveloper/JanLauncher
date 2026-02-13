import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import axios from "axios";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";
import { GameProfileManager } from "./GameProfileManager";
import type { GameProfile, Mod } from "../../shared/types";

const CURSEFORGE_API_BASE_URL = "https://api.curseforge.com/v1";
const CURSEFORGE_GAME_ID = 70216;
const CURSEFORGE_MODS_CLASS_ID = 9137;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const API_REQUEST_TIMEOUT_MS = 30 * 1000;

const getCurseForgeApiKey = (): string => {
  return process.env.CURSEFORGE_API_KEY || "";
};

type ModInfo = {
  modId?: number;
  fileId?: number;
  downloadUrl?: string;
  fileName?: string;
  name?: string;
  version?: string;
  summary?: string;
  author?: string;
  apiKey?: string;
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
  downloadCount: number;
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

export type CurseForgeCategory = {
  id: number;
  gameId: number;
  name: string;
  slug: string;
  iconUrl?: string;
};

/**
 * Manages mod installation, removal, and synchronization.
 * 
 * Handles CurseForge API integration, mod file management, and profile synchronization.
 */
export class ModManager {
  /**
   * Builds search params for CurseForge mods/search. Single place for API parameter formation.
   */
  private static buildSearchParams(
    query: string,
    pageIndex: number,
    pageSize: number,
    sortField?: "downloads" | "dateCreated" | "dateModified" | "name",
    sortOrder: "asc" | "desc" = "desc",
    categoryId?: number | null,
    gameVersion?: string | null
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      gameId: CURSEFORGE_GAME_ID,
      classId: CURSEFORGE_MODS_CLASS_ID,
      index: pageIndex * pageSize,
      pageSize
    };
    if (query.trim()) {
      params.searchFilter = query;
    }
    if (sortField) {
      const sortFieldMap: Record<string, number> = {
        downloads: 6,
        dateCreated: 3,
        dateModified: 3,
        name: 4
      };
      params.sortField = sortFieldMap[sortField] || 6;
      params.sortOrder = sortOrder;
    }
    if (categoryId != null && categoryId > 0) {
      params.categoryId = categoryId;
    }
    if (gameVersion != null && gameVersion.trim()) {
      params.gameVersion = gameVersion.trim();
    }
    return params;
  }

  /**
   * Searches for mods on CurseForge.
   *
   * @param query - Search query
   * @param pageIndex - Page index (defaults to 0)
   * @param pageSize - Page size (defaults to 20)
   * @param sortField - Sort field (downloads, dateCreated, dateModified, name)
   * @param sortOrder - Sort order (asc or desc, defaults to desc)
   * @param categoryId - Optional category filter
   * @param gameVersion - Optional game version filter
   * @returns CurseForge search results
   */
  static async searchMods(
    query: string,
    pageIndex = 0,
    pageSize = 20,
    sortField?: "downloads" | "dateCreated" | "dateModified" | "name",
    sortOrder: "asc" | "desc" = "desc",
    categoryId?: number | null,
    gameVersion?: string | null
  ): Promise<CurseForgeSearchResult> {
    const apiKey = getCurseForgeApiKey();
    if (!apiKey) {
      throw new Error("CURSEFORGE_API_KEY environment variable is not set");
    }

    try {
      Logger.info("ModManager", `Searching mods: "${query}" (page ${pageIndex}, sort: ${sortField || "default"} ${sortOrder}, categoryId: ${categoryId ?? "all"}, gameVersion: ${gameVersion ?? "all"})`);

      const url = `${CURSEFORGE_API_BASE_URL}/mods/search`;
      const params = ModManager.buildSearchParams(query, pageIndex, pageSize, sortField, sortOrder, categoryId, gameVersion);

      const response = await axios.get<CurseForgeSearchResult>(url, {
        headers: { "x-api-key": apiKey },
        params,
        timeout: DOWNLOAD_TIMEOUT_MS
      });

      return response.data;
    } catch (error) {
      Logger.error("ModManager", "Failed to search mods", error);
      throw error;
    }
  }

  /**
   * Gets mod categories for the game from CurseForge API.
   */
  static async getCategories(): Promise<CurseForgeCategory[]> {
    const apiKey = getCurseForgeApiKey();
    if (!apiKey) {
      throw new Error("CURSEFORGE_API_KEY environment variable is not set");
    }
    try {
      const url = `${CURSEFORGE_API_BASE_URL}/categories`;
      const response = await axios.get<{ data: CurseForgeCategory[] }>(url, {
        headers: { "x-api-key": apiKey },
        params: { gameId: CURSEFORGE_GAME_ID, classId: CURSEFORGE_MODS_CLASS_ID },
        timeout: API_REQUEST_TIMEOUT_MS
      });
      return response.data?.data ?? [];
    } catch (error) {
      Logger.error("ModManager", "Failed to get categories", error);
      throw error;
    }
  }

  /**
   * Gets available game versions from CurseForge API.
   */
  static async getGameVersions(): Promise<string[]> {
    const apiKey = getCurseForgeApiKey();
    if (!apiKey) {
      throw new Error("CURSEFORGE_API_KEY environment variable is not set");
    }
    try {
      const url = `${CURSEFORGE_API_BASE_URL}/games/${CURSEFORGE_GAME_ID}/versions`;
      const response = await axios.get<{ data: Array<{ versions: string[] }> }>(url, {
        headers: { "x-api-key": apiKey },
        timeout: API_REQUEST_TIMEOUT_MS
      });
      const data = response.data?.data;
      if (!Array.isArray(data)) return [];
      const versions: string[] = [];
      for (const item of data) {
        if (Array.isArray(item.versions)) {
          versions.push(...item.versions);
        }
      }
      return versions;
    } catch (error) {
      Logger.error("ModManager", "Failed to get game versions", error);
      throw error;
    }
  }

  /**
   * Gets detailed information about a mod.
   * 
   * @param modId - CurseForge mod ID
   * @returns Mod details
   */
  static async getModDetails(modId: number): Promise<CurseForgeMod> {
    const apiKey = getCurseForgeApiKey();
    if (!apiKey) {
      throw new Error("CURSEFORGE_API_KEY environment variable is not set");
    }
    
    try {
      Logger.info("ModManager", `Fetching mod details: ${modId}`);
      
      const url = `${CURSEFORGE_API_BASE_URL}/mods/${modId}`;
      const response = await axios.get<{ data: CurseForgeMod }>(url, {
        headers: { "x-api-key": apiKey },
        params: { gameId: CURSEFORGE_GAME_ID },
        timeout: DOWNLOAD_TIMEOUT_MS
      });

      if (!response.data?.data) {
        throw new Error("Mod details not found");
      }

      return response.data.data;
    } catch (error) {
      Logger.error("ModManager", `Failed to get mod details: ${modId}`, error);
      throw error;
    }
  }

  /**
   * Loads installed mods for a game profile.
   * 
   * @param gameProfileId - Game profile ID
   * @returns List of installed mods with their current state
   */
  static async loadInstalledMods(gameProfileId: string): Promise<Mod[]> {
    try {
      const profile = this.getProfile(gameProfileId);
      const { modsDir, disabledDir } = await this.getModDirectories(gameProfileId);

      return profile.mods.map((mod) => {
        const enabledPath = path.join(modsDir, mod.fileName);
        const disabledPath = path.join(disabledDir, mod.fileName);
        const existsEnabled = fs.existsSync(enabledPath);
        const existsDisabled = fs.existsSync(disabledPath);

        if (existsEnabled) {
          return { ...mod, enabled: true, missing: false };
        }
        if (existsDisabled) {
          return { ...mod, enabled: false, missing: false };
        }

        return { ...mod, missing: true };
      });
    } catch (error) {
      Logger.error("ModManager", "Failed to load installed mods", error);
      throw error;
    }
  }

  /**
   * Downloads and installs a mod.
   * 
   * @param options - Download options including game profile ID and mod info
   * @returns Installed mod
   */
  static async downloadMod(options: {
    gameProfileId: string;
    modInfo: ModInfo;
  }): Promise<Mod> {
    if (!options.modInfo.apiKey) {
      options.modInfo.apiKey = getCurseForgeApiKey();
    }
    const { gameProfileId, modInfo } = options;

    try {
      const { modsDir, disabledDir } = await this.getModDirectories(gameProfileId);
      const downloadUrl = await this.resolveDownloadUrl(modInfo);
      const resolvedFileName = this.resolveFileName(modInfo, downloadUrl);
      const targetPath = path.join(modsDir, resolvedFileName);
      const disabledPath = path.join(disabledDir, resolvedFileName);

      this.removeFileIfExists(targetPath);
      this.removeFileIfExists(disabledPath);

      Logger.info("ModManager", `Downloading mod: ${resolvedFileName}`);
      await this.downloadToFile(downloadUrl, targetPath);

      const stats = fs.statSync(targetPath);
      const mod: Mod = {
        id: this.generateModId(resolvedFileName),
        name: modInfo.name ?? this.extractModName(resolvedFileName),
        version: modInfo.version ?? "unknown",
        description: modInfo.summary,
        author: modInfo.author,
        enabled: true,
        fileName: resolvedFileName,
        fileSize: stats.size,
        dateInstalled: new Date().toISOString(),
        curseForgeId: modInfo.modId,
        curseForgeFileId: modInfo.fileId,
        missing: false
      };

      const profile = this.getProfile(gameProfileId);
      const updatedMods = this.upsertMod(profile.mods, mod);
      this.updateProfile(gameProfileId, { mods: updatedMods });

      Logger.info("ModManager", `Installed mod: ${mod.name} (${mod.id})`);
      return mod;
    } catch (error) {
      Logger.error("ModManager", "Failed to download mod", error);
      throw error;
    }
  }

  /**
   * Toggles mod enabled/disabled state.
   * 
   * @param gameProfileId - Game profile ID
   * @param modId - Mod ID
   */
  static async toggleMod(gameProfileId: string, modId: string): Promise<void> {
    try {
      const profile = this.getProfile(gameProfileId);
      const index = profile.mods.findIndex((mod) => mod.id === modId);
      if (index === -1) {
        throw new Error(`Mod not found: ${modId}`);
      }

      const { modsDir, disabledDir } = await this.getModDirectories(gameProfileId);
      const mod = profile.mods[index];
      const enabledPath = path.join(modsDir, mod.fileName);
      const disabledPath = path.join(disabledDir, mod.fileName);
      const existsEnabled = fs.existsSync(enabledPath);
      const existsDisabled = fs.existsSync(disabledPath);

      if (!existsEnabled && !existsDisabled) {
        throw new Error(`Mod file not found: ${mod.fileName}`);
      }

      const targetPath = mod.enabled ? disabledPath : enabledPath;
      const sourcePath = existsEnabled ? enabledPath : disabledPath;

      if (sourcePath !== targetPath) {
        this.moveFile(sourcePath, targetPath);
      }
      if (existsEnabled && existsDisabled) {
        const duplicatePath = targetPath === enabledPath ? disabledPath : enabledPath;
        this.removeFileIfExists(duplicatePath);
      }

      const updatedMods = [...profile.mods];
      updatedMods[index] = { ...mod, enabled: !mod.enabled, missing: false };
      this.updateProfile(gameProfileId, { mods: updatedMods });
    } catch (error) {
      Logger.error("ModManager", `Failed to toggle mod: ${modId}`, error);
      throw error;
    }
  }

  /**
   * Uninstalls a mod.
   * 
   * @param gameProfileId - Game profile ID
   * @param modId - Mod ID
   */
  static async uninstallMod(gameProfileId: string, modId: string): Promise<void> {
    try {
      const profile = this.getProfile(gameProfileId);
      const mod = profile.mods.find((item) => item.id === modId);
      if (!mod) {
        throw new Error(`Mod not found: ${modId}`);
      }

      const { modsDir, disabledDir } = await this.getModDirectories(gameProfileId);
      this.removeFileIfExists(path.join(modsDir, mod.fileName));
      this.removeFileIfExists(path.join(disabledDir, mod.fileName));

      const updatedMods = profile.mods.filter((item) => item.id !== modId);
      this.updateProfile(gameProfileId, { mods: updatedMods });
      Logger.info("ModManager", `Uninstalled mod: ${mod.name} (${mod.id})`);
    } catch (error) {
      Logger.error("ModManager", `Failed to uninstall mod: ${modId}`, error);
      throw error;
    }
  }

  /**
   * Synchronizes mod files with profile state.
   * 
   * Ensures mod files are in correct directories (enabled/disabled) based on profile.
   * 
   * @param gameProfileId - Game profile ID
   */
  static async syncMods(gameProfileId: string): Promise<void> {
    try {
      const profile = this.getProfile(gameProfileId);
      const { modsDir, disabledDir } = await this.getModDirectories(gameProfileId);

      profile.mods.forEach((mod) => {
        const enabledPath = path.join(modsDir, mod.fileName);
        const disabledPath = path.join(disabledDir, mod.fileName);
        const shouldBeEnabled = mod.enabled;
        const expectedPath = shouldBeEnabled ? enabledPath : disabledPath;
        const otherPath = shouldBeEnabled ? disabledPath : enabledPath;
        const existsExpected = fs.existsSync(expectedPath);
        const existsOther = fs.existsSync(otherPath);

        if (existsExpected && existsOther) {
          this.removeFileIfExists(otherPath);
          return;
        }

        if (!existsExpected && existsOther) {
          this.moveFile(otherPath, expectedPath);
          return;
        }

        if (!existsExpected && !existsOther) {
          Logger.warn("ModManager", `Missing mod file: ${mod.fileName}`);
        }
      });
    } catch (error) {
      Logger.error("ModManager", `Failed to sync mods for profile ${gameProfileId}`, error);
      throw error;
    }
  }

  private static getProfile(gameProfileId: string): GameProfile {
    const manager = new GameProfileManager();
    return manager.getProfile(gameProfileId);
  }

  private static updateProfile(
    gameProfileId: string,
    patch: Partial<GameProfile>
  ): GameProfile {
    const manager = new GameProfileManager();
    return manager.updateProfile(gameProfileId, patch);
  }

  private static async getModDirectories(gameProfileId: string): Promise<{
    modsDir: string;
    disabledDir: string;
  }> {
    const modsDir = await Paths.getModsPath(gameProfileId);
    const userDataDir = path.dirname(modsDir);
    const disabledDir = path.join(userDataDir, "DisabledMods");

    fs.mkdirSync(modsDir, { recursive: true });
    fs.mkdirSync(disabledDir, { recursive: true });

    return { modsDir, disabledDir };
  }

  private static generateModId(fileName: string): string {
    return createHash("md5").update(fileName).digest("hex").slice(0, 8);
  }

  private static extractModName(fileName: string): string {
    const base = path.basename(fileName, path.extname(fileName));
    const withoutVersion = base.replace(/[-_]?v?\d+(\.\d+)*$/i, "");
    const withSpaces = withoutVersion.replace(/[_-]+/g, " ").trim();
    return withSpaces
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  private static resolveFileName(modInfo: ModInfo, downloadUrl: string): string {
    const fileName = modInfo.fileName ?? this.extractFileNameFromUrl(downloadUrl);
    if (!fileName) {
      throw new Error("Unable to resolve mod file name");
    }
    return path.basename(fileName);
  }

  private static async resolveDownloadUrl(modInfo: ModInfo): Promise<string> {
    if (modInfo.downloadUrl) {
      return modInfo.downloadUrl;
    }

    if (!modInfo.modId || !modInfo.fileId) {
      throw new Error("modId and fileId are required when downloadUrl is missing");
    }

    const apiKey = modInfo.apiKey || getCurseForgeApiKey();
    if (!apiKey) {
      throw new Error("CURSEFORGE_API_KEY environment variable is not set");
    }

    const url = `${CURSEFORGE_API_BASE_URL}/mods/${modInfo.modId}/files/${modInfo.fileId}`;
    try {
      const response = await axios.get(url, {
        headers: { "x-api-key": apiKey },
        params: { gameId: CURSEFORGE_GAME_ID },
        timeout: DOWNLOAD_TIMEOUT_MS
      });

      Logger.debug("ModManager", `File details response structure: ${JSON.stringify(Object.keys(response.data?.data || {}))}`);

      const fileData = response.data?.data;
      let downloadUrl = fileData?.downloadUrl;

      if (!downloadUrl && fileData) {
        Logger.debug("ModManager", `Full file data keys: ${JSON.stringify(Object.keys(fileData))}`);
        Logger.debug("ModManager", `File data sample: ${JSON.stringify(fileData, null, 2).substring(0, 500)}`);
      }

      if (downloadUrl && typeof downloadUrl === "string") {
        return downloadUrl;
      }

      Logger.info("ModManager", "downloadUrl not found in file details, using direct download endpoint");
      return `${CURSEFORGE_API_BASE_URL}/mods/${modInfo.modId}/files/${modInfo.fileId}/download`;
    } catch (error: any) {
      Logger.error("ModManager", `Failed to get file details: ${error.message}`);
      Logger.info("ModManager", "Falling back to direct download endpoint");
      return `${CURSEFORGE_API_BASE_URL}/mods/${modInfo.modId}/files/${modInfo.fileId}/download`;
    }
  }

  private static async downloadToFile(url: string, targetPath: string): Promise<void> {
    const tempPath = `${targetPath}.download`;
    this.removeFileIfExists(tempPath);
    try {
      const headers: Record<string, string> = {};
      if (url.includes("api.curseforge.com")) {
        const apiKey = getCurseForgeApiKey();
        if (apiKey) {
          headers["x-api-key"] = apiKey;
        }
      }
      
      const response = await axios.get(url, {
        headers,
        responseType: "stream",
        timeout: DOWNLOAD_TIMEOUT_MS
      });

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(tempPath);
        response.data.on("error", reject);
        writer.on("error", reject);
        writer.on("finish", resolve);
        response.data.pipe(writer);
      });

      fs.renameSync(tempPath, targetPath);
    } catch (error) {
      try {
        this.removeFileIfExists(tempPath);
      } catch (cleanupError) {
        Logger.error("ModManager", "Failed to cleanup temporary download file", cleanupError);
      }
      throw error;
    }
  }

  private static extractFileNameFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      const base = path.basename(parsed.pathname);
      return base || null;
    } catch {
      return null;
    }
  }

  private static upsertMod(mods: Mod[], mod: Mod): Mod[] {
    const index = mods.findIndex((item) => item.id === mod.id);
    if (index === -1) {
      return [...mods, mod];
    }
    const next = [...mods];
    next[index] = mod;
    return next;
  }

  private static moveFile(sourcePath: string, targetPath: string): void {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    this.removeFileIfExists(targetPath);
    fs.renameSync(sourcePath, targetPath);
  }

  private static removeFileIfExists(filePath: string): void {
    if (!fs.existsSync(filePath)) return;
    fs.unlinkSync(filePath);
  }
}
