import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { Logger } from "../core/Logger";

const ORIGINAL_DOMAIN = "hytale.com";
const DEFAULT_AUTH_DOMAIN = "sanasol.ws";

type PatchResult = {
  success: boolean;
  alreadyPatched: boolean;
  patchCount: number;
  error?: string;
};

/**
 * Patches game client binary to use custom authentication domain.
 * 
 * Replaces domain strings in the client executable to redirect authentication requests.
 */
export class ClientPatcher {
  private static patchedFlag = ".patched_custom";

  /**
   * Gets target authentication domain.
   * 
   * @param authDomain - Optional auth domain override
   * @returns Target domain to use for patching
   */
  static getTargetDomain(authDomain?: string): string {
    if (authDomain && authDomain.trim()) {
      return authDomain;
    }
    return process.env.HYTALE_AUTH_DOMAIN || DEFAULT_AUTH_DOMAIN;
  }

  /**
   * Gets new domain for patching, ensuring length matches original.
   * 
   * @param authDomain - Optional auth domain override
   * @returns New domain to patch into client
   */
  static getNewDomain(authDomain?: string): string {
    const domain = this.getTargetDomain(authDomain);
    if (domain.length !== ORIGINAL_DOMAIN.length) {
      Logger.warn(
        "ClientPatcher",
        `Auth domain length mismatch (${domain.length} != ${ORIGINAL_DOMAIN.length}), using default ${DEFAULT_AUTH_DOMAIN}`
      );
      return DEFAULT_AUTH_DOMAIN;
    }
    return domain;
  }

  /**
   * Ensures client and server are patched with custom authentication domain.
   * 
   * @param clientPath - Path to client executable
   * @param authDomain - Optional auth domain override
   * @param gameDir - Optional game directory path (if not provided, will be inferred from clientPath)
   * @returns Patch result with success status and occurrence count
   */
  static async ensureClientPatched(
    clientPath: string,
    authDomain?: string,
    gameDir?: string
  ): Promise<PatchResult> {
    const newDomain = this.getNewDomain(authDomain);
    if (newDomain === ORIGINAL_DOMAIN) {
      return { success: true, alreadyPatched: true, patchCount: 0 };
    }

    let totalCount = 0;
    let clientPatched = false;
    let serverPatched = false;

    if (fs.existsSync(clientPath)) {
      if (this.isPatchedAlready(clientPath, newDomain)) {
        Logger.info("ClientPatcher", `Client already patched for ${newDomain}`);
        clientPatched = true;
      } else {
        try {
          this.backupClient(clientPath);
          const data = fs.readFileSync(clientPath);
          const { buffer, count } = this.findAndReplaceDomainSmart(
            data,
            ORIGINAL_DOMAIN,
            newDomain
          );

          if (count > 0) {
            fs.writeFileSync(clientPath, buffer);
            this.markAsPatched(clientPath, newDomain);
            Logger.info("ClientPatcher", `Patched client for ${newDomain} (${count} occurrences)`);
            totalCount += count;
            clientPatched = true;
          } else {
            Logger.warn("ClientPatcher", "No domain occurrences found in client to patch");
          }
        } catch (error) {
          Logger.error("ClientPatcher", "Failed to patch client binary", error);
        }
      }
    } else {
      Logger.warn("ClientPatcher", `Client binary not found: ${clientPath}`);
    }

    let serverGameDir = gameDir;
    if (!serverGameDir) {
      serverGameDir = path.dirname(clientPath);
      if (path.basename(serverGameDir) === "Client" || path.basename(serverGameDir) === "client") {
        serverGameDir = path.dirname(serverGameDir);
      }
    }
    const serverPath = this.findServerPath(serverGameDir);
    if (serverPath && fs.existsSync(serverPath)) {
      const serverResult = await this.patchServer(serverPath, authDomain);
      if (serverResult.success) {
        totalCount += serverResult.patchCount;
        serverPatched = true;
      }
    } else {
      Logger.debug("ClientPatcher", "Server JAR not found, skipping server patch");
    }

    const success = clientPatched || serverPatched;
    return {
      success,
      alreadyPatched: clientPatched && serverPatched,
      patchCount: totalCount
    };
  }

  /**
   * Finds server JAR path in game directory.
   * 
   * @param gameDir - Path to game directory
   * @returns Path to server JAR or null if not found
   */
  private static findServerPath(gameDir: string): string | null {
    const candidates = [
      path.join(gameDir, "Server", "HytaleServer.jar"),
      path.join(gameDir, "server", "HytaleServer.jar"),
      path.join(gameDir, "Server", "server.jar")
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Patches server JAR to use custom authentication domain.
   * 
   * @param serverPath - Path to server JAR
   * @param authDomain - Optional auth domain override
   * @returns Patch result with success status and occurrence count
   */
  private static async patchServer(
    serverPath: string,
    authDomain?: string
  ): Promise<PatchResult> {
    const newDomain = this.getNewDomain(authDomain);
    if (newDomain === ORIGINAL_DOMAIN) {
      return { success: true, alreadyPatched: true, patchCount: 0 };
    }

    if (this.isPatchedAlready(serverPath, newDomain)) {
      Logger.info("ClientPatcher", `Server already patched for ${newDomain}`);
      return { success: true, alreadyPatched: true, patchCount: 0 };
    }

    try {
      this.backupClient(serverPath);
      const zip = new AdmZip(serverPath);
      const entries = zip.getEntries();

      let totalCount = 0;
      const oldUtf8 = Buffer.from(ORIGINAL_DOMAIN, "utf8");
      const newUtf8 = Buffer.from(newDomain, "utf8");

      for (const entry of entries) {
        const name = entry.entryName;
        if (
          name.endsWith(".class") ||
          name.endsWith(".properties") ||
          name.endsWith(".json") ||
          name.endsWith(".xml") ||
          name.endsWith(".yml")
        ) {
          const data = entry.getData();
          if (data.includes(oldUtf8)) {
            const { buffer: patchedData, count } = this.findAndReplaceDomainUtf8(
              data,
              ORIGINAL_DOMAIN,
              newDomain
            );
            if (count > 0) {
              zip.updateFile(entry.entryName, patchedData);
              Logger.debug("ClientPatcher", `Patched ${count} occurrences in ${name}`);
              totalCount += count;
            }
          }
        }
      }

      if (totalCount === 0) {
        Logger.warn("ClientPatcher", "No domain occurrences found in server JAR to patch");
      } else {
        zip.writeZip(serverPath);
        this.markAsPatched(serverPath, newDomain);
        Logger.info("ClientPatcher", `Patched server for ${newDomain} (${totalCount} occurrences)`);
      }

      return { success: true, alreadyPatched: false, patchCount: totalCount };
    } catch (error) {
      Logger.error("ClientPatcher", "Failed to patch server JAR", error);
      return {
        success: false,
        alreadyPatched: false,
        patchCount: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * UTF-8 domain replacement for Java JAR files.
   * Java stores strings in UTF-8 format in the constant pool.
   */
  private static findAndReplaceDomainUtf8(
    data: Buffer,
    oldDomain: string,
    newDomain: string
  ): { buffer: Buffer; count: number } {
    let count = 0;
    const result = Buffer.from(data);

    const oldUtf8 = Buffer.from(oldDomain, "utf8");
    const newUtf8 = Buffer.from(newDomain, "utf8");

    const positions = this.findAllOccurrences(result, oldUtf8);

    for (const pos of positions) {
      newUtf8.copy(result, pos);
      count++;
    }

    return { buffer: result, count };
  }

  private static isPatchedAlready(clientPath: string, targetDomain: string): boolean {
    const flagPath = clientPath + this.patchedFlag;
    if (!fs.existsSync(flagPath)) return false;
    try {
      const data = JSON.parse(fs.readFileSync(flagPath, "utf-8")) as {
        targetDomain?: string;
      };
      return data?.targetDomain === targetDomain;
    } catch {
      return false;
    }
  }

  private static markAsPatched(clientPath: string, targetDomain: string): void {
    const flagPath = clientPath + this.patchedFlag;
    const payload = {
      patchedAt: new Date().toISOString(),
      originalDomain: ORIGINAL_DOMAIN,
      targetDomain
    };
    fs.writeFileSync(flagPath, JSON.stringify(payload, null, 2), "utf-8");
  }

  private static backupClient(clientPath: string): void {
    const backupPath = clientPath + ".original";
    if (fs.existsSync(backupPath)) return;
    fs.copyFileSync(clientPath, backupPath);
  }

  private static stringToUtf16LE(value: string): Buffer {
    const buffer = Buffer.alloc(value.length * 2);
    for (let i = 0; i < value.length; i += 1) {
      buffer.writeUInt16LE(value.charCodeAt(i), i * 2);
    }
    return buffer;
  }

  private static findAllOccurrences(buffer: Buffer, pattern: Buffer): number[] {
    const positions: number[] = [];
    let pos = 0;
    while (pos < buffer.length) {
      const index = buffer.indexOf(pattern, pos);
      if (index === -1) break;
      positions.push(index);
      pos = index + 1;
    }
    return positions;
  }

  private static findAndReplaceDomainSmart(
    data: Buffer,
    oldDomain: string,
    newDomain: string
  ): { buffer: Buffer; count: number } {
    let count = 0;
    const result = Buffer.from(data);

    const oldUtf16NoLast = this.stringToUtf16LE(oldDomain.slice(0, -1));
    const newUtf16NoLast = this.stringToUtf16LE(newDomain.slice(0, -1));
    const oldLastCharByte = oldDomain.charCodeAt(oldDomain.length - 1);
    const newLastCharByte = newDomain.charCodeAt(newDomain.length - 1);

    const positions = this.findAllOccurrences(result, oldUtf16NoLast);
    for (const pos of positions) {
      const lastCharPos = pos + oldUtf16NoLast.length;
      if (lastCharPos + 1 > result.length) continue;
      const lastCharFirstByte = result[lastCharPos];
      if (lastCharFirstByte === oldLastCharByte) {
        newUtf16NoLast.copy(result, pos);
        result[lastCharPos] = newLastCharByte;
        count += 1;
      }
    }

    return { buffer: result, count };
  }
}
