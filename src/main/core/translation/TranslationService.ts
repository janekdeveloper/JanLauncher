import { Logger } from "../Logger";
import { MyMemoryProvider } from "./providers/MyMemoryProvider";
import { GoogleTranslateProvider } from "./providers/GoogleTranslateProvider";
import type { Language, TranslationProvider, TranslationResult } from "./translation.types";
import {
  normalizeTextForTranslation,
  splitTextForTranslation
} from "./utils";

/**
 * Orchestrates text translation with automatic text splitting and result merging.
 * 
 * Handles business logic for translation: text normalization, chunking long texts,
 * and fallback behavior. Does not know about specific API implementations.
 */
export class TranslationService {
  private primaryProvider: TranslationProvider;
  private fallbackProvider: TranslationProvider;
  private sourceLang: Language;

  /**
   * @param primaryProvider - Primary translation provider (defaults to MyMemoryProvider)
   * @param fallbackProvider - Fallback translation provider (defaults to GoogleTranslateProvider)
   * @param sourceLang - Source language (defaults to 'en')
   */
  constructor(
    primaryProvider: TranslationProvider = new MyMemoryProvider(),
    fallbackProvider: TranslationProvider = new GoogleTranslateProvider(),
    sourceLang: Language = "en"
  ) {
    this.primaryProvider = primaryProvider;
    this.fallbackProvider = fallbackProvider;
    this.sourceLang = sourceLang;
  }

  /**
   * Translates text to target language.
   * 
   * Automatically handles empty strings, skips translation when languages match,
   * splits long texts into chunks, and merges results.
   * 
   * @param text - Text to translate
   * @param targetLang - Target language
   * @returns Translated text or original if translation fails
   */
  async translateText(
    text: string,
    targetLang: Language
  ): Promise<string> {
    if (!targetLang) {
      Logger.warn(
        "TranslationService",
        `Invalid targetLang: ${targetLang}, returning original text`
      );
      return text;
    }

    const normalized = normalizeTextForTranslation(text);
    if (normalized === null) {
      return text;
    }

    if (targetLang === this.sourceLang) {
      Logger.debug(
        "TranslationService",
        `Skipping translation: targetLang (${targetLang}) equals sourceLang (${this.sourceLang})`
      );
      return normalized;
    }

    const parts = splitTextForTranslation(normalized);

    if (parts.length === 1) {
      let translated = await this.primaryProvider.translate(
        parts[0],
        this.sourceLang,
        targetLang
      );

      if (!translated) {
        Logger.debug(
          "TranslationService",
          `Primary provider failed, trying fallback provider for text (${normalized.length} chars)`
        );
        translated = await this.fallbackProvider.translate(
          parts[0],
          this.sourceLang,
          targetLang
        );
      }

      if (translated) {
        Logger.debug(
          "TranslationService",
          `Successfully translated text (${normalized.length} chars) from ${this.sourceLang} to ${targetLang}`
        );
        return translated;
      }

      Logger.warn(
        "TranslationService",
        `Translation failed with both providers, returning original text (${normalized.length} chars)`
      );
      return normalized;
    }

    Logger.debug(
      "TranslationService",
      `Translating long text (${normalized.length} chars) in ${parts.length} parts`
    );

    const translatedParts: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let translated = await this.primaryProvider.translate(
        part,
        this.sourceLang,
        targetLang
      );

      if (!translated) {
        Logger.debug(
          "TranslationService",
          `Primary provider failed for part ${i + 1}/${parts.length}, trying fallback provider`
        );
        translated = await this.fallbackProvider.translate(
          part,
          this.sourceLang,
          targetLang
        );
      }

      if (translated) {
        translatedParts.push(translated);
        Logger.debug(
          "TranslationService",
          `Translated part ${i + 1}/${parts.length} (${part.length} chars)`
        );
      } else {
        Logger.warn(
          "TranslationService",
          `Translation failed for part ${i + 1}/${parts.length} with both providers, using original`
        );
        translatedParts.push(part);
      }
    }

    const result = translatedParts.join(" ");
    Logger.debug(
      "TranslationService",
      `Successfully translated long text: ${normalized.length} -> ${result.length} chars`
    );

    return result;
  }

  /**
   * Translates text and returns detailed result with metadata.
   * 
   * @param text - Text to translate
   * @param targetLang - Target language
   * @returns Translation result with success status and metadata
   */
  async translateTextWithResult(
    text: string,
    targetLang: Language
  ): Promise<TranslationResult> {
    const normalized = normalizeTextForTranslation(text);
    if (normalized === null) {
      return {
        text: text,
        sourceLang: this.sourceLang,
        targetLang,
        success: true
      };
    }

    if (targetLang === this.sourceLang) {
      return {
        text: normalized,
        sourceLang: this.sourceLang,
        targetLang,
        success: true
      };
    }

    const translated = await this.translateText(normalized, targetLang);
    const success = translated !== normalized || targetLang === this.sourceLang;

    return {
      text: translated,
      sourceLang: this.sourceLang,
      targetLang,
      success
    };
  }

  /**
   * Sets a new primary translation provider.
   * 
   * @param provider - New primary translation provider
   */
  setProvider(provider: TranslationProvider): void {
    this.primaryProvider = provider;
  }

  /**
   * Sets a new fallback translation provider.
   * 
   * @param provider - New fallback translation provider
   */
  setFallbackProvider(provider: TranslationProvider): void {
    this.fallbackProvider = provider;
  }

  /**
   * Sets the source language.
   * 
   * @param sourceLang - Source language
   */
  setSourceLanguage(sourceLang: Language): void {
    this.sourceLang = sourceLang;
  }
}

/**
 * Singleton translation service instance for convenience.
 */
export const translationService = new TranslationService();
