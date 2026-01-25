import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import https from "node:https";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import AdmZip from "adm-zip";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";

const execFileAsync = promisify(execFile);

type ApplyPatchOptions = {
  pwrFile: string;
  targetDir: string;
  stagingDir?: string;
  onOutput?: (line: string) => void;
};

/**
 * Manages butler tool for game patch application.
 * 
 * Handles butler download, installation, and patch application.
 */
export class ButlerManager {
  private static butlerDir: string | null = null;
  private static butlerPath: string | null = null;

  /**
   * Ensures butler is downloaded and installed.
   * 
   * @returns Path to the butler binary
   */
  static async ensureButler(): Promise<string> {
    const butlerPath = this.getButlerPath();

    if (fs.existsSync(butlerPath)) {
      Logger.debug("ButlerManager", `Butler already exists at ${butlerPath}`);
      return butlerPath;
    }

    Logger.info("ButlerManager", "Butler not found, downloading...");

    const butlerDir = this.getButlerDir();
    fs.mkdirSync(butlerDir, { recursive: true });

    const zipPath = path.join(butlerDir, "butler.zip");
    const downloadUrl = this.getDownloadUrl();

    try {
      Logger.info("ButlerManager", `Downloading butler from ${downloadUrl}`);
      let buffer: Buffer;
      try {
        buffer = await this.downloadFile(downloadUrl);
      } catch (downloadError) {
        if (process.platform === "darwin" && process.arch === "arm64") {
          Logger.warn(
            "ButlerManager",
            "darwin-arm64 not available, trying darwin-amd64 fallback"
          );
          const fallbackUrl = "https://broth.itch.zone/butler/darwin-amd64/LATEST/archive/default";
          buffer = await this.downloadFile(fallbackUrl);
        } else {
          throw downloadError;
        }
      }

      fs.writeFileSync(zipPath, buffer);

      Logger.info("ButlerManager", "Extracting butler...");

      const zip = new AdmZip(zipPath);
      zip.extractAllTo(butlerDir, true);

      if (process.platform !== "win32") {
        fs.chmodSync(butlerPath, 0o755);
        Logger.debug("ButlerManager", "Set executable permissions on butler");
      }

      fs.unlinkSync(zipPath);
      Logger.info("ButlerManager", `Butler installed successfully at ${butlerPath}`);

      return butlerPath;
    } catch (error) {
      if (fs.existsSync(zipPath)) {
        try {
          fs.unlinkSync(zipPath);
        } catch {
        }
      }
      Logger.error("ButlerManager", "Failed to install butler", error);
      throw error;
    }
  }

  /**
   * Returns the absolute path to the butler binary.
   * Does not check if the file exists.
   */
  static getButlerPath(): string {
    if (this.butlerPath) {
      return this.butlerPath;
    }

    const butlerDir = this.getButlerDir();
    const binaryName = process.platform === "win32" ? "butler.exe" : "butler";
    this.butlerPath = path.join(butlerDir, binaryName);
    return this.butlerPath;
  }

  /**
   * Applies a .pwr patch file to a target directory.
   * 
   * @param options - Patch application options
   */
  static async applyPatch(options: ApplyPatchOptions): Promise<void> {
    const { pwrFile, targetDir, stagingDir, onOutput } = options;

    if (!fs.existsSync(pwrFile)) {
      throw new Error(`PWR file not found: ${pwrFile}`);
    }

    if (!fs.existsSync(targetDir)) {
      throw new Error(`Target directory not found: ${targetDir}`);
    }

    const butlerPath = await this.ensureButler();
    if (!fs.existsSync(butlerPath)) {
      throw new Error(`Butler binary not found at ${butlerPath}`);
    }

    const staging = stagingDir || path.join(os.tmpdir(), `butler-staging-${Date.now()}`);
    if (!fs.existsSync(staging)) {
      fs.mkdirSync(staging, { recursive: true });
    }

    Logger.info("ButlerManager", `Applying patch ${pwrFile} to ${targetDir}`);

    const args: string[] = ["apply"];
    if (stagingDir || staging) {
      args.push("--staging-dir", staging);
    }
    args.push(pwrFile, targetDir);

    try {
      const { stdout, stderr } = await execFileAsync(butlerPath, args, {
        timeout: 10 * 60 * 1000,
        maxBuffer: 10 * 1024 * 1024
      });

      if (stdout) {
        const stdoutLines = stdout.split("\n").filter((line) => line.trim().length > 0);
        stdoutLines.forEach((line) => {
          Logger.debug("ButlerManager", `butler stdout: ${line}`);
          if (onOutput) {
            onOutput(line);
          }
        });
      }

      if (stderr) {
        const stderrLines = stderr.split("\n").filter((line) => line.trim().length > 0);
        stderrLines.forEach((line) => {
          Logger.debug("ButlerManager", `butler stderr: ${line}`);
          if (onOutput) {
            onOutput(line);
          }
        });
      }

      Logger.info("ButlerManager", "Patch applied successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error occurred while applying patch";

      let fullErrorMessage = errorMessage;
      if (error && typeof error === "object" && "stderr" in error) {
        const stderr = (error as { stderr?: string }).stderr;
        if (stderr) {
          fullErrorMessage = `${errorMessage}\nButler stderr: ${stderr}`;
        }
      }

      Logger.error("ButlerManager", "Failed to apply patch", error);
      throw new Error(fullErrorMessage);
    } finally {
      if (!stagingDir && fs.existsSync(staging)) {
        try {
          fs.rmSync(staging, { recursive: true, force: true });
        } catch {
        }
      }
    }
  }

  /**
   * Returns the directory where butler is stored.
   */
  private static getButlerDir(): string {
    if (this.butlerDir) {
      return this.butlerDir;
    }

    this.butlerDir = path.join(Paths.dataRoot, "tools", "butler");
    return this.butlerDir;
  }

  /**
   * Returns the download URL for butler based on platform and architecture.
   */
  private static getDownloadUrl(): string {
    const platform = process.platform;
    const arch = process.arch;

    const baseUrl = "https://broth.itch.zone/butler";

    if (platform === "win32") {
      if (arch === "x64") {
        return `${baseUrl}/windows-amd64/LATEST/archive/default`;
      }
      throw new Error(`Unsupported Windows architecture: ${arch}`);
    }

    if (platform === "linux") {
      if (arch === "x64") {
        return `${baseUrl}/linux-amd64/LATEST/archive/default`;
      }
      if (arch === "arm64") {
        return `${baseUrl}/linux-arm64/LATEST/archive/default`;
      }
      throw new Error(`Unsupported Linux architecture: ${arch}`);
    }

    if (platform === "darwin") {
      if (arch === "arm64") {
        return `${baseUrl}/darwin-arm64/LATEST/archive/default`;
      }
      if (arch === "x64") {
        return `${baseUrl}/darwin-amd64/LATEST/archive/default`;
      }
      throw new Error(`Unsupported macOS architecture: ${arch}`);
    }

    throw new Error(`Unsupported platform: ${platform}`);
  }

  /**
   * Downloads a file from a URL and returns it as a Buffer.
   */
  private static downloadFile(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === "https:";
      const client = isHttps ? https : http;

      const request = client.get(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return resolve(this.downloadFile(response.headers.location));
        }

        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(
            new Error(
              `Failed to download file: ${response.statusCode} ${response.statusMessage || ""}`
            )
          );
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          resolve(Buffer.concat(chunks));
        });

        response.on("error", (error) => {
          reject(error);
        });
      });

      request.on("error", (error) => {
        reject(error);
      });

      request.setTimeout(5 * 60 * 1000, () => {
        request.destroy();
        reject(new Error("Download timeout"));
      });
    });
  }
}
