/**
 * IPC handlers for authentication API
 */
import { ipcMain } from "electron";
import { Logger } from "../core/Logger";
import { AuthManager } from "../core/auth/AuthManager";
import { AccountValidator } from "../core/auth/AccountValidator";
import type {
  AuthProviderInfo,
  AuthProviderId,
  LoginParams,
  AccountValidationResult
} from "../core/auth/auth.types";

export const registerAuthHandlers = (): void => {
  ipcMain.handle("auth:getProviders", async (): Promise<AuthProviderInfo[]> => {
    Logger.debug("IPC", "auth:getProviders");
    try {
      return await AuthManager.getProviders();
    } catch (error) {
      Logger.error("IPC", "auth:getProviders failed", error);
      throw error;
    }
  });

  ipcMain.handle(
    "auth:login",
    async (
      _event,
      profileId: string,
      providerId: AuthProviderId,
      params: LoginParams
    ): Promise<void> => {
      if (!profileId || typeof profileId !== "string") {
        throw new Error("Invalid profileId");
      }
      if (!providerId || typeof providerId !== "string") {
        throw new Error("Invalid providerId");
      }
      if (!params || typeof params !== "object") {
        throw new Error("Invalid login params");
      }

      Logger.debug("IPC", `auth:login ${profileId} with ${providerId}`);
      try {
        await AuthManager.login(profileId, providerId, params);
      } catch (error) {
        Logger.error("IPC", "auth:login failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle("auth:logout", async (_event, profileId: string    ): Promise<void> => {
      if (!profileId || typeof profileId !== "string") {
      throw new Error("Invalid profileId");
    }

    Logger.debug("IPC", `auth:logout ${profileId}`);
    try {
      await AuthManager.logout(profileId);
    } catch (error) {
      Logger.error("IPC", "auth:logout failed", error);
      throw error;
    }
  });

  ipcMain.handle("auth:getSession", async (_event, profileId: string) => {
    if (!profileId || typeof profileId !== "string") {
      throw new Error("Invalid profileId");
    }

    Logger.debug("IPC", `auth:getSession ${profileId}`);
    try {
      return await AuthManager.getSession(profileId);
    } catch (error) {
      Logger.error("IPC", "auth:getSession failed", error);
      throw error;
    }
  });

  ipcMain.handle("auth:refreshSession", async (_event, profileId: string) => {
    if (!profileId || typeof profileId !== "string") {
      throw new Error("Invalid profileId");
    }

    Logger.debug("IPC", `auth:refreshSession ${profileId}`);
    try {
      return await AuthManager.refreshSession(profileId);
    } catch (error) {
      Logger.error("IPC", "auth:refreshSession failed", error);
      throw error;
    }
  });

  ipcMain.handle(
    "auth:validateAccount",
    async (_event, profileId: string): Promise<AccountValidationResult> => {
      if (!profileId || typeof profileId !== "string") {
        throw new Error("Invalid profileId");
      }

      Logger.debug("IPC", `auth:validateAccount ${profileId}`);
      try {
        return await AccountValidator.validateAccount(profileId);
      } catch (error) {
        Logger.error("IPC", "auth:validateAccount failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "auth:getAccountState",
    async (_event, profileId: string): Promise<AccountValidationResult> => {
      if (!profileId || typeof profileId !== "string") {
        throw new Error("Invalid profileId");
      }

      Logger.debug("IPC", `auth:getAccountState ${profileId}`);
      try {
        return await AccountValidator.getAccountState(profileId);
      } catch (error) {
        Logger.error("IPC", "auth:getAccountState failed", error);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "auth:handleAuthError",
    async (_event, profileId: string, error: unknown): Promise<AccountValidationResult> => {
      if (!profileId || typeof profileId !== "string") {
        throw new Error("Invalid profileId");
      }

      Logger.debug("IPC", `auth:handleAuthError ${profileId}`);
      try {
        return await AccountValidator.handleAuthError(profileId, error);
      } catch (err) {
        Logger.error("IPC", "auth:handleAuthError failed", err);
        throw err;
      }
    }
  );
};
