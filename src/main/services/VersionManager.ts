import axios from "axios";
import { Logger } from "../core/Logger";
import { ConfigStore } from "../core/ConfigStore";

const VERSION_API_URL = "https://files.hytalef2p.com/api/version_client";

export type VersionInfo = {
  branch: string;
  client_version: string;
  timestamp: string;
};

/**
 * Manages game version checking and tracking.
 * 
 * Handles fetching latest version from API and comparing with installed version.
 */
export class VersionManager {
  /**
   * Fetches the latest client version from the API.
   * 
   * @returns The latest version string (e.g., "5.pwr")
   */
  static async getLatestVersion(): Promise<string> {
    try {
      Logger.info("VersionManager", "Fetching latest client version from API");
      const response = await axios.get<VersionInfo>(VERSION_API_URL, {
        timeout: 5000,
        headers: {
          "User-Agent": "Hytale-F2P-Launcher"
        }
      });

      if (response.data && response.data.client_version) {
        const version = response.data.client_version;
        Logger.info("VersionManager", `Latest client version: ${version}`);
        return version;
      } else {
        Logger.warn("VersionManager", "Invalid API response, falling back to default version");
        return "4.pwr";
      }
    } catch (error) {
      Logger.error("VersionManager", "Error fetching client version", error);
      Logger.warn("VersionManager", "API unavailable, falling back to default version");
      return "4.pwr";
    }
  }

  /**
   * Gets the installed game version from config.
   * 
   * @returns The installed version string or null if not set
   */
  static getInstalledVersion(): string | null {
    const settings = ConfigStore.getSettings();
    return settings.installedGameVersion ?? null;
  }

  /**
   * Saves the installed game version to config.
   * 
   * @param version - The version string to save
   */
  static setInstalledVersion(version: string): void {
    Logger.info("VersionManager", `Saving installed version: ${version}`);
    ConfigStore.updateSettings({ installedGameVersion: version });
  }

  /**
   * Checks if an update is available.
   * 
   * @returns Object with update information
   */
  static async checkForUpdate(): Promise<{
    updateAvailable: boolean;
    installedVersion: string | null;
    latestVersion: string;
    needsUpdate: boolean;
  }> {
    const [installedVersion, latestVersion] = await Promise.all([
      Promise.resolve(this.getInstalledVersion()),
      this.getLatestVersion()
    ]);

    const needsUpdate = installedVersion !== null && installedVersion !== latestVersion;

    Logger.info("VersionManager", `Version check: installed=${installedVersion}, latest=${latestVersion}, needsUpdate=${needsUpdate}`);

    return {
      updateAvailable: needsUpdate,
      installedVersion,
      latestVersion,
      needsUpdate
    };
  }
}
