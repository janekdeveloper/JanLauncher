import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import axios from "axios";
import AdmZip from "adm-zip";
import * as tar from "tar";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";

const JRE_MANIFEST_URL = "https://launcher.hytale.com/version/release/jre.json";

type JreAsset = {
  url: string;
  sha256: string;
};

/**
 * Manages bundled Java installation.
 * 
 * JanLauncher ALWAYS uses ONLY bundled Java. System Java, JAVA_HOME, PATH
 * and any other sources are completely excluded from the launch logic.
 */
export class JavaManager {
  private static ensurePromise: Promise<string> | null = null;

  /**
   * Ensures bundled Java is available, downloading it if needed.
   * 
   * @param onProgress - Optional progress callback
   * @returns Path to bundled Java executable
   */
  static async ensureJava(onProgress?: (message: string) => void): Promise<string> {
    if (this.ensurePromise) {
      return this.ensurePromise;
    }

    this.ensurePromise = (async () => {
      try {
        const bundledPath = this.getBundledJavaPath();
        
        if (fs.existsSync(bundledPath)) {
          Logger.info("JavaManager", `Using bundled Java: ${bundledPath}`);
          return bundledPath;
        }

        onProgress?.("Downloading bundled Java...");
        const javaPath = await this.downloadBundledJre(onProgress);
        Logger.info("JavaManager", `Bundled Java ready at ${javaPath}`);
        return javaPath;
      } catch (error) {
        Logger.error("JavaManager", "Failed to ensure Java", error);
        throw error;
      } finally {
        this.ensurePromise = null;
      }
    })();

    return this.ensurePromise;
  }

  /**
   * Returns the path to bundled Java executable.
   * 
   * @returns Path to bundled Java binary
   */
  static getBundledJavaPath(): string {
    return path.join(this.getBundledJavaHome(), "bin", this.getJavaBinaryName());
  }

  private static getBundledJavaRoot(): string {
    return path.join(Paths.dataRoot, "java");
  }

  private static getBundledJavaHome(): string {
    return path.join(this.getBundledJavaRoot(), "current");
  }

  private static getJavaBinaryName(): string {
    return process.platform === "win32" ? "java.exe" : "java";
  }

  private static mapOs(): "windows" | "linux" | "darwin" {
    switch (process.platform) {
      case "win32":
        return "windows";
      case "linux":
        return "linux";
      case "darwin":
        return "darwin";
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
  }

  private static mapArch(): "amd64" | "arm64" {
    switch (process.arch) {
      case "x64":
        return "amd64";
      case "arm64":
        return "arm64";
      default:
        throw new Error(`Unsupported architecture: ${process.arch}`);
    }
  }

  private static async downloadBundledJre(onProgress?: (message: string) => void): Promise<string> {
    const javaRoot = this.getBundledJavaRoot();
    fs.mkdirSync(javaRoot, { recursive: true });

    onProgress?.("Fetching JRE manifest...");
    const manifest = await this.fetchJreManifest();
    const osKey = this.mapOs();
    const archKey = this.mapArch();
    const asset = this.pickJreAsset(manifest, osKey, archKey);

    onProgress?.(`Downloading JRE (${osKey}/${archKey})...`);
    const buffer = await this.downloadAsset(asset.url);

    onProgress?.("Verifying JRE checksum...");
    this.verifySha256(buffer, asset.sha256);

    const archivePath = path.join(
      javaRoot,
      `.jre-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`
    );
    const archiveTmpPath = `${archivePath}.download`;
    const extractDir = path.join(
      javaRoot,
      `.extract-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );

    try {
      fs.writeFileSync(archiveTmpPath, buffer);
      fs.renameSync(archiveTmpPath, archivePath);

      fs.mkdirSync(extractDir, { recursive: true });

      onProgress?.("Extracting JRE...");
      await this.extractArchive(archivePath, extractDir, asset.url);

      const javaHome = this.findJavaHome(extractDir);
      if (!javaHome) {
        throw new Error("Java executable not found in extracted archive");
      }

      const stagingDir = path.join(javaRoot, `.staging-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      this.prepareStaging(javaHome, extractDir, stagingDir);

      this.replaceCurrent(stagingDir);

      const javaPath = this.getBundledJavaPath();
      if (process.platform !== "win32") {
        try {
          fs.chmodSync(javaPath, 0o755);
        } catch (error) {
          Logger.warn("JavaManager", "Failed to set executable permissions");
        }
      }

      return javaPath;
    } finally {
      this.safeUnlink(archiveTmpPath);
      this.safeUnlink(archivePath);
      this.safeRemoveDir(extractDir);
    }
  }

  private static async fetchJreManifest(): Promise<unknown> {
    try {
      const response = await axios.get(JRE_MANIFEST_URL, {
        responseType: "json",
        timeout: 30_000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      return response.data;
    } catch (error) {
      Logger.error("JavaManager", "Failed to fetch JRE manifest", error);
      throw error;
    }
  }

  private static pickJreAsset(
    manifest: unknown,
    osKey: string,
    archKey: string
  ): JreAsset {
    if (!manifest || typeof manifest !== "object") {
      throw new Error("Invalid JRE manifest format");
    }

    const manifestObj = manifest as Record<string, unknown>;
    const downloadUrl = manifestObj.download_url;
    
    if (!downloadUrl || typeof downloadUrl !== "object") {
      throw new Error("Invalid JRE manifest format: missing download_url");
    }

    const osEntry = (downloadUrl as Record<string, unknown>)[osKey];
    if (!osEntry || typeof osEntry !== "object") {
      throw new Error(`No JRE data for OS: ${osKey}`);
    }

    const archEntry = (osEntry as Record<string, unknown>)[archKey];
    if (!archEntry || typeof archEntry !== "object") {
      throw new Error(`No JRE data for architecture: ${archKey}`);
    }

    const url = (archEntry as Record<string, unknown>).url;
    const sha256 = (archEntry as Record<string, unknown>).sha256;

    if (typeof url !== "string" || typeof sha256 !== "string") {
      throw new Error(`Invalid JRE asset format for ${osKey}/${archKey}`);
    }

    return { url, sha256 };
  }

  private static async downloadAsset(url: string): Promise<Buffer> {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: "arraybuffer",
        timeout: 5 * 60 * 1000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://launcher.hytale.com/",
          "Connection": "keep-alive"
        }
      });
      return Buffer.from(response.data);
    } catch (error) {
      Logger.error("JavaManager", `Failed to download JRE from ${url}`, error);
      throw error;
    }
  }

  private static verifySha256(buffer: Buffer, expected: string): void {
    const hash = createHash("sha256").update(buffer).digest("hex");
    if (hash.toLowerCase() !== expected.toLowerCase()) {
      throw new Error("JRE checksum mismatch");
    }
  }

  private static async extractArchive(
    archivePath: string,
    destination: string,
    sourceUrl: string
  ): Promise<void> {
    const type = this.detectArchiveType(sourceUrl, archivePath);
    if (type === "zip") {
      this.extractZip(archivePath, destination);
      return;
    }

    if (type === "tar") {
      await this.extractTar(archivePath, destination);
      return;
    }

    throw new Error("Unsupported archive type");
  }

  private static detectArchiveType(sourceUrl: string, archivePath: string): "zip" | "tar" {
    const lower = sourceUrl.toLowerCase();
    if (lower.endsWith(".zip")) return "zip";
    if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar";

    const fd = fs.openSync(archivePath, "r");
    const header = Buffer.alloc(4);
    fs.readSync(fd, header, 0, 4, 0);
    fs.closeSync(fd);

    if (header[0] === 0x50 && header[1] === 0x4b) return "zip";
    if (header[0] === 0x1f && header[1] === 0x8b) return "tar";

    throw new Error("Unknown archive format");
  }

  private static extractZip(archivePath: string, destination: string): void {
    const zip = new AdmZip(archivePath);
    const entries = zip.getEntries();

    entries.forEach((entry) => {
      const entryPath = entry.entryName;
      this.assertSafeArchivePath(destination, entryPath);

      const targetPath = path.join(destination, entryPath);
      if (entry.isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, entry.getData());
      }
    });
  }

  private static async extractTar(archivePath: string, destination: string): Promise<void> {
    await tar.t({
      file: archivePath,
      onentry: (entry) => {
        this.assertSafeArchivePath(destination, entry.path);
      }
    });

    await tar.x({
      file: archivePath,
      cwd: destination
    });
  }

  private static assertSafeArchivePath(root: string, entryPath: string): void {
    const rootResolved = path.resolve(root);
    const entryResolved = path.resolve(root, entryPath);
    const normalizedRoot =
      process.platform === "win32" ? rootResolved.toLowerCase() : rootResolved;
    const normalizedEntry =
      process.platform === "win32" ? entryResolved.toLowerCase() : entryResolved;

    if (
      normalizedEntry !== normalizedRoot &&
      !normalizedEntry.startsWith(normalizedRoot + path.sep)
    ) {
      throw new Error(`Unsafe archive entry: ${entryPath}`);
    }
  }

  private static findJavaHome(root: string): string | null {
    const binaryName = this.getJavaBinaryName();
    const queue: string[] = [root];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const binPath = path.join(current, "bin", binaryName);
      if (fs.existsSync(binPath)) {
        return current;
      }

      const entries = fs.readdirSync(current, { withFileTypes: true });
      entries.forEach((entry) => {
        if (entry.isDirectory()) {
          queue.push(path.join(current, entry.name));
        }
      });
    }

    return null;
  }

  private static prepareStaging(javaHome: string, extractRoot: string, stagingDir: string): void {
    try {
      if (javaHome === extractRoot) {
        fs.renameSync(extractRoot, stagingDir);
        return;
      }

      fs.renameSync(javaHome, stagingDir);
      fs.rmSync(extractRoot, { recursive: true, force: true });
    } catch (error) {
      Logger.error("JavaManager", "Failed to prepare staging directory", error);
      throw error;
    }
  }

  private static replaceCurrent(stagingDir: string): void {
    const javaRoot = this.getBundledJavaRoot();
    const currentDir = this.getBundledJavaHome();
    const backupDir = path.join(javaRoot, `.backup-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    try {
      if (fs.existsSync(currentDir)) {
        fs.renameSync(currentDir, backupDir);
      }

      fs.renameSync(stagingDir, currentDir);

      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
    } catch (error) {
      if (fs.existsSync(backupDir) && !fs.existsSync(currentDir)) {
        try {
          fs.renameSync(backupDir, currentDir);
        } catch {
        }
      }
      Logger.error("JavaManager", "Failed to replace current JRE", error);
      throw error;
    }
  }

  private static safeUnlink(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
    }
  }

  private static safeRemoveDir(dirPath: string): void {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch {
    }
  }
}
