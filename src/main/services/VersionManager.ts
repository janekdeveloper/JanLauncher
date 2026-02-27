import axios from "axios";
import { Logger } from "../core/Logger";
import { ConfigStore } from "../core/ConfigStore";
import { getPatchBaseUrl } from "../core/ApiConfig";

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

export class VersionManager {
  static async getLatestVersion(): Promise<string> {
    const branch = "release";
    const os = mapOs();
    const arch = mapArch();

    const patchBaseUrl = getPatchBaseUrl();
    const url = `${patchBaseUrl}/${branch}/versions`;

    try {
      Logger.info(
        "VersionManager",
        `[PATCH] Fetching latest client version (os=${os}, arch=${arch})`,
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
        Logger.warn("VersionManager", "[PATCH] No versions returned, falling back to default version");
        return "8.pwr";
      }

      const latestItem = items.find((item) => item.is_latest) ?? items[0];
      const version = `${latestItem.version}.pwr`;

      Logger.info("VersionManager", `[PATCH] Latest client version: ${version}`);
      return version;
    } catch (error) {
      Logger.error("VersionManager", "[PATCH] Error fetching client version", error);
      Logger.warn("VersionManager", "[PATCH] Patch server unavailable, falling back to default version");
      return "8.pwr";
    }
  }

  static getInstalledVersion(): string | null {
    const settings = ConfigStore.getSettings();
    return settings.installedGameVersion ?? null;
  }

  static setInstalledVersion(version: string): void {
    Logger.info("VersionManager", `Saving installed version: ${version}`);
    ConfigStore.updateSettings({ installedGameVersion: version });
  }

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
