/**
 * Maximum length of text chunk for a single translation API request.
 */
export const MAX_TRANSLATION_CHUNK_LENGTH = 500;

/**
 * Splits long text into chunks for translation.
 * 
 * @param text - Source text
 * @param maxLength - Maximum chunk length (defaults to 500)
 * @returns Array of text chunks
 */
export function splitTextForTranslation(
  text: string,
  maxLength: number = MAX_TRANSLATION_CHUNK_LENGTH
): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    parts.push(text.slice(i, i + maxLength));
  }
  return parts;
}

/**
 * Normalizes text before translation.
 * 
 * @param text - Source text
 * @returns Normalized text or null if empty
 */
export function normalizeTextForTranslation(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }
  return text.trim();
}
