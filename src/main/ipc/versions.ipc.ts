import { ipcMain, IpcMainInvokeEvent } from "electron";
import { Logger } from "../core/Logger";
import { VersionManager } from "../versioning/VersionManager";
import type { GameVersionInfo, InstalledVersionRecord } from "../versioning/VersionManifest";
import type { GameVersionBranch } from "../../shared/types";

const isBranch = (value: unknown): value is GameVersionBranch =>
  value === "release" || value === "pre-release" || value === "beta" || value === "alpha";

export const registerVersionsHandlers = (): void => {
  ipcMain.handle(
    "versions:getAvailable",
    async (_event: IpcMainInvokeEvent, branch: GameVersionBranch): Promise<GameVersionInfo[]> => {
      if (!isBranch(branch)) {
        throw new Error("Invalid version branch");
      }
      Logger.debug("IPC", `versions:getAvailable ${branch}`);
      return VersionManager.getAvailableVersions(branch);
    }
  );

  ipcMain.handle(
    "versions:getInstalled",
    async (_event: IpcMainInvokeEvent, branch?: GameVersionBranch): Promise<InstalledVersionRecord[]> => {
      if (branch !== undefined && !isBranch(branch)) {
        throw new Error("Invalid version branch");
      }
      Logger.debug("IPC", `versions:getInstalled ${branch ?? "all"}`);
      return VersionManager.getInstalledVersions(branch);
    }
  );

  ipcMain.handle(
    "versions:getInstalledAsInfo",
    (_event: IpcMainInvokeEvent, branch?: GameVersionBranch): GameVersionInfo[] => {
      if (branch !== undefined && !isBranch(branch)) {
        throw new Error("Invalid version branch");
      }
      Logger.debug("IPC", `versions:getInstalledAsInfo ${branch ?? "all"}`);
      return VersionManager.getInstalledVersionsAsInfo(branch);
    }
  );

  ipcMain.handle(
    "versions:getActive",
    async (_event: IpcMainInvokeEvent, profileId: string): Promise<unknown> => {
      if (!profileId || typeof profileId !== "string") {
        throw new Error("Invalid profileId");
      }
      Logger.debug("IPC", `versions:getActive ${profileId}`);
      return VersionManager.getActiveVersion(profileId);
    }
  );

  ipcMain.handle(
    "versions:setActive",
    async (
      _event: IpcMainInvokeEvent,
      options: { profileId: string; branch: GameVersionBranch; versionId: string | null }
    ): Promise<void> => {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid options");
      }
      if (!options.profileId || typeof options.profileId !== "string") {
        throw new Error("Invalid profileId");
      }
      if (!isBranch(options.branch)) {
        throw new Error("Invalid version branch");
      }
      if (options.versionId !== null && typeof options.versionId !== "string") {
        throw new Error("Invalid versionId");
      }
      Logger.debug(
        "IPC",
        `versions:setActive ${options.profileId} ${options.branch}/${options.versionId ?? "none"}`
      );
      VersionManager.setActiveVersion(options.profileId, options.branch, options.versionId);
    }
  );

  ipcMain.handle(
    "versions:install",
    async (
      event: IpcMainInvokeEvent,
      options: { branch: GameVersionBranch; versionId: string }
    ): Promise<void> => {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid options");
      }
      if (!isBranch(options.branch)) {
        throw new Error("Invalid version branch");
      }
      if (!options.versionId || typeof options.versionId !== "string") {
        throw new Error("Invalid versionId");
      }

      Logger.info("IPC", `versions:install ${options.branch}/${options.versionId}`);

      try {
        await VersionManager.installVersion({
          branch: options.branch,
          versionId: options.versionId,
          onProgress: (progress) => {
            event.sender.send("versions:install:progress", progress);
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.error("IPC", "versions:install failed", error);
        event.sender.send("versions:install:error", errorMessage);
        throw error;
      }
    }
  );

  ipcMain.handle(
    "versions:remove",
    async (
      _event: IpcMainInvokeEvent,
      options: { branch: GameVersionBranch; versionId: string }
    ): Promise<void> => {
      if (!options || typeof options !== "object") {
        throw new Error("Invalid options");
      }
      if (!isBranch(options.branch)) {
        throw new Error("Invalid version branch");
      }
      if (!options.versionId || typeof options.versionId !== "string") {
        throw new Error("Invalid versionId");
      }
      Logger.info("IPC", `versions:remove ${options.branch}/${options.versionId}`);
      await VersionManager.removeVersion(options.branch, options.versionId);
    }
  );
};
