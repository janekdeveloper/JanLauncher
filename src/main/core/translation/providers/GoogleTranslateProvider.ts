import axios from "axios";
import { Logger } from "../../Logger";
import type { Language, TranslationProvider } from "../translation.types";

/**
 * Translation provider using Google Translate (unofficial API).
 * 
 * Uses free Google Translate endpoint without API key.
 * Responsible only for making HTTP requests to the Google Translate API.
 */
export class GoogleTranslateProvider implements TranslationProvider {
  private static readonly API_URL = "https://translate.googleapis.com/translate_a/single";
  private static readonly REQUEST_TIMEOUT_MS = 10_000;

  private static readonly LANGUAGE_CODES: Record<Language, string> = {
    ru: "ru",
    en: "en",
    uk: "uk",
    pl: "pl",
    be: "be",
    es: "es"
  };

  /**
   * Translates text via Google Translate API.
   * 
   * @param text - Text to translate
   * @param sourceLang - Source language (defaults to 'en')
   * @param targetLang - Target language
   * @returns Translated text or null on error
   */
  async translate(
    text: string,
    sourceLang: Language = "en",
    targetLang: Language
  ): Promise<string | null> {
    try {
      if (!sourceLang || !targetLang) {
        Logger.warn(
          "GoogleTranslateProvider",
          `Invalid language parameters: sourceLang=${sourceLang}, targetLang=${targetLang}`
        );
        return null;
      }

      const sourceCode = GoogleTranslateProvider.LANGUAGE_CODES[sourceLang];
      const targetCode = GoogleTranslateProvider.LANGUAGE_CODES[targetLang];

      if (!sourceCode || !targetCode) {
        Logger.warn(
          "GoogleTranslateProvider",
          `Language code not found: sourceLang=${sourceLang} (${sourceCode}), targetLang=${targetLang} (${targetCode})`
        );
        return null;
      }

      if (sourceCode === targetCode) {
        return text;
      }

      const response = await axios.get<unknown>(
        GoogleTranslateProvider.API_URL,
        {
          params: {
            client: "gtx",
            sl: sourceCode,
            tl: targetCode,
            dt: "t",
            q: text
          },
          timeout: GoogleTranslateProvider.REQUEST_TIMEOUT_MS,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        }
      );

      let translatedText: string | null = null;

      if (Array.isArray(response.data) && response.data.length > 0) {
        const firstElement = response.data[0];
        if (Array.isArray(firstElement) && firstElement.length > 0) {
          const secondElement = firstElement[0];
          if (Array.isArray(secondElement) && secondElement.length > 0) {
            const textCandidate = secondElement[0];
            if (typeof textCandidate === "string") {
              translatedText = textCandidate;
            }
          } else if (typeof secondElement === "string") {
            translatedText = secondElement;
          }
        }
      }

      if (translatedText && translatedText.trim()) {
        return translatedText.trim();
      }

      return null;
    } catch (error) {
      Logger.warn(
        "GoogleTranslateProvider",
        `Translation failed for text: ${text.substring(0, 50)}... - ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }
}
