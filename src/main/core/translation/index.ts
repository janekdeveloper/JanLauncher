/**
 * Translation module.
 * 
 * Provides reusable translation service for use across the application.
 */

export { TranslationService, translationService } from "./TranslationService";
export { MyMemoryProvider } from "./providers/MyMemoryProvider";
export { GoogleTranslateProvider } from "./providers/GoogleTranslateProvider";
export {
  BackgroundTranslationQueue,
  backgroundTranslationQueue
} from "./BackgroundTranslationQueue";
export type {
  Language,
  TranslationProvider,
  TranslationResult
} from "./translation.types";
export type {
  TranslationJob,
  TranslationJobResult,
  TranslationContext
} from "./BackgroundTranslationQueue";
export {
  MAX_TRANSLATION_CHUNK_LENGTH,
  normalizeTextForTranslation,
  splitTextForTranslation
} from "./utils";
