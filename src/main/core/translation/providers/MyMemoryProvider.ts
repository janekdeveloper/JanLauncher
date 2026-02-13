import axios from "axios";
import { Logger } from "../../Logger";
import type { Language, TranslationProvider } from "../translation.types";

/**
 * Translation provider using MyMemory Translation API.
 * 
 * Responsible only for making HTTP requests to the MyMemory API.
 */
export class MyMemoryProvider implements TranslationProvider {
  private static readonly API_URL = "https://api.mymemory.translated.net/get";
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
   * Translates text via MyMemory API.
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
          "MyMemoryProvider",
          `Invalid language parameters: sourceLang=${sourceLang}, targetLang=${targetLang}`
        );
        return null;
      }

      const sourceCode = MyMemoryProvider.LANGUAGE_CODES[sourceLang];
      const targetCode = MyMemoryProvider.LANGUAGE_CODES[targetLang];

      if (!sourceCode || !targetCode) {
        Logger.warn(
          "MyMemoryProvider",
          `Language code not found: sourceLang=${sourceLang} (${sourceCode}), targetLang=${targetLang} (${targetCode})`
        );
        return null;
      }

      if (sourceCode === targetCode) {
        return text;
      }

      const response = await axios.get<{
        responseData?: { translatedText?: string };
        matches?: Array<{ translation?: string }>;
      }>(MyMemoryProvider.API_URL, {
        params: {
          q: text,
          langpair: `${sourceCode}|${targetCode}`
        },
        timeout: MyMemoryProvider.REQUEST_TIMEOUT_MS
      });

      const translatedText =
        response.data.responseData?.translatedText ||
        response.data.matches?.[0]?.translation;

      if (translatedText && translatedText.trim()) {
        return translatedText.trim();
      }

      return null;
    } catch (error) {
      Logger.warn(
        "MyMemoryProvider",
        `Translation failed for text: ${text.substring(0, 50)}... - ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }
}
