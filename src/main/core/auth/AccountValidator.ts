/**
 * Account Validator
 * 
 * Orchestrates account validation through auth providers.
 * Does NOT know implementation details of token validation.
 * Works purely through provider abstraction.
 */
import { Logger } from "../Logger";
import { AuthManager } from "./AuthManager";
import { PlayerProfileManager } from "../../services/PlayerProfileManager";
import {
  AccountState,
  AccountStateReason,
  type AccountValidationResult,
  type AuthSession,
  type AuthProviderId
} from "./auth.types";
import type { IAuthProvider } from "./providers/AuthProvider";

export class AccountValidator {
  /**
   * Validate account for a profile
   * 
   * Flow:
   * 1. Get session from profile
   * 2. Get provider for profile
   * 3. Call provider.validateSession()
   * 4. If not VALID, try provider.refreshSession()
   * 5. Return unified result
   * 
   * @param profileId Player profile ID
   * @returns Account validation result
   */
  static async validateAccount(profileId: string): Promise<AccountValidationResult> {
    try {
      const profileManager = new PlayerProfileManager();
      const profile = profileManager.getProfile(profileId);
      const providerId = AuthManager.resolveProviderId(profile.authDomain);
      const provider = AuthManager.getProvider(providerId);

      if (provider.shouldAlwaysRegenerateTokens?.()) {
        Logger.info(
          "AccountValidator",
          `Provider ${providerId} requires token regeneration, performing fresh login for profile ${profileId}`
        );
        try {
          const freshSession = await AuthManager.login(profileId, providerId, {
            uuid: profile.id,
            username: profile.nickname
          });
          
          const validation = await provider.validateSession(freshSession);
          return {
            ...validation,
            session: freshSession
          };
        } catch (error) {
          Logger.error("AccountValidator", `Failed to regenerate tokens for profile ${profileId}`, error);
          return {
            state: AccountState.INVALID,
            reason: AccountStateReason.RELOGIN_REQUIRED,
            canLaunch: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }

      const session = await AuthManager.getSession(profileId);
      if (!session) {
        return {
          state: AccountState.INVALID,
          reason: AccountStateReason.TOKENS_MISSING,
          canLaunch: false
        };
      }

      const validationResult = await provider.validateSession(session);
      
      if (validationResult.state === AccountState.VALID) {
        return validationResult;
      }

      if (
        validationResult.state === AccountState.EXPIRED ||
        validationResult.state === AccountState.INVALID
      ) {
        try {
          const refreshed = await provider.refreshSession(session);
          
          const refreshedValidation = await provider.validateSession(refreshed);
          
          if (refreshedValidation.state === AccountState.VALID) {
            await AuthManager.saveSession(profileId, refreshed);
            return {
              ...refreshedValidation,
              session: refreshed
            };
          }
          
          return {
            state: AccountState.INVALID,
            reason: AccountStateReason.REFRESH_FAILED,
            canLaunch: false,
            error: "Session refresh failed"
          };
        } catch (error) {
          Logger.warn(
            "AccountValidator",
            `Failed to refresh session for profile ${profileId}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          
          return {
            state: AccountState.INVALID,
            reason: AccountStateReason.REFRESH_FAILED,
            canLaunch: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }

      return validationResult;
    } catch (error) {
      Logger.error("AccountValidator", `Validation failed for profile ${profileId}`, error);
      return {
        state: AccountState.INVALID,
        reason: AccountStateReason.RELOGIN_REQUIRED,
        canLaunch: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get account state for a profile
   * 
   * @param profileId Player profile ID
   * @returns Account state
   */
  static async getAccountState(profileId: string): Promise<AccountValidationResult> {
    try {
      const session = await AuthManager.getSession(profileId);
      if (!session) {
        return {
          state: AccountState.INVALID,
          reason: AccountStateReason.TOKENS_MISSING,
          canLaunch: false
        };
      }

      const provider = this.getProviderForSession(session);
      if (!provider) {
        return {
          state: AccountState.INVALID,
          reason: AccountStateReason.PROVIDER_UNAVAILABLE,
          canLaunch: false
        };
      }

      return await provider.validateSession(session);
    } catch (error) {
      Logger.error("AccountValidator", `Failed to get account state for profile ${profileId}`, error);
      return {
        state: AccountState.INVALID,
        reason: AccountStateReason.RELOGIN_REQUIRED,
        canLaunch: false
      };
    }
  }

  /**
   * Handle authentication error from game/launcher
   * 
   * @param profileId Player profile ID
   * @param error Error that occurred
   * @returns Account validation result
   */
  static async handleAuthError(
    profileId: string,
    error: unknown
  ): Promise<AccountValidationResult> {
    try {
      const session = await AuthManager.getSession(profileId);
      if (!session) {
        return {
          state: AccountState.INVALID,
          reason: AccountStateReason.TOKENS_MISSING,
          canLaunch: false
        };
      }

      const provider = this.getProviderForSession(session);
      if (!provider) {
        return {
          state: AccountState.INVALID,
          reason: AccountStateReason.PROVIDER_UNAVAILABLE,
          canLaunch: false
        };
      }

      if (!provider.isAuthError(error)) {
        return {
          state: AccountState.VALID,
          reason: AccountStateReason.NONE,
          canLaunch: true,
          session
        };
      }

      Logger.warn(
        "AccountValidator",
        `Auth error detected for profile ${profileId}, attempting recovery`
      );

      try {
        const refreshed = await provider.refreshSession(session);
        const validation = await provider.validateSession(refreshed);
        
        if (validation.state === AccountState.VALID) {
          await AuthManager.saveSession(profileId, refreshed);
          return {
            ...validation,
            session: refreshed
          };
        }
      } catch (refreshError) {
        Logger.warn(
          "AccountValidator",
          `Failed to refresh after auth error: ${
            refreshError instanceof Error ? refreshError.message : String(refreshError)
          }`
        );
      }

      return {
        state: AccountState.INVALID,
        reason: AccountStateReason.AUTH_ERROR,
        canLaunch: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } catch (error) {
      Logger.error("AccountValidator", `Failed to handle auth error for profile ${profileId}`, error);
      return {
        state: AccountState.INVALID,
        reason: AccountStateReason.AUTH_ERROR,
        canLaunch: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get provider for session
   */
  private static getProviderForSession(session: AuthSession): IAuthProvider | null {
    try {
      return AuthManager.getProvider(session.providerId as AuthProviderId);
    } catch {
      return null;
    }
  }
}
