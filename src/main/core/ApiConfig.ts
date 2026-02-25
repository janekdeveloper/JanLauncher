export const PATCH_BASE_URL = process.env.PATCH_BASE_URL?.trim() || "https://cobylobbyht.store/launcher/patches";

export const JANNET_API_BASE_URL = process.env.JANNET_API_BASE_URL?.trim() || "https://api.jannet.cc";

export function getPatchBaseUrl(): string {
  return normalizeBaseUrl(PATCH_BASE_URL);
}

export function getJanNetApiBaseUrl(): string {
  return normalizeBaseUrl(JANNET_API_BASE_URL);
}

/**
 * @deprecated Use getPatchBaseUrl() or getJanNetApiBaseUrl()
 */
export function getApiBaseUrl(): string {
  return getJanNetApiBaseUrl();
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}
