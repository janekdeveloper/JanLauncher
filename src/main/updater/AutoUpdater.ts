import { autoUpdater, UpdateInfo, ProgressInfo } from "electron-updater";
import { app } from "electron";
import { Logger } from "../core/Logger";

/**
 * Wrapper around electron-updater's autoUpdater.
 * 
 * Handles initialization and configuration of electron-updater.
 * All business logic should be in UpdateService.
 */
export class AutoUpdater {
  private static initialized = false;
  private static isDevMode = false;

  /**
   * Initializes autoUpdater with GitHub Releases configuration.
   * 
   * Must be called after app.whenReady().
   */
  static init(): void {
    if (this.initialized) return;

    this.isDevMode = !app.isPackaged || process.env.NODE_ENV === "development";

    if (this.isDevMode) {
      Logger.info("AutoUpdater", "Dev mode detected - auto-updater disabled");
      this.initialized = true;
      return;
    }

    try {
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.channel = "latest";

      Logger.info("AutoUpdater", "Initialized with GitHub Releases (from package.json)");
      this.initialized = true;
    } catch (error) {
      Logger.error("AutoUpdater", "Failed to initialize", error);
      throw error;
    }
  }

  /**
   * Checks if autoUpdater is initialized.
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Checks if we're in dev mode.
   */
  static isDev(): boolean {
    return this.isDevMode;
  }

  /**
   * Gets the current app version.
   */
  static getCurrentVersion(): string {
    return app.getVersion();
  }

  /**
   * Checks for updates.
   * 
   * @returns Promise that resolves with UpdateCheckResult
   */
  static async checkForUpdates(): Promise<{ updateInfo: UpdateInfo | null; error: Error | null }> {
    if (this.isDevMode) {
      Logger.info("AutoUpdater", "Update check skipped (dev mode)");
      return { updateInfo: null, error: null };
    }

    if (!this.initialized) {
      const error = new Error("AutoUpdater not initialized");
      Logger.error("AutoUpdater", "Update check failed", error);
      return { updateInfo: null, error };
    }

    try {
      Logger.info("AutoUpdater", "Checking for updates...");
      const result = await autoUpdater.checkForUpdates();
      
      if (result && result.updateInfo) {
        Logger.info("AutoUpdater", `Update check completed: version ${result.updateInfo.version}`);
        return { updateInfo: result.updateInfo, error: null };
      }

      Logger.info("AutoUpdater", "No update available");
      return { updateInfo: null, error: null };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      Logger.error("AutoUpdater", "Update check failed", err);
      return { updateInfo: null, error: err };
    }
  }

  /**
   * Downloads the available update.
   * 
   * @returns Promise that resolves when download starts
   */
  static async downloadUpdate(): Promise<void> {
    if (this.isDevMode) {
      Logger.info("AutoUpdater", "Download skipped (dev mode)");
      return;
    }

    if (!this.initialized) {
      throw new Error("AutoUpdater not initialized");
    }

    try {
      Logger.info("AutoUpdater", "Starting update download...");
      await autoUpdater.downloadUpdate();
      Logger.info("AutoUpdater", "Update download started");
    } catch (error) {
      Logger.error("AutoUpdater", "Download failed", error);
      throw error;
    }
  }

  /**
   * Quits and installs the update.
   * 
   * @param isSilent - Whether to install silently (default: false)
   * @param isForceRunAfter - Whether to run after install (default: true)
   */
  static quitAndInstall(isSilent = false, isForceRunAfter = true): void {
    if (this.isDevMode) {
      Logger.info("AutoUpdater", "Install skipped (dev mode)");
      return;
    }

    if (!this.initialized) {
      Logger.error("AutoUpdater", "Cannot install - not initialized");
      return;
    }

    try {
      Logger.info("AutoUpdater", `Quitting and installing update (silent: ${isSilent}, runAfter: ${isForceRunAfter})`);
      autoUpdater.quitAndInstall(isSilent, isForceRunAfter);
    } catch (error) {
      Logger.error("AutoUpdater", "Failed to quit and install", error);
      throw error;
    }
  }

  /**
   * Sets up event listeners for autoUpdater.
   * 
   * @param callbacks - Event callbacks
   */
  static setupEventListeners(callbacks: {
    onUpdateAvailable?: (info: UpdateInfo) => void;
    onUpdateNotAvailable?: () => void;
    onDownloadProgress?: (progress: ProgressInfo) => void;
    onUpdateDownloaded?: (info: UpdateInfo) => void;
    onError?: (error: Error) => void;
  }): void {
    if (this.isDevMode) {
      Logger.info("AutoUpdater", "Event listeners skipped (dev mode)");
      return;
    }

    autoUpdater.removeAllListeners();

    if (callbacks.onUpdateAvailable) {
      autoUpdater.on("update-available", (info: UpdateInfo) => {
        Logger.info("AutoUpdater", `Update available: ${info.version}`);
        callbacks.onUpdateAvailable?.(info);
      });
    }

    if (callbacks.onUpdateNotAvailable) {
      autoUpdater.on("update-not-available", () => {
        Logger.info("AutoUpdater", "Update not available");
        callbacks.onUpdateNotAvailable?.();
      });
    }

    if (callbacks.onDownloadProgress) {
      autoUpdater.on("download-progress", (progress: ProgressInfo) => {
        Logger.debug("AutoUpdater", `Download progress: ${progress.percent.toFixed(1)}%`);
        callbacks.onDownloadProgress?.(progress);
      });
    }

    if (callbacks.onUpdateDownloaded) {
      autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
        Logger.info("AutoUpdater", `Update downloaded: ${info.version}`);
        callbacks.onUpdateDownloaded?.(info);
      });
    }

    if (callbacks.onError) {
      autoUpdater.on("error", (error: Error) => {
        Logger.error("AutoUpdater", "AutoUpdater error", error);
        callbacks.onError?.(error);
      });
    }

    Logger.info("AutoUpdater", "Event listeners registered");
  }

  /**
   * Removes all event listeners.
   */
  static removeEventListeners(): void {
    if (this.isDevMode) return;
    autoUpdater.removeAllListeners();
    Logger.info("AutoUpdater", "Event listeners removed");
  }
}
