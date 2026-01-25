import { EventEmitter } from "node:events";
import { Logger } from "../Logger";
import { TranslationService } from "./TranslationService";
import { MyMemoryProvider } from "./providers/MyMemoryProvider";
import type { Language } from "./translation.types";

/**
 * Translation context for logging and caching purposes.
 */
export type TranslationContext = "mods" | "news" | "ui" | "other";

/**
 * Translation job definition.
 */
export interface TranslationJob {
  id: string;
  text: string;
  targetLanguage: Language;
  context: TranslationContext;
  metadata?: Record<string, unknown>;
}

/**
 * Translation job result.
 */
export interface TranslationJobResult {
  jobId: string;
  originalText: string;
  translatedText: string;
  success: boolean;
  context: TranslationContext;
  metadata?: Record<string, unknown>;
}

interface InMemoryCache {
  translations: Map<string, string>;
  pending: Set<string>;
}

/**
 * Background translation queue with concurrency control and deduplication.
 * 
 * Manages translation jobs, limits parallelism, prevents duplicate jobs,
 * caches results, and emits events when translations complete.
 */
export class BackgroundTranslationQueue extends EventEmitter {
  private queue: TranslationJob[] = [];
  private activeJobs: Set<string> = new Set();
  private cache: InMemoryCache = {
    translations: new Map(),
    pending: new Set()
  };
  private maxConcurrency: number;
  private translationService: TranslationService;

  /**
   * @param maxConcurrency - Maximum number of parallel translations (defaults to 2)
   */
  constructor(maxConcurrency: number = 2) {
    super();
    this.maxConcurrency = maxConcurrency;
    this.translationService = new TranslationService();
    
    Logger.info(
      "BackgroundTranslationQueue",
      `Initialized with maxConcurrency=${maxConcurrency}`
    );
  }

  /**
   * Requests translation for a job.
   * 
   * Returns cached translation immediately if available. If job is already queued,
   * returns original text. Otherwise, queues the job and returns original text.
   * 
   * @param job - Translation job
   * @returns Translated text from cache or original text
   */
  requestTranslation(job: TranslationJob): string {
    const cached = this.cache.translations.get(job.id);
    if (cached !== undefined) {
      Logger.debug(
        "BackgroundTranslationQueue",
        `Cache hit for job ${job.id} (${job.context})`
      );
      return cached;
    }

    if (this.cache.pending.has(job.id) || this.activeJobs.has(job.id)) {
      Logger.debug(
        "BackgroundTranslationQueue",
        `Job ${job.id} already queued or in progress (${job.context})`
      );
      return job.text;
    }

    if (job.targetLanguage === "en") {
      this.cache.translations.set(job.id, job.text);
      return job.text;
    }

    if (!job.text || job.text.trim().length === 0) {
      this.cache.translations.set(job.id, job.text);
      return job.text;
    }

    this.cache.pending.add(job.id);
    this.queue.push(job);

    Logger.debug(
      "BackgroundTranslationQueue",
      `Queued translation job ${job.id} (${job.context}, ${job.text.length} chars)`
    );

    this.emit("translation:queued", {
      jobId: job.id,
      context: job.context,
      metadata: job.metadata
    });

    this.processQueue();

    return job.text;
  }

  private async processQueue(): Promise<void> {
    if (this.activeJobs.size >= this.maxConcurrency) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) {
      return;
    }

    const cached = this.cache.translations.get(job.id);
    if (cached !== undefined) {
      this.cache.pending.delete(job.id);
      this.processQueue();
      return;
    }

    this.activeJobs.add(job.id);
    this.cache.pending.delete(job.id);

    Logger.debug(
      "BackgroundTranslationQueue",
      `Processing translation job ${job.id} (${job.context}, active: ${this.activeJobs.size}/${this.maxConcurrency})`
    );

    this.translateJob(job).catch((error) => {
      Logger.error(
        "BackgroundTranslationQueue",
        `Translation job ${job.id} failed`,
        error
      );
    });
  }

  private async translateJob(job: TranslationJob): Promise<void> {
    try {
      const translated = await this.translationService.translateText(
        job.text,
        job.targetLanguage
      );

      if (translated !== job.text || job.targetLanguage === "en") {
        this.cache.translations.set(job.id, translated);
      }

      const result: TranslationJobResult = {
        jobId: job.id,
        originalText: job.text,
        translatedText: translated,
        success: translated !== job.text || job.targetLanguage === "en",
        context: job.context,
        metadata: job.metadata
      };

      Logger.debug(
        "BackgroundTranslationQueue",
        `Translation completed for job ${job.id} (${job.context}, success: ${result.success})`
      );

      this.emit("translation:completed", result);
    } catch (error) {
      const result: TranslationJobResult = {
        jobId: job.id,
        originalText: job.text,
        translatedText: job.text,
        success: false,
        context: job.context,
        metadata: job.metadata
      };

      Logger.warn(
        "BackgroundTranslationQueue",
        `Translation failed for job ${job.id} (${job.context}): ${error instanceof Error ? error.message : String(error)}`
      );

      this.emit("translation:failed", result);
    } finally {
      this.activeJobs.delete(job.id);
      this.processQueue();
    }
  }

  /**
   * Gets cached translation if available.
   * 
   * @param jobId - Job ID
   * @returns Translated text or null if not cached
   */
  getCachedTranslation(jobId: string): string | null {
    return this.cache.translations.get(jobId) ?? null;
  }

  /**
   * Checks if a job is pending or in progress.
   * 
   * @param jobId - Job ID
   * @returns True if job is queued or being processed
   */
  isPending(jobId: string): boolean {
    return this.cache.pending.has(jobId) || this.activeJobs.has(jobId);
  }

  /**
   * Clears translation cache.
   */
  clearCache(): void {
    this.cache.translations.clear();
    this.cache.pending.clear();
    Logger.info("BackgroundTranslationQueue", "Cache cleared");
  }

  /**
   * Gets queue statistics.
   */
  getStats(): {
    queueLength: number;
    activeJobs: number;
    cachedTranslations: number;
  } {
    return {
      queueLength: this.queue.length,
      activeJobs: this.activeJobs.size,
      cachedTranslations: this.cache.translations.size
    };
  }
}

/**
 * Singleton background translation queue instance.
 */
export const backgroundTranslationQueue = new BackgroundTranslationQueue(2);
