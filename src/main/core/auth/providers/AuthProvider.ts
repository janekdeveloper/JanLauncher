/**
 * Base interface for all authentication providers
 * 
 * Each auth provider must implement this interface to be used by AuthManager.
 * This abstraction allows adding new auth systems without modifying existing code.
 */
import type {
  AuthSession,
  LoginParams,
  AuthProviderInfo,
  AccountState,
  AccountStateReason,
  AccountValidationResult
} from "../auth.types";

export interface IAuthProvider {
  /**
   * Unique identifier for this provider (e.g., "hytale.com", "sanasol.ws")
   */
  readonly id: string;

  /**
   * Human-readable display name
   */
  readonly displayName: string;

  /**
   * Check if this provider is available (server reachable, configured, etc.)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Perform login and return session tokens
   * 
   * @param params Login parameters (uuid, username, provider-specific params)
   * @returns Auth session with tokens
   * @throws Error if login fails
   */
  login(params: LoginParams): Promise<AuthSession>;

  /**
   * Logout (invalidate session, clear tokens)
   * 
   * @param session Current session to logout
   */
  logout?(session: AuthSession): Promise<void>;

  /**
   * Refresh expired tokens
   * 
   * @param session Current session
   * @returns New session with refreshed tokens
   * @throws Error if refresh fails
   */
  refresh?(session: AuthSession): Promise<AuthSession>;

  /**
   * Get current session info (validate, check expiry)
   * 
   * @param session Current session
   * @returns Validated session or null if invalid
   */
  getSession?(session: AuthSession): Promise<AuthSession | null>;

  /**
   * Validate session and return account state
   * Provider decides: is token expired? missing? invalid?
   * 
   * @param session Current session to validate
   * @returns Account validation result with state
   */
  validateSession(session: AuthSession): Promise<AccountValidationResult>;

  /**
   * Refresh session tokens if possible
   * 
   * @param session Current session
   * @returns New session with refreshed tokens
   * @throws Error if refresh is not possible or fails
   */
  refreshSession(session: AuthSession): Promise<AuthSession>;

  /**
   * Check if an error is authentication-related
   * Provider decides based on error type/message
   * 
   * @param error Error to check
   * @returns true if error is auth-related
   */
  isAuthError(error: unknown): boolean;

  /**
   * Get account state from session
   * Provider-specific logic to determine state
   * 
   * @param session Current session
   * @returns Account state
   */
  getAccountState(session: AuthSession): Promise<AccountState>;

  /**
   * Check if this provider requires tokens to be regenerated on every validation
   * 
   * If true, tokens will always be regenerated via login() instead of using cached tokens.
   * This is useful for providers where tokens are stateless or should not be cached.
   * 
   * @returns true if tokens should always be regenerated, false otherwise
   */
  shouldAlwaysRegenerateTokens?(): boolean;
}
