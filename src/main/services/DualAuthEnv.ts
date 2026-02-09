import type { IAuthProvider } from "../core/auth/providers/AuthProvider";

export const buildDualAuthEnv = (
  provider: IAuthProvider
): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {};
  const providerEnv = provider.dualauthEnv ?? {};

  Object.entries(providerEnv).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      env[key] = String(value);
    }
  });

  return env;
};
