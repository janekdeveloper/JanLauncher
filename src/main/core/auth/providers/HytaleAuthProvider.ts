/**
 * Hytale Official authentication provider.
 * OAuth 2.0 Authorization Code Flow with PKCE; loopback callback; token refresh.
 */
import crypto from "node:crypto";
import http from "node:http";
import { Logger } from "../../Logger";
import type { IAuthProvider } from "./AuthProvider";
import type { AuthSession, LoginParams } from "../auth.types";
import {
  AccountState,
  AccountStateReason,
  type AccountValidationResult
} from "../auth.types";
import {
  AuthNetworkError,
  AuthInvalidCredentialsError,
  AuthServerError,
  AuthExpiredError
} from "../errors/AuthErrors";
import {
  HYTALE_AUTH_DOMAIN,
  HYTALE_OAUTH_CLIENT_ID,
  HYTALE_OAUTH_SCOPES,
  getOAuthAuthUrl,
  getOAuthTokenUrl,
  getLauncherDataBaseUrl,
  getLauncherDataPaths,
  getGameSessionNewUrl,
  TOKEN_EXPIRY_MARGIN_SEC,
  OAUTH_CALLBACK_TIMEOUT_SEC
} from "./hytaleAuthConstants";
import axios, { type AxiosInstance } from "axios";

const LAUNCHER_VERSION = "1.0.0";
const LAUNCHER_BRANCH = "release";

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.randomBytes(48));
}

function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier, "utf8").digest();
  return base64UrlEncode(hash);
}

function generateState(): string {
  return base64UrlEncode(crypto.randomBytes(24));
}

function maskToken(token: string): string {
  if (!token || token.length <= 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export type HytaleAuthProviderOptions = {
  /** Open system browser for OAuth. Required; inject from Electron shell.openExternal in app. */
  openBrowser: (url: string) => Promise<void>;
  /** OAuth domain (default hytale.com). */
  domain?: string;
  /** HTTP client (default axios). Inject for tests. */
  httpClient?: AxiosInstance;
  /** Callback wait timeout in ms (default 300_000). */
  callbackTimeoutMs?: number;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type LauncherDataProfile = {
  uuid?: string;
  name?: string;
  Uuid?: string;
  Username?: string;
};

type LauncherDataResponse = {
  profiles?: LauncherDataProfile[];
  Profiles?: LauncherDataProfile[];
};

/** Game session API returns short tokens for client launch (signature ~80–90 chars). */
type GameSessionResponse = {
  sessionToken?: string;
  identityToken?: string;
  SessionToken?: string;
  IdentityToken?: string;
  session_token?: string;
  identity_token?: string;
  tokens?: { sessionToken?: string; identityToken?: string; SessionToken?: string; IdentityToken?: string };
  data?: { sessionToken?: string; identityToken?: string; SessionToken?: string; IdentityToken?: string };
};

export class HytaleAuthProvider implements IAuthProvider {
  readonly id = "hytale.com";
  readonly displayName = "Hytale Official";
  readonly authDomain = HYTALE_AUTH_DOMAIN;
  readonly kind = "official";
  readonly labelKey = "home.authSystemOfficial";
  readonly descriptionKey = "home.authSystemOfficialDescription";
  readonly dualauthEnv = {
    HYTALE_AUTH_DOMAIN: HYTALE_AUTH_DOMAIN,
    HYTALE_TRUST_OFFICIAL: "true",
    HYTALE_TRUST_ALL_ISSUERS: "false"
  };

  private readonly domain: string;
  private readonly openBrowser: (url: string) => Promise<void>;
  private readonly httpClient: AxiosInstance;
  private readonly callbackTimeoutMs: number;

  constructor(options: HytaleAuthProviderOptions) {
    this.openBrowser = options.openBrowser;
    this.domain = options.domain ?? HYTALE_AUTH_DOMAIN;
    this.httpClient = options.httpClient ?? axios.create({ timeout: 15_000 });
    this.callbackTimeoutMs = options.callbackTimeoutMs ?? OAUTH_CALLBACK_TIMEOUT_SEC * 1000;
  }

  private get authUrl(): string {
    return getOAuthAuthUrl(this.domain);
  }

  private get tokenUrl(): string {
    return getOAuthTokenUrl(this.domain);
  }

  private get launcherDataBaseUrl(): string {
    return getLauncherDataBaseUrl(this.domain);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.httpClient.get(this.authUrl, {
        timeout: 5_000,
        validateStatus: (s) => s < 500
      });
      return true;
    } catch (err) {
      Logger.debug("HytaleAuthProvider", `isAvailable check failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async login(_params: LoginParams): Promise<AuthSession> {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    let redirectUri = "http://127.0.0.1/callback";

    const server = http.createServer();
    const callbackPromise = new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new AuthNetworkError("Login timed out waiting for callback"));
      }, this.callbackTimeoutMs);

      server.on("request", (req, res) => {
        const url = req.url ?? "";
        const [path, query] = url.split("?");
        if (path !== "/callback" && path !== "/callback/") {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }

        const params = new URLSearchParams(query);
        const errorParam = params.get("error");
        const errorDesc = params.get("error_description");
        const code = params.get("code");
        const receivedState = params.get("state");

        const html = (title: string, body: string) =>
          `<!DOCTYPE html><html><head><title>${title}</title></head><body style="background:#1b2636;color:#d2d9e2;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;"><div style="text-align:center;">${body}</div></body></html>`;

        if (errorParam) {
          clearTimeout(timeout);
          server.close();
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html("Login failed", `<h1>Login failed</h1><p>${errorDesc || errorParam}</p><p>You can close this window.</p>`));
          reject(new AuthInvalidCredentialsError(errorDesc ?? errorParam));
          return;
        }

        if (!code || !receivedState) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html("Login failed", "<h1>Login failed</h1><p>No authorization code received.</p><p>You can close this window.</p>"));
          return;
        }

        if (receivedState !== state) {
          clearTimeout(timeout);
          server.close();
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html("Login failed", "<h1>Login failed</h1><p>Invalid state. Please try again.</p><p>You can close this window.</p>"));
          reject(new AuthInvalidCredentialsError("Invalid state parameter"));
          return;
        }

        clearTimeout(timeout);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html("Login successful", "<h1>Login successful</h1><p>You can close this window and return to the launcher.</p>"));
        server.close();
        resolve({ code, redirectUri });
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return;
      const port = address.port;
      redirectUri = `http://127.0.0.1:${port}/callback`;
      const authUrl = `${this.authUrl}?${new URLSearchParams({
        client_id: HYTALE_OAUTH_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: HYTALE_OAUTH_SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256"
      })}`;

      Logger.info("HytaleAuthProvider", "Opening browser for OAuth login");
      this.openBrowser(authUrl).catch((err) => {
        Logger.warn("HytaleAuthProvider", `Failed to open browser: ${err instanceof Error ? err.message : String(err)}`);
      });
    });

    let code: string;
    try {
      const result = await callbackPromise;
      code = result.code;
      redirectUri = result.redirectUri;
    } catch (err) {
      if (err instanceof AuthInvalidCredentialsError || err instanceof AuthNetworkError) throw err;
      throw new AuthNetworkError("OAuth callback failed", err);
    }

    const tokenRes = await this.exchangeCodeForToken(code, redirectUri, codeVerifier);
    const accessToken = tokenRes.access_token;
    const refreshToken = tokenRes.refresh_token;
    const expiresIn = tokenRes.expires_in ?? 3600;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    const { uuid, username } = await this.fetchLauncherDataProfile(accessToken);

    const gameSession = await this.fetchGameSession(accessToken, uuid);
    const identityToken = gameSession?.identityToken ?? accessToken;
    const sessionToken = gameSession?.sessionToken ?? accessToken;

    Logger.info("HytaleAuthProvider", `Login successful for ${maskToken(accessToken)}`);

    return {
      uuid,
      username,
      identityToken,
      sessionToken,
      expiresAt,
      providerId: this.id,
      refreshToken
    };
  }

  private async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<TokenResponse> {
    try {
      const res = await this.httpClient.post<TokenResponse>(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: HYTALE_OAUTH_CLIENT_ID,
          code_verifier: codeVerifier
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "JanLauncher/1.0"
          }
        }
      );

      if (res.status >= 500) {
        throw new AuthServerError(`Token server error: ${res.status}`, res.status);
      }
      if (res.status === 401 || res.status === 403) {
        throw new AuthInvalidCredentialsError("Token exchange rejected");
      }
      if (res.status !== 200 || !res.data?.access_token) {
        const errBody = typeof res.data === "object" && res.data && "error" in res.data
          ? String((res.data as { error?: string }).error)
          : res.statusText;
        throw new AuthInvalidCredentialsError(errBody || "Invalid token response");
      }

      return res.data;
    } catch (err) {
      if (err instanceof AuthServerError || err instanceof AuthInvalidCredentialsError) throw err;
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const msg = err.response?.data?.error ?? err.message;
        if (status && status >= 500) throw new AuthServerError(msg, status);
        if (status === 401 || status === 403) throw new AuthInvalidCredentialsError(msg);
        throw new AuthNetworkError(msg, err);
      }
      throw new AuthNetworkError("Token exchange failed", err);
    }
  }

  private async fetchLauncherDataProfile(accessToken: string): Promise<{ uuid: string; username: string }> {
    const os = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
    const arch = process.arch === "arm64" ? "arm64" : "amd64";
    const baseUrl = this.launcherDataBaseUrl;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json, text/plain, */*",
      "User-Agent": `hytale-launcher/${LAUNCHER_VERSION}`,
      "X-Hytale-Launcher-Version": LAUNCHER_VERSION,
      "X-Hytale-Launcher-Branch": LAUNCHER_BRANCH
    };

    const pathsList = getLauncherDataPaths();
    for (let i = 0; i < pathsList.length; i++) {
      const path = pathsList[i];
      const skipQueryParams = path === "/my-account/get-launcher-data";
      try {
        const url = `${baseUrl}${path}`;
        const res = await this.httpClient.get<LauncherDataResponse>(url, {
          params: skipQueryParams ? undefined : { os, arch },
          headers
        });

        if (res.status >= 500) {
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          throw new AuthInvalidCredentialsError("Launcher data access denied");
        }
        if (res.status !== 200) {
          continue;
        }

        const profiles = res.data?.profiles ?? res.data?.Profiles;
        if (Array.isArray(profiles) && profiles.length > 0) {
          const first = profiles[0];
          const uuid = first.uuid ?? first.Uuid ?? "";
          const username = first.name ?? first.Username ?? "Hytale Player";
          return { uuid, username };
        }
        return { uuid: "", username: "Hytale Player" };
      } catch (err) {
        if (err instanceof AuthInvalidCredentialsError) throw err;
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 401 || status === 403) {
            throw new AuthInvalidCredentialsError("Launcher data access denied");
          }
          if (status === 404) continue;
        }
      }
    }

    Logger.warn(
      "HytaleAuthProvider",
      "Launcher data unavailable for all paths; using placeholder profile"
    );
    return { uuid: "", username: "Hytale Player" };
  }

  /**
   * Obtains game session tokens (short identity/session for client launch) from sessions.hytale.com.
   * POST /game-session/new with Bearer access_token and body { uuid }.
   * Returns null on failure (caller falls back to access_token for both).
   */
  private async fetchGameSession(accessToken: string, profileUuid: string): Promise<{ identityToken: string; sessionToken: string } | null> {
    const url = getGameSessionNewUrl(this.domain);
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": `hytale-launcher/${LAUNCHER_VERSION}`
    };
    if (!profileUuid || !profileUuid.trim()) {
      Logger.debug("HytaleAuthProvider", "Game session request: profile uuid empty (launcher-data may have failed); API may require valid Hytale profile uuid");
    }

    try {
      const res = await this.httpClient.post<GameSessionResponse>(url, { uuid: profileUuid || "" }, {
        headers,
        timeout: 10_000
      });

      if (res.status !== 200 || !res.data) {
        Logger.warn("HytaleAuthProvider", `Game session API returned ${res.status}; using OAuth token fallback`);
        return null;
      }

      const data = res.data;
      const idFrom = (o: GameSessionResponse["tokens"]) =>
        (o && (o.identityToken ?? o.IdentityToken ?? "")) || "";
      const sessionFrom = (o: GameSessionResponse["tokens"]) =>
        (o && (o.sessionToken ?? o.SessionToken ?? "")) || "";
      const identityToken =
        (data.identityToken ?? data.IdentityToken ?? data.identity_token ?? "")
        || idFrom(data.tokens)
        || idFrom(data.data as GameSessionResponse["tokens"]);
      const sessionToken =
        (data.sessionToken ?? data.SessionToken ?? data.session_token ?? "")
        || sessionFrom(data.tokens)
        || sessionFrom(data.data as GameSessionResponse["tokens"]);

      Logger.debug(
        "HytaleAuthProvider",
        `Game session response keys: ${Object.keys(data).join(", ")}; identityToken length: ${identityToken?.length ?? 0}; sessionToken length: ${sessionToken?.length ?? 0}`
      );

      if (identityToken && sessionToken) {
        Logger.info("HytaleAuthProvider", "Game session tokens obtained from API");
        return { identityToken, sessionToken };
      }

      Logger.warn("HytaleAuthProvider", "Game session response missing or invalid tokens; using OAuth token fallback");
      return null;
    } catch (err) {
      Logger.warn(
        "HytaleAuthProvider",
        `Game session request failed: ${err instanceof Error ? err.message : String(err)}; using OAuth token fallback`
      );
      return null;
    }
  }

  async logout(session: AuthSession): Promise<void> {
    Logger.info("HytaleAuthProvider", `Logout for user ${session.uuid}`);
  }

  async refresh(session: AuthSession): Promise<AuthSession> {
    return this.refreshSession(session);
  }

  async refreshSession(session: AuthSession): Promise<AuthSession> {
    const refreshToken = session.refreshToken;
    if (!refreshToken) {
      throw new AuthExpiredError("No refresh token; re-login required");
    }

    try {
      const res = await this.httpClient.post<TokenResponse>(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: HYTALE_OAUTH_CLIENT_ID
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "JanLauncher/1.0"
          }
        }
      );

      if (res.status >= 500) {
        throw new AuthServerError("Refresh server error", res.status);
      }
      if (res.status === 401 || res.status === 403) {
        throw new AuthInvalidCredentialsError("Refresh token rejected");
      }
      if (res.status !== 200 || !res.data?.access_token) {
        throw new AuthInvalidCredentialsError("Invalid refresh response");
      }

      const accessToken = res.data.access_token;
      const newRefreshToken = res.data.refresh_token ?? refreshToken;
      const expiresIn = res.data.expires_in ?? 3600;
      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

      Logger.info("HytaleAuthProvider", `Token refreshed ${maskToken(accessToken)}`);

      const gameSession = await this.fetchGameSession(accessToken, session.uuid);
      const identityToken = gameSession?.identityToken ?? accessToken;
      const sessionToken = gameSession?.sessionToken ?? accessToken;

      return {
        uuid: session.uuid,
        username: session.username,
        identityToken,
        sessionToken,
        expiresAt,
        providerId: this.id,
        refreshToken: newRefreshToken
      };
    } catch (err) {
      if (err instanceof AuthServerError || err instanceof AuthInvalidCredentialsError || err instanceof AuthExpiredError) throw err;
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status && status >= 500) throw new AuthServerError("Refresh failed", status);
        if (status === 401 || status === 403) throw new AuthInvalidCredentialsError("Refresh token rejected");
        throw new AuthNetworkError("Refresh failed", err);
      }
      throw new AuthNetworkError("Refresh failed", err);
    }
  }

  async validateSession(session: AuthSession): Promise<AccountValidationResult> {
    if (!session.identityToken || !session.sessionToken) {
      return {
        state: AccountState.INVALID,
        reason: AccountStateReason.TOKENS_MISSING,
        canLaunch: false
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expiresAt;
    if (expiresAt != null && expiresAt <= now + TOKEN_EXPIRY_MARGIN_SEC) {
      return {
        state: AccountState.EXPIRED,
        reason: AccountStateReason.TOKENS_EXPIRED,
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

  async getSession(session: AuthSession): Promise<AuthSession | null> {
    const validation = await this.validateSession(session);
    return validation.state === AccountState.VALID ? session : null;
  }

  isAuthError(error: unknown): boolean {
    if (error instanceof AuthNetworkError || error instanceof AuthInvalidCredentialsError ||
        error instanceof AuthServerError || error instanceof AuthExpiredError) return true;
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    return (
      lower.includes("auth") ||
      lower.includes("token") ||
      lower.includes("401") ||
      lower.includes("403") ||
      lower.includes("unauthorized") ||
      lower.includes("expired")
    );
  }

  async getAccountState(session: AuthSession): Promise<AccountState> {
    const validation = await this.validateSession(session);
    return validation.state;
  }
}
