const DEFAULT_API_BASE_URL = "https://api.jannet.cc";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Returns base URL for JanNet API used by the launcher.
 *
 * Can be overridden via JANNET_API_BASE_URL environment variable for dev/stage.
 */
export function getApiBaseUrl(): string {
  const envBase = process.env.JANNET_API_BASE_URL;
  const base = envBase && envBase.trim().length > 0 ? envBase.trim() : DEFAULT_API_BASE_URL;
  return normalizeBaseUrl(base);
}

/**
 * Returns base URL for patch files (.pwr) on JanNet.
 *
 * Examples:
 *  https://api.jannet.cc/launcher/patches
 *  http://localhost:8000/launcher/patches
 */
export function getPatchBaseUrl(): string {
  return `${getApiBaseUrl()}/launcher/patches`;
}

