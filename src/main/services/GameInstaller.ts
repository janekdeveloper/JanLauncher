import { Logger } from "../core/Logger";
import { UpdateService } from "../updater/UpdateService";
import { VersionManager } from "../versioning/VersionManager";
import type { GameVersionBranch } from "../../shared/types";

export type InstallProgress = {
  message: string;
  percent?: number;
};

type InstallOptions = {
  profileId: string;
  onProgress?: (p: InstallProgress) => void;
};

export class GameInstaller {
  static isGameInstalled(profileId: string): boolean {
    try {
      const active = VersionManager.resolveActiveVersion(profileId);
      return VersionManager.isVersionInstalled(active.branch, active.versionId);
    } catch {
      return false;
    }
  }

  static async installGame(options: InstallOptions): Promise<void> {
    const { profileId, onProgress } = options;
    Logger.info("GameInstaller", "Starting game installation");

    UpdateService.setGameInstalling(true);
    try {
      const active = VersionManager.resolveActiveVersion(profileId);
      await VersionManager.installVersion({
        branch: active.branch,
        versionId: active.versionId,
        onProgress
      });
    } catch (error) {
      Logger.error("GameInstaller", "Installation failed", error);
      throw error;
    } finally {
      UpdateService.setGameInstalling(false);
    }
  }

  static async updateGame(options: InstallOptions): Promise<void> {
    const { profileId, onProgress } = options;
    Logger.info("GameInstaller", "Updating game (version-specific)");
    return this.installGame({ profileId, onProgress });
  }

  static async repairGame(options: InstallOptions): Promise<void> {
    const { profileId, onProgress } = options;
    Logger.info("GameInstaller", "Repairing game (force reinstall)");

    UpdateService.setGameInstalling(true);
    try {
      const active = VersionManager.resolveActiveVersion(profileId);
      await VersionManager.installVersion({
        branch: active.branch,
        versionId: active.versionId,
        force: true,
        onProgress
      });
    } catch (error) {
      Logger.error("GameInstaller", "Repair failed", error);
      throw error;
    } finally {
      UpdateService.setGameInstalling(false);
    }
  }

  static async installSpecificVersion(options: {
    branch: GameVersionBranch;
    versionId: string;
    onProgress?: (progress: InstallProgress) => void;
  }): Promise<void> {
    const { branch, versionId, onProgress } = options;
    UpdateService.setGameInstalling(true);
    try {
      await VersionManager.installVersion({
        branch,
        versionId,
        onProgress
      });
    } finally {
      UpdateService.setGameInstalling(false);
    }
  }
}
