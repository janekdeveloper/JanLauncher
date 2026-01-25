/**
 * Authentication error types
 */

export class AuthError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class TokenExpiredError extends AuthError {
  constructor(message = "Authentication tokens have expired") {
    super(message, "TOKEN_EXPIRED");
    this.name = "TokenExpiredError";
  }
}

export class TokenInvalidError extends AuthError {
  constructor(message = "Authentication tokens are invalid") {
    super(message, "TOKEN_INVALID");
    this.name = "TokenInvalidError";
  }
}

export class AuthProviderUnavailableError extends AuthError {
  constructor(message = "Authentication provider is unavailable") {
    super(message, "PROVIDER_UNAVAILABLE");
    this.name = "AuthProviderUnavailableError";
  }
}

export class ReloginRequiredError extends AuthError {
  constructor(message = "Re-login required") {
    super(message, "RELOGIN_REQUIRED");
    this.name = "ReloginRequiredError";
  }
}
