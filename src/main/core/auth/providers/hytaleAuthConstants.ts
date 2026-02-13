/**
 * Hytale Official OAuth constants.
 * No secrets; client_id is a public identifier.
 */

export const HYTALE_AUTH_DOMAIN = "hytale.com";
export const HYTALE_OAUTH_CLIENT_ID = "hytale-launcher";
export const HYTALE_OAUTH_SCOPES = "openid offline auth:launcher";

export function getOAuthAuthUrl(domain: string): string {
  return `https://oauth.accounts.${domain}/oauth2/auth`;
}

export function getOAuthTokenUrl(domain: string): string {
  return `https://oauth.accounts.${domain}/oauth2/token`;
}

/** Launcher-data paths; first path uses no query params. */
const LAUNCHER_DATA_PATHS = [
  "/my-account/get-launcher-data",
  "/launcher-data",
  "/api/launcher-data",
  "/launcher-data/"
] as const;

export function getLauncherDataBaseUrl(domain: string): string {
  return `https://account-data.${domain}`;
}

export function getLauncherDataPaths(): readonly string[] {
  return LAUNCHER_DATA_PATHS;
}

/** URL for creating game session (short identity/session tokens for client launch). */
export function getGameSessionNewUrl(domain: string): string {
  return `https://sessions.${domain}/game-session/new`;
}

/** Margin in seconds before expiry to consider token expired (trigger refresh). */
export const TOKEN_EXPIRY_MARGIN_SEC = 300;

/** Default timeout for OAuth callback wait (seconds). */
export const OAUTH_CALLBACK_TIMEOUT_SEC = 300;
