export type GameVersionBranch = "release" | "pre-release" | "beta" | "alpha";

export const AVAILABLE_BRANCHES: GameVersionBranch[] = [
  "release",
  "pre-release",
  "beta",
  "alpha"
];

export type GameVersionInfo = {
  id: string;
  branch: GameVersionBranch;
  version: number;
  label: string;
  isLatest: boolean;
  installed: boolean;
  localOnly?: boolean;
};

export type InstalledVersionRecord = {
  id: string;
  branch: GameVersionBranch;
  version: number;
  installedAt: string;
  sizeBytes?: number;
};

export type VersionIndex = {
  installed: InstalledVersionRecord[];
};

export type ActiveGameVersion = {
  branch: GameVersionBranch;
  versionId: string | null;
};
