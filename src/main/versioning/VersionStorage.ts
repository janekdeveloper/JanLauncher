import fs from "node:fs";
import path from "node:path";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";
import {
  AVAILABLE_BRANCHES,
  type GameVersionBranch,
  type InstalledVersionRecord,
  type VersionIndex
} from "./VersionManifest";

const INDEX_FILENAME = "index.json";
const METADATA_FILENAME = "version.json";

type VersionMetadata = {
  id: string;
  branch: GameVersionBranch;
  version: number;
  installedAt: string;
  sizeBytes?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isMetadata = (value: unknown): value is VersionMetadata =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.branch) &&
  isNumber(value.version) &&
  isString(value.installedAt) &&
  (value.sizeBytes === undefined || isNumber(value.sizeBytes));

export class VersionStorage {
  static ensureLayout(): void {
    const dirs = [
      this.getVersionsRoot(),
      this.getCacheDir(),
      this.getStagingRoot()
    ];
    dirs.forEach((dir) => {
      fs.mkdirSync(dir, { recursive: true });
    });
  }

  static getVersionsRoot(): string {
    return path.join(Paths.dataRoot, "game", "versions");
  }

  static getCacheDir(): string {
    return path.join(Paths.dataRoot, "game", "cache");
  }

  static getStagingRoot(): string {
    return path.join(Paths.dataRoot, "game", "staging");
  }

  static getBranchDir(branch: GameVersionBranch): string {
    return path.join(this.getVersionsRoot(), branch);
  }

  static getVersionDir(branch: GameVersionBranch, versionId: string): string {
    return path.join(this.getBranchDir(branch), versionId);
  }

  static getMetadataPath(branch: GameVersionBranch, versionId: string): string {
    return path.join(this.getVersionDir(branch, versionId), METADATA_FILENAME);
  }

  static getIndexPath(): string {
    return path.join(this.getVersionsRoot(), INDEX_FILENAME);
  }

  static readMetadata(branch: GameVersionBranch, versionId: string): VersionMetadata | null {
    const metadataPath = this.getMetadataPath(branch, versionId);
    if (!fs.existsSync(metadataPath)) return null;
    try {
      const raw = fs.readFileSync(metadataPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (!isMetadata(parsed)) {
        Logger.warn("VersionStorage", `Invalid metadata at ${metadataPath}`);
        return null;
      }
      return parsed;
    } catch (error) {
      Logger.warn(
        "VersionStorage",
        `Failed to read metadata at ${metadataPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  static writeMetadata(
    branch: GameVersionBranch,
    versionId: string,
    metadata: VersionMetadata
  ): void {
    const metadataPath = this.getMetadataPath(branch, versionId);
    this.writeMetadataAtPath(metadataPath, metadata);
  }

  static writeMetadataToDir(targetDir: string, metadata: VersionMetadata): void {
    const metadataPath = path.join(targetDir, METADATA_FILENAME);
    this.writeMetadataAtPath(metadataPath, metadata);
  }

  private static writeMetadataAtPath(metadataPath: string, metadata: VersionMetadata): void {
    fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  }

  static loadIndex(): VersionIndex {
    const indexPath = this.getIndexPath();
    if (!fs.existsSync(indexPath)) {
      return { installed: [] };
    }
    try {
      const raw = fs.readFileSync(indexPath, "utf-8");
      const parsed = JSON.parse(raw) as VersionIndex;
      if (!parsed || !Array.isArray(parsed.installed)) {
        return { installed: [] };
      }
      return parsed;
    } catch (error) {
      Logger.warn(
        "VersionStorage",
        `Failed to read version index: ${error instanceof Error ? error.message : String(error)}`
      );
      return { installed: [] };
    }
  }

  static saveIndex(index: VersionIndex): void {
    const indexPath = this.getIndexPath();
    fs.mkdirSync(path.dirname(indexPath), { recursive: true });
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
  }

  static scanInstalledVersions(): InstalledVersionRecord[] {
    this.ensureLayout();
    const versionsRoot = this.getVersionsRoot();
    const records: InstalledVersionRecord[] = [];

    if (!fs.existsSync(versionsRoot)) return records;

    const branches = fs.readdirSync(versionsRoot, { withFileTypes: true });
    branches.forEach((branchEntry) => {
      if (!branchEntry.isDirectory()) return;
      if (!AVAILABLE_BRANCHES.includes(branchEntry.name as GameVersionBranch)) {
        return;
      }
      const branch = branchEntry.name as GameVersionBranch;
      const branchDir = path.join(versionsRoot, branchEntry.name);
      const versionEntries = fs.readdirSync(branchDir, { withFileTypes: true });

      versionEntries.forEach((versionEntry) => {
        if (!versionEntry.isDirectory()) return;
        const versionId = versionEntry.name;
        const metadata = this.readMetadata(branch, versionId);

        if (!metadata) {
          Logger.warn(
            "VersionStorage",
            `Missing metadata for ${branch}/${versionId}. Assuming directory is not a valid install.`
          );
          return;
        }

        records.push({
          id: metadata.id,
          branch: metadata.branch,
          version: metadata.version,
          installedAt: metadata.installedAt,
          sizeBytes: metadata.sizeBytes
        });
      });
    });

    return records;
  }

  static refreshIndex(): InstalledVersionRecord[] {
    const installed = this.scanInstalledVersions();
    this.saveIndex({ installed });
    return installed;
  }

  static markInstalled(record: InstalledVersionRecord): void {
    const index = this.loadIndex();
    const filtered = index.installed.filter(
      (entry) => !(entry.branch === record.branch && entry.id === record.id)
    );
    filtered.push(record);
    this.saveIndex({ installed: filtered });
  }

  static removeInstalled(branch: GameVersionBranch, versionId: string): void {
    const index = this.loadIndex();
    const filtered = index.installed.filter(
      (entry) => !(entry.branch === branch && entry.id === versionId)
    );
    this.saveIndex({ installed: filtered });
  }
}
