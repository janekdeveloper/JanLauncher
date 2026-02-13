/**
 * Sanasol authentication provider
 * 
 * Implements passwordless authentication via auth.sanasol.ws
 */
import axios from "axios";
import { Logger } from "../../Logger";
import type { IAuthProvider } from "./AuthProvider";
import type { AuthSession, LoginParams } from "../auth.types";
import {
  AccountState,
  AccountStateReason,
  type AccountValidationResult
} from "../auth.types";

export class SanasolAuth implements IAuthProvider {
  readonly id = "auth.sanasol.ws";
  readonly displayName = "Sanasol";
  readonly authDomain = "auth.sanasol.ws";
  readonly kind = "third-party";
  readonly labelKey = "home.authSystemThirdParty";
  readonly hintKey = "home.authSystemThirdPartyHint";
  readonly dualauthEnv = {
    HYTALE_AUTH_DOMAIN: "auth.sanasol.ws",
    HYTALE_TRUST_OFFICIAL: "true",
    HYTALE_TRUST_ALL_ISSUERS: "false"
  };

  private readonly baseUrl = "https://auth.sanasol.ws";
  private readonly timeout = 30_000;

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/health`, {
        timeout: 5_000,
        validateStatus: () => true
      });
      return true;
    } catch {
      try {
        await axios.head(this.baseUrl, { timeout: 5_000 });
        return true;
      } catch {
        try {
          await axios.get(this.baseUrl, {
            timeout: 5_000,
            validateStatus: () => true
          });
          return true;
        } catch {
          Logger.debug("SanasolAuth", "Health checks failed, but assuming server is available");
          return true;
        }
      }
    }
  }

  async login(params: LoginParams): Promise<AuthSession> {
    const { uuid, username } = params;

    if (!uuid || typeof uuid !== "string") {
      throw new Error("Invalid uuid parameter");
    }
    if (!username || typeof username !== "string") {
      throw new Error("Invalid username parameter");
    }

    try {
      Logger.info("SanasolAuth", `Logging in user: ${username} (${uuid})`);

      const response = await axios.post(
        `${this.baseUrl}/game-session/child`,
        {
          uuid,
          name: username,
          scopes: ["hytale:server", "hytale:client"]
        },
        {
          timeout: this.timeout,
          headers: { "Content-Type": "application/json" }
        }
      );

      const data = response.data as {
        IdentityToken?: string;
        SessionToken?: string;
        identityToken?: string;
        sessionToken?: string;
      };

      const identityToken = data.IdentityToken || data.identityToken;
      const sessionToken = data.SessionToken || data.sessionToken;

      if (!identityToken || !sessionToken) {
        throw new Error("Auth server response missing tokens");
      }

      Logger.info("SanasolAuth", "Login successful");

      return {
        uuid,
        username,
        identityToken,
        sessionToken,
        providerId: this.id
      };
    } catch (error) {
      Logger.error("SanasolAuth", "Login failed", error);
      throw new Error(
        `Sanasol authentication failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async refresh(session: AuthSession): Promise<AuthSession> {
    return this.login({
      uuid: session.uuid,
      username: session.username
    });
  }

  async getSession(session: AuthSession): Promise<AuthSession | null> {
    if (!this.isTokenFormatValid(session.identityToken) || !this.isTokenFormatValid(session.sessionToken)) {
      return null;
    }
    return session;
  }

  async validateSession(session: AuthSession): Promise<AccountValidationResult> {
    if (!session.identityToken || !session.sessionToken) {
      return {
        state: AccountState.INVALID,
        reason: AccountStateReason.TOKENS_MISSING,
        canLaunch: false
      };
    }

    if (!this.isTokenFormatValid(session.identityToken) || !this.isTokenFormatValid(session.sessionToken)) {
      return {
        state: AccountState.INVALID,
        reason: AccountStateReason.RELOGIN_REQUIRED,
        canLaunch: false,
        session
      };
    }

    const tokenUsername = this.getUsernameFromToken(session.identityToken);
    if (tokenUsername && tokenUsername !== session.username) {
      Logger.warn(
        "SanasolAuth",
        `Token username mismatch: token has '${tokenUsername}', expected '${session.username}'. Tokens need to be regenerated.`
      );
      return {
        state: AccountState.INVALID,
        reason: AccountStateReason.RELOGIN_REQUIRED,
        canLaunch: false,
        session
      };
    }

    return {
      state: AccountState.VALID,
      reason: AccountStateReason.NONE,
      canLaunch: true,
      session
    };
  }

  async refreshSession(session: AuthSession): Promise<AuthSession> {
    Logger.info("SanasolAuth", `Refreshing session for user: ${session.username}`);
    return this.refresh(session);
  }

  isAuthError(error: unknown): boolean {
    if (!error) return false;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    const authErrorPatterns = [
      "authentication",
      "unauthorized",
      "token expired",
      "invalid token",
      "credentials required",
      "username mismatch",
      "token validation failed",
      "auth",
      "401",
      "403"
    ];

    return authErrorPatterns.some((pattern) => lowerMessage.includes(pattern));
  }

  async getAccountState(session: AuthSession): Promise<AccountState> {
    const validation = await this.validateSession(session);
    return validation.state;
  }

  /**
   * Sanasol tokens should always be regenerated to ensure they match the current profile nickname.
   * This prevents issues where tokens contain outdated usernames.
   */
  shouldAlwaysRegenerateTokens(): boolean {
    return true;
  }

  private isTokenFormatValid(token: string): boolean {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return false;
      }
      JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract username from JWT token payload
   * Returns null if token cannot be decoded or username is not present
   */
  private getUsernameFromToken(token: string): string | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      return payload.name || payload.username || null;
    } catch {
      return null;
    }
  }
}
