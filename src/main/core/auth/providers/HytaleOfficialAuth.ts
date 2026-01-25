/**
 * Official Hytale authentication provider
 * 
 * MOCK IMPLEMENTATION - Official Hytale auth is not yet available.
 * This provider returns mock tokens for development/testing purposes.
 */
import { Logger } from "../../Logger";
import type { IAuthProvider } from "./AuthProvider";
import type { AuthSession, LoginParams } from "../auth.types";
import {
  AccountState,
  AccountStateReason,
  type AccountValidationResult
} from "../auth.types";

export class HytaleOfficialAuth implements IAuthProvider {
  readonly id = "hytale.com";
  readonly displayName = "Hytale Official";

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async login(params: LoginParams): Promise<AuthSession> {
    const { uuid, username } = params;

    if (!uuid || typeof uuid !== "string") {
      throw new Error("Invalid uuid parameter");
    }
    if (!username || typeof username !== "string") {
      throw new Error("Invalid username parameter");
    }

    Logger.warn(
      "HytaleOfficialAuth",
      "Using MOCK tokens - Official Hytale authentication is not yet implemented"
    );

    const mockIdentityToken = this.generateMockToken("identity", uuid, username);
    const mockSessionToken = this.generateMockToken("session", uuid, username);

    return {
      uuid,
      username,
      identityToken: mockIdentityToken,
      sessionToken: mockSessionToken,
      providerId: this.id,
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    };
  }

  /**
   * Generate a mock JWT token for development
   * 
   * WARNING: These tokens will NOT work with real Hytale servers.
   * This is for development/testing only.
   */
  private generateMockToken(type: string, uuid: string, username: string): string {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" })
    ).toString("base64url");

    const payload = Buffer.from(
      JSON.stringify({
        sub: uuid,
        name: username,
        type,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    ).toString("base64url");

    const signature = Buffer.from(`mock-${type}-${uuid.slice(0, 8)}`).toString("base64url");

    return `${header}.${payload}.${signature}`;
  }

  async logout?(session: AuthSession): Promise<void> {
    Logger.info("HytaleOfficialAuth", `Mock logout for user: ${session.uuid}`);
  }

  async refresh?(session: AuthSession): Promise<AuthSession> {
    Logger.info("HytaleOfficialAuth", `Mock refresh for user: ${session.uuid}`);
    return this.refreshSession(session);
  }

  async getSession?(session: AuthSession): Promise<AuthSession | null> {
    const validation = await this.validateSession(session);
    return validation.state === AccountState.VALID ? session : null;
  }

  async validateSession(session: AuthSession): Promise<AccountValidationResult> {
    if (!session.identityToken || !session.sessionToken) {
      return {
        state: AccountState.INVALID,
        reason: AccountStateReason.TOKENS_MISSING,
        canLaunch: false
      };
    }

    const expiresAt = session.expiresAt;
    if (expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt <= now + 300) {
        return {
          state: AccountState.EXPIRED,
          reason: AccountStateReason.TOKENS_EXPIRED,
          canLaunch: false,
          session
        };
      }
    }

    return {
      state: AccountState.VALID,
      reason: AccountStateReason.NONE,
      canLaunch: true,
      session
    };
  }

  async refreshSession(session: AuthSession): Promise<AuthSession> {
    Logger.info("HytaleOfficialAuth", `Mock refreshSession for user: ${session.username}`);
    
    return {
      ...session,
      identityToken: `mock-identity-refreshed-${session.uuid}`,
      sessionToken: `mock-session-refreshed-${session.uuid}`,
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    };
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
      "auth",
      "401",
      "403",
      "hytale auth"
    ];

    return authErrorPatterns.some((pattern) => lowerMessage.includes(pattern));
  }

  async getAccountState(session: AuthSession): Promise<AccountState> {
    const validation = await this.validateSession(session);
    return validation.state;
  }
}
