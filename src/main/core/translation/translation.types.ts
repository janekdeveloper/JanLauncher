/**
 * Supported languages for translation.
 */
export type Language = "ru" | "en" | "uk" | "pl" | "be" | "es";

/**
 * Translation result with metadata.
 */
export interface TranslationResult {
  text: string;
  sourceLang: Language;
  targetLang: Language;
  success: boolean;
}

/**
 * Translation provider interface.
 * 
 * Providers are responsible only for making HTTP requests to translation APIs.
 * They do not handle text splitting, caching, or retry logic.
 */
export interface TranslationProvider {
  /**
   * Translates text from source language to target language.
   * 
   * @param text - Text to translate
   * @param sourceLang - Source language (defaults to 'en')
   * @param targetLang - Target language
   * @returns Translated text or null on error
   */
  translate(
    text: string,
    sourceLang: Language,
    targetLang: Language
  ): Promise<string | null>;
}
