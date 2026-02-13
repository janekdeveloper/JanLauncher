import { ipcMain, shell } from "electron";
import { Logger } from "../core/Logger";
import { ModManager, type CurseForgeCategory, type CurseForgeMod, type CurseForgeSearchResult } from "../services/ModManager";
import { ModDescriptionTranslator } from "../services/ModDescriptionTranslator";
import type { Language } from "../core/translation";
import type { Mod } from "../../shared/types";

/**
 * Registers IPC handlers for mod management.
 */
export const registerModsHandlers = (): void => {
  ipcMain.handle(
    "mods:search",
    async (
      _event,
      options: {
        query: string;
        pageIndex?: number;
        pageSize?: number;
        sortField?: "downloads" | "dateCreated" | "dateModified" | "name";
        sortOrder?: "asc" | "desc";
        categoryId?: number | null;
        gameVersion?: string | null;
        language?: Language;
      }
    ): Promise<CurseForgeSearchResult> => {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid search options");
      }
      if (typeof options.query !== "string") {
        throw new Error("Invalid query");
      }
      if (options.pageIndex !== undefined && (typeof options.pageIndex !== "number" || options.pageIndex < 0)) {
        throw new Error("Invalid pageIndex");
      }
      if (options.pageSize !== undefined && (typeof options.pageSize !== "number" || options.pageSize <= 0 || options.pageSize > 100)) {
        throw new Error("Invalid pageSize");
      }
      if (options.sortField !== undefined && !["downloads", "dateCreated", "dateModified", "name"].includes(options.sortField)) {
        throw new Error("Invalid sortField");
      }
      if (options.sortOrder !== undefined && !["asc", "desc"].includes(options.sortOrder)) {
        throw new Error("Invalid sortOrder");
      }
      if (options.categoryId !== undefined && options.categoryId !== null && (typeof options.categoryId !== "number" || !Number.isInteger(options.categoryId) || options.categoryId <= 0)) {
        throw new Error("Invalid categoryId");
      }
      if (options.gameVersion !== undefined && options.gameVersion !== null && typeof options.gameVersion !== "string") {
        throw new Error("Invalid gameVersion");
      }
      if (options.language !== undefined && !["ru", "en", "uk", "pl", "be"].includes(options.language)) {
        throw new Error("Invalid language");
      }

      Logger.debug("IPC", `mods:search ${JSON.stringify(options)}`);
      try {
        const result = await ModManager.searchMods(
          options.query,
          options.pageIndex ?? 0,
          options.pageSize ?? 20,
          options.sortField,
          options.sortOrder ?? "desc",
          options.categoryId ?? undefined,
          options.gameVersion ?? undefined
        );

        const language = options.language ?? "en";
        if (language !== "en" && result.data.length > 0) {
          const translatedMods = await ModDescriptionTranslator.translateModDescriptions(
            result.data,
            language
          );
          return {
            ...result,
            data: translatedMods
          };
        }

        return result;
      } catch (error) {
        Logger.error("IPC", "mods:search failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "mods:getDetails",
    async (_event, modId: number, language?: Language): Promise<CurseForgeMod> => {
      if (typeof modId !== "number" || !Number.isInteger(modId) || modId <= 0) {
        throw new Error("Invalid modId");
      }
      if (language !== undefined && !["ru", "en", "uk", "pl", "be"].includes(language)) {
        throw new Error("Invalid language");
      }

      Logger.debug("IPC", `mods:getDetails ${modId} language=${language ?? "en"}`);
      try {
        const mod = await ModManager.getModDetails(modId);
        
        const targetLanguage = language ?? "en";
        if (targetLanguage !== "en") {
          return await ModDescriptionTranslator.translateModDescription(mod, targetLanguage) as CurseForgeMod;
        }

        return mod;
      } catch (error) {
        Logger.error("IPC", "mods:getDetails failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "mods:loadInstalled",
    async (_event, gameProfileId: string, language?: Language): Promise<Mod[]> => {
      if (!gameProfileId || typeof gameProfileId !== "string") {
        throw new Error("Invalid gameProfileId");
      }
      if (language !== undefined && !["ru", "en", "uk", "pl", "be"].includes(language)) {
        throw new Error("Invalid language");
      }

      Logger.debug("IPC", `mods:loadInstalled ${gameProfileId} language=${language ?? "en"}`);
      try {
        const mods = await ModManager.loadInstalledMods(gameProfileId);
        
        const targetLanguage = language ?? "en";
        if (targetLanguage !== "en") {
          return await ModDescriptionTranslator.translateModDescriptions(mods, targetLanguage);
        }

        return mods;
      } catch (error) {
        Logger.error("IPC", "mods:loadInstalled failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "mods:install",
    async (
      _event,
      options: {
        gameProfileId: string;
        modId: number;
        fileId?: number;
      }
    ): Promise<Mod> => {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid install options");
      }
      if (!options.gameProfileId || typeof options.gameProfileId !== "string") {
        throw new Error("Invalid gameProfileId");
      }
      if (typeof options.modId !== "number" || !Number.isInteger(options.modId) || options.modId <= 0) {
        throw new Error("Invalid modId");
      }
      if (options.fileId !== undefined && (typeof options.fileId !== "number" || !Number.isInteger(options.fileId) || options.fileId <= 0)) {
        throw new Error("Invalid fileId");
      }

      Logger.debug("IPC", `mods:install ${JSON.stringify(options)}`);
      try {
        const modDetails = await ModManager.getModDetails(options.modId);
        
        let fileId = options.fileId;
        if (!fileId && modDetails.latestFilesIndexes.length > 0) {
          fileId = modDetails.latestFilesIndexes[0].fileId;
        }
        if (!fileId) {
          throw new Error("No file ID available for mod");
        }

        return await ModManager.downloadMod({
          gameProfileId: options.gameProfileId,
          modInfo: {
            modId: options.modId,
            fileId,
            name: modDetails.name,
            version: modDetails.latestFilesIndexes[0]?.gameVersion ?? "unknown",
            summary: modDetails.summary,
            author: modDetails.authors[0]?.name
          }
        });
      } catch (error) {
        Logger.error("IPC", "mods:install failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "mods:toggle",
    async (
      _event,
      options: { gameProfileId: string; modId: string }
    ): Promise<void> => {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid toggle options");
      }
      if (!options.gameProfileId || typeof options.gameProfileId !== "string") {
        throw new Error("Invalid gameProfileId");
      }
      if (!options.modId || typeof options.modId !== "string") {
        throw new Error("Invalid modId");
      }

      Logger.debug("IPC", `mods:toggle ${JSON.stringify(options)}`);
      try {
        await ModManager.toggleMod(options.gameProfileId, options.modId);
      } catch (error) {
        Logger.error("IPC", "mods:toggle failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "mods:uninstall",
    async (
      _event,
      options: { gameProfileId: string; modId: string }
    ): Promise<void> => {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid uninstall options");
      }
      if (!options.gameProfileId || typeof options.gameProfileId !== "string") {
        throw new Error("Invalid gameProfileId");
      }
      if (!options.modId || typeof options.modId !== "string") {
        throw new Error("Invalid modId");
      }

      Logger.debug("IPC", `mods:uninstall ${JSON.stringify(options)}`);
      try {
        await ModManager.uninstallMod(options.gameProfileId, options.modId);
      } catch (error) {
        Logger.error("IPC", "mods:uninstall failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle("mods:getCategories", async (_event, language?: Language): Promise<CurseForgeCategory[]> => {
    if (language !== undefined && !["ru", "en", "uk", "pl", "be"].includes(language)) {
      throw new Error("Invalid language");
    }

    Logger.debug("IPC", `mods:getCategories language=${language ?? "en"}`);
    try {
      const categories = await ModManager.getCategories();
      
      const targetLanguage = language ?? "en";
      if (targetLanguage !== "en") {
        return await ModDescriptionTranslator.translateCategories(categories, targetLanguage);
      }

      return categories;
    } catch (error) {
      Logger.error("IPC", "mods:getCategories failed", error);
      throw error;
    }
  });

  ipcMain.handle("mods:getGameVersions", async (): Promise<string[]> => {
    Logger.debug("IPC", "mods:getGameVersions");
    try {
      return await ModManager.getGameVersions();
    } catch (error) {
      Logger.error("IPC", "mods:getGameVersions failed", error);
      throw error;
    }
  });

  ipcMain.handle("mods:openUrl", async (_event, url: string): Promise<void> => {
    Logger.debug("IPC", `mods:openUrl ${url}`);
    try {
      if (url && url.startsWith("http")) {
        await shell.openExternal(url);
      } else {
        Logger.warn("IPC", `Invalid URL for mods:openUrl: ${url}`);
      }
    } catch (error) {
      Logger.error("IPC", "mods:openUrl failed", error);
      throw error;
    }
  });
};
