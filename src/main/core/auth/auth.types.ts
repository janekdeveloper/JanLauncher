/**
 * Types for authentication system
 */

export type AuthSession = {
  uuid: string;
  username: string;
  identityToken: string;
  sessionToken: string;
  expiresAt?: number;
  providerId: string;
  /** OAuth refresh token. Internal use only; never expose to renderer. */
  refreshToken?: string;
};

export type AuthProviderId = string;

export type AuthProviderKind = "official" | "third-party";

export type LoginParams = {
  uuid: string;
  username: string;
  [key: string]: unknown;
};

export type AuthProviderInfo = {
  id: AuthProviderId;
  displayName: string;
  isAvailable: boolean;
  authDomain: string;
  kind: AuthProviderKind;
  labelKey?: string;
  hintKey?: string;
  descriptionKey?: string;
};

/**
 * Account validation state
 */
export enum AccountState {
  /** Account is valid and ready to use */
  VALID = "VALID",
  /** Tokens expired but can be refreshed */
  EXPIRED = "EXPIRED",
  /** Currently refreshing tokens */
  REGENERATING = "REGENERATING",
  /** Account is invalid, re-login required */
  INVALID = "INVALID"
}

/**
 * Reason for account state
 */
export enum AccountStateReason {
  /** No reason, account is valid */
  NONE = "NONE",
  /** Tokens expired */
  TOKENS_EXPIRED = "TOKENS_EXPIRED",
  /** Tokens missing */
  TOKENS_MISSING = "TOKENS_MISSING",
  /** Refresh failed */
  REFRESH_FAILED = "REFRESH_FAILED",
  /** Re-login required */
  RELOGIN_REQUIRED = "RELOGIN_REQUIRED",
  /** Auth error detected */
  AUTH_ERROR = "AUTH_ERROR",
  /** Provider unavailable */
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
}

/**
 * Account validation result
 */
export type AccountValidationResult = {
  state: AccountState;
  reason: AccountStateReason;
  canLaunch: boolean;
  session?: AuthSession;
  error?: string;
};
