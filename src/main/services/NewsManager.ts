import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";
import { translationService, type Language } from "../core/translation";
import type { NewsArticle } from "../../shared/types";

const NEWS_API_URL = "https://launcher.hytale.com/launcher-feed/release/feed.json";
const REQUEST_TIMEOUT_MS = 10_000;

interface NewsCache {
  articles: NewsArticle[];
  translations: Record<Language, NewsArticle[]>;
  lastFetch: string;
}

const getCachePath = (): string => {
  return Paths.newsCacheFile;
};

/**
 * Manages news fetching, translation, and caching.
 */
export class NewsManager {
  /**
   * Loads cached news for specified language.
   * 
   * @param language - Target language (defaults to 'en')
   * @returns Cached news articles or null if not available
   */
  static loadCachedNews(language: Language = "en"): NewsArticle[] | null {
    try {
      const cachePath = getCachePath();
      if (!fs.existsSync(cachePath)) {
        Logger.debug("NewsManager", "[CACHE MISS] Cache file does not exist");
        return null;
      }

      const raw = fs.readFileSync(cachePath, "utf-8");
      if (!raw.trim()) {
        Logger.debug("NewsManager", "[CACHE MISS] Cache file is empty");
        return null;
      }

      const cache = JSON.parse(raw) as NewsCache;
      
      if (language === "en") {
        if (cache.articles.length > 0) {
          Logger.info("NewsManager", `[CACHED] Loaded ${cache.articles.length} news articles from cache (language: ${language})`);
          return cache.articles;
        }
        return null;
      }

      const translated = cache.translations[language];
      if (translated && translated.length > 0) {
        Logger.info("NewsManager", `[CACHED] Loaded ${translated.length} translated news articles from cache (language: ${language})`);
        return translated;
      }

      if (cache.articles.length > 0) {
        Logger.info("NewsManager", `[CACHED] No translations for ${language}, returning ${cache.articles.length} original articles from cache`);
        return cache.articles;
      }

      return null;
    } catch (error) {
      Logger.warn("NewsManager", `Failed to load cached news: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Fetches news, compares with cache, translates only new articles, and updates cache.
   * 
   * @param language - Target language for translation (defaults to 'en')
   * @returns News articles in target language
   */
  static async fetchAndUpdateNews(language: Language = "en"): Promise<NewsArticle[]> {
    try {
      Logger.info("NewsManager", "Fetching news from Hytale launcher feed");
      
      const response = await axios.get<{ articles?: Array<{
        title?: string;
        description?: string;
        dest_url?: string;
        image_url?: string;
        date?: string;
      }> }>(NEWS_API_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: REQUEST_TIMEOUT_MS
      });

      const articles = response.data.articles || [];
      
      const mappedArticles: NewsArticle[] = articles.map((article) => {
        let imageUrl = article.image_url || "";
        
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = `https://launcher.hytale.com/launcher-feed/release/${imageUrl}`;
        }

        return {
          title: article.title || "",
          description: article.description || "",
          destUrl: article.dest_url || "",
          imageUrl,
          date: article.date
        };
      });

      Logger.info("NewsManager", `Fetched ${mappedArticles.length} news articles`);

      const cachePath = getCachePath();
      let cache: NewsCache | null = null;
      
      try {
        if (fs.existsSync(cachePath)) {
          const raw = fs.readFileSync(cachePath, "utf-8");
          if (raw.trim()) {
            cache = JSON.parse(raw) as NewsCache;
          }
        }
      } catch (error) {
        Logger.warn("NewsManager", `Failed to load cache: ${error instanceof Error ? error.message : String(error)}`);
      }

      const cachedUrls = new Set(
        cache?.articles.map((a) => a.destUrl).filter(Boolean) || []
      );
      const newArticles = mappedArticles.filter(
        (article) => article.destUrl && !cachedUrls.has(article.destUrl)
      );

      Logger.info("NewsManager", `Found ${newArticles.length} new articles`);

      if (newArticles.length === 0 && cache) {
        if (language === "en") {
          Logger.info("NewsManager", `[CACHED] No new articles, returning ${cache.articles.length} cached articles (language: ${language})`);
          return cache.articles;
        }
        const translated = cache.translations[language];
        if (translated && translated.length > 0) {
          Logger.info("NewsManager", `[CACHED] No new articles, returning ${translated.length} cached translated articles (language: ${language})`);
          return translated;
        }
        Logger.info("NewsManager", `[TRANSLATE] No translations found for ${language}, translating all ${mappedArticles.length} articles`);
      }

      const articlesToTranslate = newArticles.length > 0 ? newArticles : mappedArticles;
      let translatedArticles: NewsArticle[] = mappedArticles;

      if (language !== "en") {
        Logger.info("NewsManager", `[TRANSLATE] Translating ${articlesToTranslate.length} articles to ${language}`);
        const translatedNew = await Promise.all(
          articlesToTranslate.map(async (article) => {
            try {
              const [translatedTitle, translatedDescription] = await Promise.all([
                translationService.translateText(article.title, language),
                article.description
                  ? translationService.translateText(article.description, language)
                  : Promise.resolve("")
              ]);

              return {
                ...article,
                title: translatedTitle || article.title,
                description: translatedDescription || article.description
              };
            } catch (error) {
              Logger.warn("NewsManager", `Failed to translate article: ${article.title} - ${error instanceof Error ? error.message : String(error)}`);
              return article;
            }
          })
        );

        if (newArticles.length > 0 && cache) {
          const cachedTranslated = cache.translations[language] || [];
          const newUrlsSet = new Set(newArticles.map((a) => a.destUrl).filter(Boolean));
          const oldTranslated = cachedTranslated.filter(
            (a) => !a.destUrl || !newUrlsSet.has(a.destUrl)
          );
          translatedArticles = [...translatedNew, ...oldTranslated];
        } else {
          translatedArticles = translatedNew;
        }
      }

      await this.saveCache(mappedArticles, language, translatedArticles);
      
      Logger.info("NewsManager", `[CACHE] Saved ${translatedArticles.length} articles to cache (language: ${language})`);

      return translatedArticles;
    } catch (error) {
      Logger.error("NewsManager", "Failed to fetch news", error);
      throw error;
    }
  }

  private static async saveCache(
    originalArticles: NewsArticle[],
    language: Language,
    translatedArticles: NewsArticle[]
  ): Promise<void> {
    try {
      const cachePath = getCachePath();
      let cache: NewsCache = {
        articles: originalArticles,
        translations: {
          ru: [],
          en: [],
          uk: [],
          pl: [],
          be: [],
          es: []
        },
        lastFetch: new Date().toISOString()
      };

      if (fs.existsSync(cachePath)) {
        try {
          const raw = fs.readFileSync(cachePath, "utf-8");
          if (raw.trim()) {
            const existing = JSON.parse(raw) as NewsCache;
            cache.translations = existing.translations || cache.translations;
          }
        } catch (error) {
          Logger.warn("NewsManager", `Failed to load existing cache for merge: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (language === "en") {
        cache.translations.en = originalArticles;
      } else {
        cache.translations[language] = translatedArticles;
      }

      const tempName = `.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const tempPath = path.join(path.dirname(cachePath), `${path.basename(cachePath)}${tempName}`);
      
      const content = JSON.stringify(cache, null, 2);
      fs.writeFileSync(tempPath, content, "utf-8");
      fs.renameSync(tempPath, cachePath);

      Logger.info("NewsManager", `Cache saved: ${originalArticles.length} articles, translations for ${language}`);
    } catch (error) {
      Logger.error("NewsManager", "Failed to save cache", error);
    }
  }

  /**
   * Clears translation cache.
   */
  static clearCache(): void {
    const cachePath = getCachePath();
    try {
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
        Logger.info("NewsManager", "Translation cache cleared");
      }
    } catch (error) {
      Logger.warn(
        "NewsManager",
        `Failed to delete cache file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
