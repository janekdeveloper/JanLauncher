import { BrowserWindow } from "electron";
import { Logger } from "../core/Logger";

/**
 * Manages the main application window.
 * Provides safe access to window operations like minimize/restore.
 */
export class WindowManager {
  private static mainWindow: BrowserWindow | null = null;

  /**
   * Initializes the window manager with the main window instance.
   * 
   * @param window - The main BrowserWindow instance
   */
  static init(window: BrowserWindow): void {
    this.mainWindow = window;
    
    window.on("closed", () => {
      this.mainWindow = null;
      Logger.debug("WindowManager", "Main window closed, cleared reference");
    });

    Logger.info("WindowManager", `Window manager initialized with window ID: ${window.id}`);
  }

  /**
   * Gets the main window, trying multiple methods if the stored reference is null.
   */
  private static getWindow(): BrowserWindow | null {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }

    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length > 0) {
      const mainWin = allWindows[0];
      this.mainWindow = mainWin;
      Logger.debug("WindowManager", `Recovered main window from BrowserWindow.getAllWindows(), ID: ${mainWin.id}`);
      return mainWin;
    }

    return null;
  }

  /**
   * Gets the main window instance.
   * 
   * @returns The main BrowserWindow or null if not initialized or destroyed
   */
  static getMainWindow(): BrowserWindow | null {
    return this.getWindow();
  }

  /**
   * Minimizes the main window if it exists and is not destroyed.
   */
  static minimizeMainWindow(): void {
    const window = this.getWindow();
    if (!window) {
      Logger.warn("WindowManager", "Cannot minimize: main window not found");
      return;
    }

    try {
      window.minimize();
      Logger.info("WindowManager", `Main window minimized (ID: ${window.id})`);
    } catch (error) {
      Logger.error("WindowManager", "Failed to minimize window", error);
    }
  }

  /**
   * Restores the main window if it exists and is not destroyed.
   */
  static restoreMainWindow(): void {
    const window = this.getWindow();
    if (!window) {
      Logger.warn("WindowManager", "Cannot restore: main window not found");
      return;
    }

    try {
      if (window.isMinimized()) {
        window.restore();
        Logger.info("WindowManager", `Main window restored (ID: ${window.id})`);
      } else {
        Logger.debug("WindowManager", "Main window is not minimized, no restore needed");
      }
    } catch (error) {
      Logger.error("WindowManager", "Failed to restore window", error);
    }
  }

  /**
   * Shows the main window if it exists and is not destroyed.
   */
  static showMainWindow(): void {
    const window = this.getWindow();
    if (!window) {
      Logger.warn("WindowManager", "Cannot show: main window not found");
      return;
    }

    try {
      if (!window.isVisible()) {
        window.show();
        Logger.info("WindowManager", `Main window shown (ID: ${window.id})`);
      }
    } catch (error) {
      Logger.error("WindowManager", "Failed to show window", error);
    }
  }
}
