import { ipcMain, BrowserWindow } from "electron";
import { Logger } from "../core/Logger";
import {
  backgroundTranslationQueue
} from "../core/translation/BackgroundTranslationQueue";
import { ModDescriptionTranslator } from "../services/ModDescriptionTranslator";
import { NewsManager } from "../services/NewsManager";
import type {
  TranslationJob,
  TranslationJobResult,
  TranslationContext
} from "../core/translation/BackgroundTranslationQueue";
import type { Language } from "../core/translation";

/**
 * Registers IPC handlers for background translation.
 */
export const registerTranslationHandlers = (): void => {
  const getMainWindow = (): BrowserWindow | null => {
    const windows = BrowserWindow.getAllWindows();
    return windows.length > 0 ? windows[0] : null;
  };

  backgroundTranslationQueue.on("translation:completed", (result: TranslationJobResult) => {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("translation:completed", result);
    }
  });

  backgroundTranslationQueue.on("translation:failed", (result: TranslationJobResult) => {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("translation:failed", result);
    }
  });

  backgroundTranslationQueue.on("translation:queued", (data: { jobId: string; context: TranslationContext; metadata?: Record<string, unknown> }) => {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("translation:queued", data);
    }
  });

  /**
   * Requests background translation for text.
   */
  ipcMain.handle(
    "translation:request",
    async (
      _event,
      options: {
        id: string;
        text: string;
        targetLanguage: Language;
        context?: TranslationContext;
        metadata?: Record<string, unknown>;
      }
    ): Promise<string> => {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid translation request options");
      }
      if (typeof options.id !== "string" || !options.id) {
        throw new Error("Invalid translation job ID");
      }
      if (typeof options.text !== "string") {
        throw new Error("Invalid text");
      }
      if (!["ru", "en", "uk", "pl", "be", "es"].includes(options.targetLanguage)) {
        throw new Error("Invalid target language");
      }

      Logger.debug(
        "IPC",
        `translation:request id=${options.id} context=${options.context || "other"}`
      );

      const job: TranslationJob = {
        id: options.id,
        text: options.text,
        targetLanguage: options.targetLanguage,
        context: options.context || "other",
        metadata: options.metadata
      };

      return backgroundTranslationQueue.requestTranslation(job);
    }
  );

  /**
   * Gets cached translation if available.
   */
  ipcMain.handle(
    "translation:getCached",
    async (_event, jobId: string): Promise<string | null> => {
      if (typeof jobId !== "string") {
        throw new Error("Invalid job ID");
      }

      Logger.debug("IPC", `translation:getCached id=${jobId}`);
      return backgroundTranslationQueue.getCachedTranslation(jobId);
    }
  );

  /**
   * Checks if a translation job is pending or in progress.
   */
  ipcMain.handle(
    "translation:isPending",
    async (_event, jobId: string): Promise<boolean> => {
      if (typeof jobId !== "string") {
        throw new Error("Invalid job ID");
      }

      return backgroundTranslationQueue.isPending(jobId);
    }
  );

  /**
   * Gets translation queue statistics.
   */
  ipcMain.handle("translation:getStats", async () => {
    Logger.debug("IPC", "translation:getStats");
    return backgroundTranslationQueue.getStats();
  });

  /**
   * Clears all translation caches (in-memory, mod translations, news).
   */
  ipcMain.handle("translation:clearCache", async () => {
    Logger.debug("IPC", "translation:clearCache");
    backgroundTranslationQueue.clearCache();
    ModDescriptionTranslator.clearCache();
    NewsManager.clearCache();
    Logger.info("IPC", "All translation caches cleared");
  });
};
