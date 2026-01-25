import { BrowserWindow } from "electron";
import { UpdateInfo, ProgressInfo } from "electron-updater";
import { AutoUpdater } from "./AutoUpdater";
import { Logger } from "../core/Logger";
import { GameLauncher } from "../services/GameLauncher";
import { GameInstaller } from "../services/GameInstaller";

export type UpdateStatus = {
  status: "idle" | "checking" | "update-available" | "downloading" | "downloaded" | "error";
  version?: string;
  progress?: number;
  error?: string;
};

/**
 * Business logic layer for update management.
 * 
 * Handles update checking, downloading, and installation scheduling.
 * Coordinates with game state to prevent updates during gameplay.
 */
export class UpdateService {
  private static currentStatus: UpdateStatus = { status: "idle" };
  private static updateInfo: UpdateInfo | null = null;
  private static checkInterval: NodeJS.Timeout | null = null;
  private static mainWindow: BrowserWindow | null = null;
  private static isGameRunning = false;
  private static isGameInstalling = false;

  /**
   * Initializes the update service.
   * 
   * @param window - Main window for sending IPC events
   */
  static init(window: BrowserWindow): void {
    this.mainWindow = window;
    AutoUpdater.init();

    if (AutoUpdater.isDev()) {
      Logger.info("UpdateService", "Update service disabled in dev mode");
      return;
    }

    AutoUpdater.setupEventListeners({
      onUpdateAvailable: (info) => {
        this.handleUpdateAvailable(info);
      },
      onUpdateNotAvailable: () => {
        this.handleUpdateNotAvailable();
      },
      onDownloadProgress: (progress) => {
        this.handleDownloadProgress(progress);
      },
      onUpdateDownloaded: (info) => {
        this.handleUpdateDownloaded(info);
      },
      onError: (error) => {
        this.handleError(error);
      }
    });

    setTimeout(() => {
      this.checkForUpdates(false);
    }, 5000);

    this.startPeriodicChecks(6 * 60 * 60 * 1000);

    Logger.info("UpdateService", "Update service initialized");
  }

  /**
   * Gets the current update status.
   */
  static getStatus(): UpdateStatus {
    return { ...this.currentStatus };
  }

  /**
   * Checks for updates.
   * 
   * @param userInitiated - Whether the check was initiated by user
   */
  static async checkForUpdates(userInitiated = false): Promise<void> {
    if (AutoUpdater.isDev()) {
      Logger.info("UpdateService", "Update check skipped (dev mode)");
      this.sendEvent("updater:update-not-available");
      return;
    }

    if (this.currentStatus.status === "checking") {
      Logger.debug("UpdateService", "Update check already in progress");
      return;
    }

    try {
      this.updateStatus({ status: "checking" });
      Logger.info("UpdateService", `Checking for updates (userInitiated: ${userInitiated})`);

      const { updateInfo, error } = await AutoUpdater.checkForUpdates();

      if (error) {
        this.updateStatus({ status: "error", error: error.message });
        this.sendEvent("updater:error", { error: error.message });
        return;
      }

      if (updateInfo) {
        const currentVersion = AutoUpdater.getCurrentVersion();
        const isNewer = this.isVersionNewer(updateInfo.version, currentVersion);

        if (isNewer) {
          this.updateInfo = updateInfo;
          this.updateStatus({
            status: "update-available",
            version: updateInfo.version
          });
          this.sendEvent("updater:update-available", {
            version: updateInfo.version,
            releaseDate: updateInfo.releaseDate,
            releaseNotes: updateInfo.releaseNotes
          });
        } else {
          Logger.info("UpdateService", "Already on latest version");
          this.updateStatus({ status: "idle" });
          if (userInitiated) {
            this.sendEvent("updater:update-not-available");
          }
        }
      } else {
        this.updateStatus({ status: "idle" });
        if (userInitiated) {
          this.sendEvent("updater:update-not-available");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error("UpdateService", "Update check failed", error);
      this.updateStatus({ status: "error", error: errorMessage });
      this.sendEvent("updater:error", { error: errorMessage });
    }
  }

  /**
   * Downloads the available update.
   * 
   * Checks if game is running or installing before starting download.
   */
  static async downloadUpdate(): Promise<void> {
    if (AutoUpdater.isDev()) {
      Logger.info("UpdateService", "Download skipped (dev mode)");
      return;
    }

    if (this.currentStatus.status !== "update-available") {
      Logger.warn("UpdateService", "No update available to download");
      return;
    }

    if (this.isGameRunning || this.isGameInstalling) {
      const reason = this.isGameRunning ? "game is running" : "game is installing";
      Logger.warn("UpdateService", `Cannot download update: ${reason}`);
      this.sendEvent("updater:error", {
        error: `Cannot download update while ${reason}`
      });
      return;
    }

    try {
      this.updateStatus({ status: "downloading", progress: 0 });
      Logger.info("UpdateService", "Starting update download...");
      await AutoUpdater.downloadUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error("UpdateService", "Download failed", error);
      this.updateStatus({ status: "error", error: errorMessage });
      this.sendEvent("updater:error", { error: errorMessage });
    }
  }

  /**
   * Schedules update installation on quit.
   * 
   * The update will be installed when the app quits.
   */
  static installOnQuit(): void {
    if (AutoUpdater.isDev()) {
      Logger.info("UpdateService", "Install skipped (dev mode)");
      return;
    }

    if (this.currentStatus.status !== "downloaded") {
      Logger.warn("UpdateService", "No downloaded update to install");
      return;
    }

    Logger.info("UpdateService", "Update scheduled for installation on quit");
  }

  /**
   * Immediately quits and installs the update.
   * 
   * Only use if game is not running and not installing.
   */
  static quitAndInstall(): void {
    if (AutoUpdater.isDev()) {
      Logger.info("UpdateService", "Install skipped (dev mode)");
      return;
    }

    if (this.currentStatus.status !== "downloaded") {
      Logger.warn("UpdateService", "No downloaded update to install");
      return;
    }

    if (this.isGameRunning) {
      Logger.warn("UpdateService", "Game is running - update will close it");
    }

    Logger.info("UpdateService", "Quitting and installing update now");
    AutoUpdater.quitAndInstall(false, true);
  }

  /**
   * Sets the game running state.
   * 
   * Used by GameLauncher to notify about game state.
   */
  static setGameRunning(running: boolean): void {
    this.isGameRunning = running;
    Logger.debug("UpdateService", `Game running state: ${running}`);
  }

  /**
   * Sets the game installing state.
   * 
   * Used by GameInstaller to notify about installation state.
   */
  static setGameInstalling(installing: boolean): void {
    this.isGameInstalling = installing;
    Logger.debug("UpdateService", `Game installing state: ${installing}`);
  }

  /**
   * Starts periodic update checks.
   * 
   * @param intervalMs - Interval in milliseconds
   */
  private static startPeriodicChecks(intervalMs: number): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      if (!this.isGameRunning && !this.isGameInstalling) {
        this.checkForUpdates(false);
      } else {
        Logger.debug("UpdateService", "Periodic check skipped (game active)");
      }
    }, intervalMs);

    Logger.info("UpdateService", `Periodic update checks started (interval: ${intervalMs / 1000 / 60} minutes)`);
  }

  /**
   * Stops periodic update checks.
   */
  static stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      Logger.info("UpdateService", "Periodic update checks stopped");
    }
  }

  /**
   * Handles update available event.
   */
  private static handleUpdateAvailable(info: UpdateInfo): void {
    this.updateInfo = info;
    this.updateStatus({
      status: "update-available",
      version: info.version
    });
    this.sendEvent("updater:update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    });
  }

  /**
   * Handles update not available event.
   */
  private static handleUpdateNotAvailable(): void {
    this.updateStatus({ status: "idle" });
    this.sendEvent("updater:update-not-available");
  }

  /**
   * Handles download progress event.
   */
  private static handleDownloadProgress(progress: ProgressInfo): void {
    this.updateStatus({
      status: "downloading",
      progress: progress.percent
    });
    this.sendEvent("updater:download-progress", {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    });
  }

  /**
   * Handles update downloaded event.
   */
  private static handleUpdateDownloaded(info: UpdateInfo): void {
    this.updateStatus({
      status: "downloaded",
      version: info.version
    });
    this.sendEvent("updater:update-downloaded", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    });
    Logger.info("UpdateService", `Update downloaded: ${info.version} - will install on quit`);
  }

  /**
   * Handles error event.
   */
  private static handleError(error: Error): void {
    this.updateStatus({
      status: "error",
      error: error.message
    });
    this.sendEvent("updater:error", { error: error.message });
  }

  /**
   * Updates the current status and logs it.
   */
  private static updateStatus(status: UpdateStatus): void {
    this.currentStatus = status;
    Logger.debug("UpdateService", `Status: ${status.status}${status.version ? ` (${status.version})` : ""}${status.progress !== undefined ? ` ${status.progress.toFixed(1)}%` : ""}`);
  }

  /**
   * Sends an IPC event to the renderer.
   */
  private static sendEvent(channel: string, data?: unknown): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      Logger.warn("UpdateService", `Cannot send event ${channel} - window not available`);
      return;
    }

    try {
      this.mainWindow.webContents.send(channel, data);
    } catch (error) {
      Logger.error("UpdateService", `Failed to send event ${channel}`, error);
    }
  }

  /**
   * Compares two version strings.
   * 
   * @returns True if version1 is newer than version2
   */
  private static isVersionNewer(version1: string, version2: string): boolean {
    const v1Parts = version1.split(".").map(Number);
    const v2Parts = version2.split(".").map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return true;
      if (v1Part < v2Part) return false;
    }

    return false;
  }

  /**
   * Cleanup on shutdown.
   */
  static cleanup(): void {
    this.stopPeriodicChecks();
    AutoUpdater.removeEventListeners();
    Logger.info("UpdateService", "Update service cleaned up");
  }
}
