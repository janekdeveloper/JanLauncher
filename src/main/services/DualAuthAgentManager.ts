import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { Logger } from "../core/Logger";

const DEFAULT_AGENT_URL =
  "https://github.com/sanasol/hytale-auth-server/releases/latest/download/dualauth-agent.jar";
const AGENT_FILENAME = "dualauth-agent.jar";
const MIN_AGENT_SIZE_BYTES = 1024;

export type DualAuthAgentResult = {
  success: boolean;
  agentPath?: string;
  alreadyExists?: boolean;
  error?: string;
};

export class DualAuthAgentManager {
  static getAgentUrl(): string {
    const override = process.env.DUALAUTH_AGENT_URL?.trim();
    return override && override.length > 0 ? override : DEFAULT_AGENT_URL;
  }

  static getAgentPath(serverDir: string): string {
    return path.join(serverDir, AGENT_FILENAME);
  }

  static applyJavaAgentEnv(env: NodeJS.ProcessEnv, agentPath: string): NodeJS.ProcessEnv {
    const agentFlag = `-javaagent:${agentPath}`;
    const current = env.JAVA_TOOL_OPTIONS?.trim();
    const next = current && current.length > 0 ? `${current} ${agentFlag}` : agentFlag;
    return { ...env, JAVA_TOOL_OPTIONS: next };
  }

  static async ensureAgentAvailable(
    serverDir: string,
    progressCallback?: (message: string, percent?: number) => void
  ): Promise<DualAuthAgentResult> {
    const agentPath = this.getAgentPath(serverDir);

    if (fs.existsSync(agentPath)) {
      try {
        const stats = fs.statSync(agentPath);
        if (stats.size >= MIN_AGENT_SIZE_BYTES) {
          if (progressCallback) progressCallback("DualAuth Agent ready", 100);
          return { success: true, agentPath, alreadyExists: true };
        }
        fs.unlinkSync(agentPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.warn("DualAuthAgent", `Failed to verify existing agent: ${message}`);
      }
    }

    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true });
    }

    const downloadUrl = this.getAgentUrl();
    const tmpPath = `${agentPath}.tmp`;
    if (progressCallback) progressCallback("Downloading DualAuth Agent...", 20);

    try {
      await this.downloadToFile(downloadUrl, tmpPath, (downloaded, total) => {
        if (progressCallback && total) {
          const percent = 20 + Math.floor((downloaded / total) * 70);
          progressCallback(`Downloading agent... ${(downloaded / 1024).toFixed(0)} KB`, percent);
        }
      });

      const stats = fs.statSync(tmpPath);
      if (stats.size < MIN_AGENT_SIZE_BYTES) {
        fs.unlinkSync(tmpPath);
        const error = "Downloaded agent too small (corrupt or failed download)";
        return { success: false, error };
      }

      if (fs.existsSync(agentPath)) {
        fs.unlinkSync(agentPath);
      }
      fs.renameSync(tmpPath, agentPath);

      if (progressCallback) progressCallback("DualAuth Agent ready", 100);
      return { success: true, agentPath };
    } catch (error) {
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch {
        // ignore cleanup failures
      }
      const message = error instanceof Error ? error.message : String(error);
      Logger.error("DualAuthAgent", `Failed to download agent: ${message}`);
      return { success: false, error: message };
    }
  }

  private static async downloadToFile(
    url: string,
    targetPath: string,
    onProgress?: (downloaded: number, total?: number) => void
  ): Promise<void> {
    const client = url.startsWith("https://") ? https : http;
    await new Promise<void>((resolve, reject) => {
      const request = client.get(url, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          this.downloadToFile(response.headers.location, targetPath, onProgress)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (!response.statusCode || response.statusCode >= 400) {
          reject(new Error(`Download failed: ${response.statusCode ?? "unknown status"}`));
          return;
        }

        const file = fs.createWriteStream(targetPath);
        const total = response.headers["content-length"]
          ? Number(response.headers["content-length"])
          : undefined;
        let downloaded = 0;

        response.on("data", (chunk) => {
          downloaded += chunk.length;
          onProgress?.(downloaded, total);
        });

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", reject);
      });

      request.on("error", reject);
    });
  }
}
