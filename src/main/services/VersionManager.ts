import axios from "axios";
import { Logger } from "../core/Logger";
import { ConfigStore } from "../core/ConfigStore";
import { getApiBaseUrl } from "../core/ApiConfig";

type OsName = "windows" | "linux" | "darwin";
type ArchName = "amd64" | "arm64";

type VersionsResponseItem = {
  version: number;
  label: string;
  is_latest: boolean;
};

type VersionsResponse = {
  items: VersionsResponseItem[];
};

function mapOs(): OsName {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "darwin";
    case "linux":
    default:
      return "linux";
  }
}

function mapArch(): ArchName {
  switch (process.arch) {
    case "arm64":
      return "arm64";
    case "x64":
    default:
      return "amd64";
  }
}

/**
 * Manages game version checking and tracking.
 *
 * Handles fetching latest version from JanNet API and comparing with installed version.
 */
export class VersionManager {
  /**
   * Fetches the latest client version from JanNet launcher API.
   *
   * @returns The latest version string (e.g., "5.pwr")
   */
  static async getLatestVersion(): Promise<string> {
    const branch = "release";
    const os = mapOs();
    const arch = mapArch();

    const apiBaseUrl = getApiBaseUrl();
    const url = `${apiBaseUrl}/launcher/patches/${branch}/versions`;

    try {
      Logger.info(
        "VersionManager",
        `Fetching latest client version from JanNet API: ${url} (os=${os}, arch=${arch})`,
      );

      const response = await axios.get<VersionsResponse>(url, {
        timeout: 5000,
        params: {
          os_name: os,
          arch,
        },
        headers: {
          "User-Agent": "JanLauncher-VersionManager",
          Accept: "application/json, text/plain, */*",
        },
      });

      const items = response.data?.items ?? [];
      if (!items.length) {
        Logger.warn("VersionManager", "No versions returned from JanNet API, falling back to default version");
        return "8.pwr";
      }

      const latestItem = items.find((item) => item.is_latest) ?? items[0];
      const version = `${latestItem.version}.pwr`;

      Logger.info("VersionManager", `Latest client version from JanNet: ${version}`);
      return version;
    } catch (error) {
      Logger.error("VersionManager", "Error fetching client version from JanNet API", error);
      Logger.warn("VersionManager", "JanNet API unavailable, falling back to default version");
      return "8.pwr";
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
