/**
 * Authentication Manager
 * 
 * Orchestrates authentication providers without knowing implementation details.
 * Acts as a facade between the application and auth providers.
 */
import { Logger } from "../Logger";
import { ConfigStore } from "../ConfigStore";
import type { IAuthProvider } from "./providers/AuthProvider";
import type { AuthSession, AuthProviderId, LoginParams, AuthProviderInfo } from "./auth.types";
import type { PlayerProfile } from "../../../shared/types";

export class AuthManager {
  private static providers = new Map<AuthProviderId, IAuthProvider>();
  private static initialized = false;

  /**
   * Initialize AuthManager and register all available providers
   */
  static init(providers: IAuthProvider[]): void {
    if (this.initialized) {
      Logger.warn("AuthManager", "Already initialized");
      return;
    }

    this.providers.clear();
    for (const provider of providers) {
      this.providers.set(provider.id as AuthProviderId, provider);
      Logger.info("AuthManager", `Registered auth provider: ${provider.id} (${provider.displayName})`);
    }

    this.initialized = true;
    Logger.info("AuthManager", `Initialized with ${this.providers.size} providers`);
  }

  /**
   * Get list of all available providers with their status
   */
  static async getProviders(): Promise<AuthProviderInfo[]> {
    this.ensureInitialized();

    const providers: AuthProviderInfo[] = [];
    for (const provider of this.providers.values()) {
      const isAvailable = await provider.isAvailable();
      providers.push({
        id: provider.id as AuthProviderId,
        displayName: provider.displayName,
        isAvailable
      });
    }

    return providers;
  }

  /**
   * Get provider by ID
   */
  static getProvider(providerId: AuthProviderId): IAuthProvider {
    this.ensureInitialized();

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Auth provider not found: ${providerId}`);
    }

    return provider;
  }

  /**
   * Save session to profile (for AccountValidator)
   */
  static async saveSession(profileId: string, session: AuthSession): Promise<void> {
    this.saveSessionToProfile(profileId, session, session.providerId as AuthProviderId);
  }

  /**
   * Login user with specified provider
   * 
   * @param profileId Player profile ID
   * @param providerId Auth provider to use
   * @param params Login parameters (uuid, username, etc.)
   * @returns Auth session
   */
  static async login(
    profileId: string,
    providerId: AuthProviderId,
    params: LoginParams
  ): Promise<AuthSession> {
    this.ensureInitialized();

    const provider = this.getProvider(providerId);
    const isAvailable = await provider.isAvailable();

    if (!isAvailable) {
      throw new Error(`Auth provider ${providerId} is not available`);
    }

    Logger.info("AuthManager", `Logging in profile ${profileId} with provider ${providerId}`);

    try {
      const session = await provider.login(params);

      this.saveSessionToProfile(profileId, session, providerId);

      Logger.info("AuthManager", `Login successful for profile ${profileId}`);
      return session;
    } catch (error) {
      Logger.error("AuthManager", `Login failed for profile ${profileId}`, error);
      this.markProfileAsInvalid(profileId);
      throw error;
    }
  }

  /**
   * Get current session for a profile
   * Returns session from profile, does NOT validate
   * Use AccountValidator.validateAccount() for validation
   */
  static async getSession(profileId: string): Promise<AuthSession | null> {
    this.ensureInitialized();

    const profile = this.getProfile(profileId);
    const providerId = (profile.authDomain || "sanasol.ws") as AuthProviderId;

    if (!profile.authTokens) {
      return null;
    }

    return {
      uuid: profile.id,
      username: profile.nickname,
      identityToken: profile.authTokens.identityToken,
      sessionToken: profile.authTokens.sessionToken,
      providerId
    };
  }

  /**
   * Refresh session tokens
   */
  static async refreshSession(profileId: string): Promise<AuthSession | null> {
    this.ensureInitialized();

    const profile = this.getProfile(profileId);
    const providerId = (profile.authDomain || "sanasol.ws") as AuthProviderId;
    const provider = this.getProvider(providerId);

    if (!profile.authTokens) {
      return null;
    }

    const currentSession: AuthSession = {
      uuid: profile.id,
      username: profile.nickname,
      identityToken: profile.authTokens.identityToken,
      sessionToken: profile.authTokens.sessionToken,
      providerId
    };

    try {
      if (provider.refresh) {
        const refreshed = await provider.refresh(currentSession);
        this.saveSessionToProfile(profileId, refreshed, providerId);
        return refreshed;
      } else {
        return await this.login(profileId, providerId, {
          uuid: profile.id,
          username: profile.nickname
        });
      }
    } catch (error) {
      Logger.error("AuthManager", `Failed to refresh session for profile ${profileId}`, error);
      this.markProfileAsInvalid(profileId);
      return null;
    }
  }

  /**
   * Logout user (invalidate session)
   */
  static async logout(profileId: string): Promise<void> {
    this.ensureInitialized();

    const profile = this.getProfile(profileId);
    const providerId = (profile.authDomain || "sanasol.ws") as AuthProviderId;
    const provider = this.getProvider(providerId);

    if (!profile.authTokens) {
      return;
    }

    const session: AuthSession = {
      uuid: profile.id,
      username: profile.nickname,
      identityToken: profile.authTokens.identityToken,
      sessionToken: profile.authTokens.sessionToken,
      providerId
    };

    try {
      if (provider.logout) {
        await provider.logout(session);
      }
    } catch (error) {
      Logger.warn("AuthManager", `Logout failed for profile ${profileId}, Error: ${error}`);
    }

    ConfigStore.updatePlayerProfile(profileId, {
      authTokens: undefined,
      authInvalid: false
    });

    Logger.info("AuthManager", `Logged out profile ${profileId}`);
  }

  /**
   * Ensure valid session exists for profile (for backward compatibility)
   * This is used by GameLauncher and other legacy code
   */
  static async ensureSession(
    profileId: string,
    options?: { forceRefresh?: boolean; reason?: string }
  ): Promise<AuthSession> {
    this.ensureInitialized();

    if (options?.forceRefresh) {
      const refreshed = await this.refreshSession(profileId);
      if (!refreshed) {
        throw new Error("Failed to refresh session");
      }
      return refreshed;
    }

    const session = await this.getSession(profileId);
    if (session) {
      return session;
    }

    const profile = this.getProfile(profileId);
    const providerId = (profile.authDomain || "sanasol.ws") as AuthProviderId;

    Logger.info(
      "AuthManager",
      `No valid session for profile ${profileId}, attempting login (reason: ${options?.reason ?? "missing_session"})`
    );

    return await this.login(profileId, providerId, {
      uuid: profile.id,
      username: profile.nickname
    });
  }

  private static getProfile(profileId: string): PlayerProfile {
    ConfigStore.reloadPlayerProfiles();
    const profiles = ConfigStore.getPlayerProfiles();
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) {
      throw new Error(`Player profile not found: ${profileId}`);
    }
    return profile;
  }

  private static saveSessionToProfile(
    profileId: string,
    session: AuthSession,
    providerId: AuthProviderId
  ): void {
    ConfigStore.updatePlayerProfile(profileId, {
      authDomain: providerId,
      authTokens: {
        identityToken: session.identityToken,
        sessionToken: session.sessionToken
      },
      authInvalid: false
    });
  }

  private static markProfileAsInvalid(profileId: string): void {
    ConfigStore.updatePlayerProfile(profileId, {
      authTokens: undefined,
      authInvalid: true
    });
  }


  private static ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("AuthManager not initialized. Call AuthManager.init() first.");
    }
  }
}
