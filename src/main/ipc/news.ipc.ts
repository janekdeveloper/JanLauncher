import { ipcMain, shell } from "electron";
import { Logger } from "../core/Logger";
import { NewsManager } from "../services/NewsManager";
import type { NewsArticle } from "../../shared/types";

type Language = "ru" | "en" | "uk" | "pl" | "be" | "es";

/**
 * Registers IPC handlers for news management.
 */
export const registerNewsHandlers = (): void => {
  ipcMain.handle(
    "news:loadCached",
    async (_event, language: Language = "en"): Promise<NewsArticle[] | null> => {
      Logger.debug("IPC", `news:loadCached language=${language}`);
      try {
        return NewsManager.loadCachedNews(language);
      } catch (error) {
        Logger.error("IPC", "news:loadCached failed", error);
        return null;
      }
    }
  );

  ipcMain.handle(
    "news:refresh",
    async (_event, language: Language = "en"): Promise<NewsArticle[]> => {
      Logger.debug("IPC", `news:refresh language=${language}`);
      try {
        return await NewsManager.fetchAndUpdateNews(language);
      } catch (error) {
        Logger.error("IPC", "news:refresh failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "news:fetch",
    async (_event, language: Language = "en"): Promise<NewsArticle[]> => {
      Logger.debug("IPC", `news:fetch language=${language}`);
      try {
        return await NewsManager.fetchAndUpdateNews(language);
      } catch (error) {
        Logger.error("IPC", "news:fetch failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle("news:openUrl", async (_event, url: string): Promise<void> => {
    Logger.debug("IPC", `news:openUrl ${url}`);
    try {
      if (url && url.startsWith("http")) {
        await shell.openExternal(url);
      } else {
        Logger.warn("IPC", `Invalid URL for news:openUrl: ${url}`);
      }
    } catch (error) {
      Logger.error("IPC", "news:openUrl failed", error);
      throw error;
    }
  });
};
