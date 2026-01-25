import fs from "node:fs";
import path from "node:path";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";
import { translationService, type Language } from "../core/translation";
import { backgroundTranslationQueue } from "../core/translation/BackgroundTranslationQueue";
import type { Mod, CurseForgeMod } from "../../shared/types";

interface ModTranslationCacheEntry {
  originalText: string;
  translatedText: string;
  language: Language;
  translatedAt: string;
}

interface ModTranslationsCache {
  translations: Record<string, ModTranslationCacheEntry>;
}

/**
 * Translates mod descriptions with disk-based caching.
 * 
 * Handles translation caching, translates only missing descriptions,
 * provides automatic fallback to original text, and operates independently of UI.
 */
export class ModDescriptionTranslator {
  private static cache: ModTranslationsCache | null = null;
  private static cachePath: string | null = null;

  private static ensureCache(): void {
    if (this.cache !== null && this.cachePath !== null) {
      return;
    }

    const cachePath = Paths.modTranslationsCacheFile;
    this.cachePath = cachePath;
    
    try {
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, "utf-8");
        if (raw.trim()) {
          this.cache = JSON.parse(raw) as ModTranslationsCache;
          Logger.debug(
            "ModDescriptionTranslator",
            `Loaded ${Object.keys(this.cache.translations).length} cached translations`
          );
        } else {
          this.cache = { translations: {} };
        }
      } else {
        this.cache = { translations: {} };
      }
    } catch (error) {
      Logger.warn(
        "ModDescriptionTranslator",
        `Failed to load translation cache: ${error instanceof Error ? error.message : String(error)}`
      );
      this.cache = { translations: {} };
    }
  }

  private static saveCache(): void {
    if (this.cache === null || this.cachePath === null) {
      return;
    }

    try {
      const tempName = `.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const tempPath = path.join(
        path.dirname(this.cachePath),
        `${path.basename(this.cachePath)}${tempName}`
      );

      const content = JSON.stringify(this.cache, null, 2);
      fs.writeFileSync(tempPath, content, "utf-8");
      fs.renameSync(tempPath, this.cachePath);

      Logger.debug(
        "ModDescriptionTranslator",
        `Saved ${Object.keys(this.cache.translations).length} translations to cache`
      );
    } catch (error) {
      Logger.error("ModDescriptionTranslator", "Failed to save translation cache", error);
    }
  }

  private static getCacheKey(modId: number, language: Language): string {
    return `${modId}-${language}`;
  }

  private static getCachedTranslation(
    modId: number,
    language: Language,
    originalText: string
  ): string | null {
    this.ensureCache();
    if (this.cache === null) return null;

    const key = this.getCacheKey(modId, language);
    const entry = this.cache.translations[key];

    if (entry && entry.originalText === originalText) {
      Logger.debug(
        "ModDescriptionTranslator",
        `Cache hit for mod ${modId} (${language})`
      );
      return entry.translatedText;
    }

    return null;
  }

  private static setCachedTranslation(
    modId: number,
    language: Language,
    originalText: string,
    translatedText: string
  ): void {
    this.ensureCache();
    if (this.cache === null) return;

    const key = this.getCacheKey(modId, language);
    this.cache.translations[key] = {
      originalText,
      translatedText,
      language,
      translatedAt: new Date().toISOString()
    };

    this.saveCache();
  }

  private static isCurseForgeMod(mod: Mod | CurseForgeMod): mod is CurseForgeMod {
    return "summary" in mod;
  }

  private static getModDescription(mod: Mod | CurseForgeMod): string | undefined {
    return this.isCurseForgeMod(mod) ? mod.summary : mod.description;
  }

  private static getModId(mod: Mod | CurseForgeMod): number | null {
    if (this.isCurseForgeMod(mod)) {
      return mod.id;
    }
    const curseForgeId = mod.curseForgeId;
    if (typeof curseForgeId === "number") {
      return curseForgeId;
    }
    return null;
  }

  /**
   * Translates a single mod description.
   * 
   * @param mod - Mod to translate
   * @param language - Target language
   * @returns Mod with translated description or original if translation not needed/failed
   */
  static async translateModDescription(
    mod: Mod | CurseForgeMod,
    language: Language
  ): Promise<Mod | CurseForgeMod> {
    if (language === "en") {
      return mod;
    }

    const description = this.getModDescription(mod);
    if (!description || description.trim().length === 0) {
      return mod;
    }

    const modId = this.getModId(mod);
    if (!modId) {
      Logger.debug(
        "ModDescriptionTranslator",
        `Mod has no ID, translating without cache: ${mod.name || "unknown"}`
      );
      const translated = await translationService.translateText(description, language);
      if (this.isCurseForgeMod(mod)) {
        return { ...mod, summary: translated || description };
      }
      return { ...mod, description: translated || description };
    }

    const cached = this.getCachedTranslation(modId, language, description);
    if (cached !== null) {
      if (this.isCurseForgeMod(mod)) {
        return { ...mod, summary: cached };
      }
      return { ...mod, description: cached };
    }

    Logger.debug(
      "ModDescriptionTranslator",
      `Translating mod ${modId} description (${description.length} chars) to ${language}`
    );
    const translated = await translationService.translateText(description, language);

    if (translated && translated !== description) {
      this.setCachedTranslation(modId, language, description, translated);
    }

    if (this.isCurseForgeMod(mod)) {
      return { ...mod, summary: translated || description };
    }
    return { ...mod, description: translated || description };
  }

  /**
   * Translates descriptions for a list of mods.
   * 
   * Only translates mods that are not in cache.
   * 
   * @param mods - List of mods
   * @param language - Target language
   * @returns List of mods with translated descriptions
   */
  static async translateModDescriptions<T extends Mod | CurseForgeMod>(
    mods: T[],
    language: Language
  ): Promise<T[]> {
    if (language === "en") {
      return mods;
    }

    this.ensureCache();

    const modsToTranslate: Array<{ mod: T; index: number }> = [];
    const translatedMods: T[] = [];

    for (let i = 0; i < mods.length; i++) {
      const mod = mods[i];
      const description = this.getModDescription(mod);
      
      if (!description || description.trim().length === 0) {
        translatedMods[i] = mod;
        continue;
      }

      const modId = this.getModId(mod);
      if (!modId) {
        modsToTranslate.push({ mod, index: i });
        continue;
      }

      const cached = this.getCachedTranslation(modId, language, description);
      if (cached !== null) {
        if (this.isCurseForgeMod(mod)) {
          translatedMods[i] = { ...mod, summary: cached } as T;
        } else {
          translatedMods[i] = { ...mod, description: cached } as T;
        }
      } else {
        modsToTranslate.push({ mod, index: i });
      }
    }

    if (modsToTranslate.length > 0) {
      Logger.info(
        "ModDescriptionTranslator",
        `Translating ${modsToTranslate.length} mod descriptions to ${language}`
      );

      const translationPromises = modsToTranslate.map(async ({ mod, index }) => {
        const translated = await this.translateModDescription(mod, language);
        return { mod: translated as T, index };
      });

      const results = await Promise.all(translationPromises);
      for (const { mod, index } of results) {
        translatedMods[index] = mod;
      }
    }

    for (let i = 0; i < mods.length; i++) {
      if (!translatedMods[i]) {
        translatedMods[i] = mods[i];
      }
    }

    return translatedMods;
  }

  /**
   * Requests background translation for a mod description.
   * 
   * Returns original text immediately. Translation happens in background.
   * When translation completes, emits translation:completed event.
   * 
   * @param mod - Mod to translate
   * @param language - Target language
   * @returns Mod with original description (translation will be in event)
   */
  static requestBackgroundTranslation(
    mod: Mod | CurseForgeMod,
    language: Language
  ): Mod | CurseForgeMod {
    if (language === "en") {
      return mod;
    }

    const description = this.getModDescription(mod);
    if (!description || description.trim().length === 0) {
      return mod;
    }

    const modId = this.getModId(mod);
    if (!modId) {
      const fallbackId = `mod-${mod.name || "unknown"}-${language}`;
      backgroundTranslationQueue.requestTranslation({
        id: fallbackId,
        text: description,
        targetLanguage: language,
        context: "mods",
        metadata: { modName: mod.name }
      });
      return mod;
    }

    const jobId = this.getCacheKey(modId, language);

    const cached = this.getCachedTranslation(modId, language, description);
    if (cached !== null) {
      if (this.isCurseForgeMod(mod)) {
        return { ...mod, summary: cached };
      }
      return { ...mod, description: cached };
    }

    const translated = backgroundTranslationQueue.requestTranslation({
      id: jobId,
      text: description,
      targetLanguage: language,
      context: "mods",
      metadata: {
        modId,
        modName: mod.name
      }
    });

    if (translated !== description) {
      this.setCachedTranslation(modId, language, description, translated);
      
      if (this.isCurseForgeMod(mod)) {
        return { ...mod, summary: translated };
      }
      return { ...mod, description: translated };
    }

    return mod;
  }

  /**
   * Requests background translations for a list of mods.
   * 
   * Returns mods with original descriptions. Translations happen in background.
   * 
   * @param mods - List of mods
   * @param language - Target language
   * @returns List of mods with original descriptions
   */
  static requestBackgroundTranslations<T extends Mod | CurseForgeMod>(
    mods: T[],
    language: Language
  ): T[] {
    if (language === "en") {
      return mods;
    }

    return mods.map((mod) => {
      return this.requestBackgroundTranslation(mod, language) as T;
    });
  }

  /**
   * Clears translation cache.
   */
  static clearCache(): void {
    this.cache = { translations: {} };
    if (this.cachePath) {
      try {
        if (fs.existsSync(this.cachePath)) {
          fs.unlinkSync(this.cachePath);
        }
      } catch (error) {
        Logger.warn(
          "ModDescriptionTranslator",
          `Failed to delete cache file: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    Logger.info("ModDescriptionTranslator", "Translation cache cleared");
  }
}
