import fs from "node:fs";
import path from "node:path";
import { Logger } from "../core/Logger";
import { DualAuthAgentManager } from "./DualAuthAgentManager";

const ORIGINAL_DOMAIN = "hytale.com";
const MIN_DOMAIN_LENGTH = 4;
const MAX_DOMAIN_LENGTH = 16;
const DEFAULT_PROTOCOL = "https://";

type PatchResult = {
  success: boolean;
  alreadyPatched: boolean;
  patchCount: number;
  error?: string;
  warning?: string;
  agentPath?: string;
};

type ByteBuffer = Buffer<ArrayBufferLike>;

type DomainStrategy = {
  mode: "direct" | "split";
  mainDomain: string;
  subdomainPrefix: string;
  description: string;
};

type PatchStatus = {
  patched: boolean;
  currentDomain: string | null;
  needsRestore: boolean;
};

export class ClientPatcher {
  private static patchedFlag = ".patched_custom";

  private static getNewDomain(authDomain?: string): string {
    const domain = authDomain?.trim() ?? "";
    if (!domain) {
      throw new Error("Auth domain is required for patching");
    }
    if (domain.length < MIN_DOMAIN_LENGTH || domain.length > MAX_DOMAIN_LENGTH) {
      throw new Error(
        `Auth domain length must be ${MIN_DOMAIN_LENGTH}-${MAX_DOMAIN_LENGTH} characters (got ${domain.length})`
      );
    }
    return domain;
  }

  private static getDomainStrategy(domain: string): DomainStrategy {
    if (domain.length <= 10) {
      return {
        mode: "direct",
        mainDomain: domain,
        subdomainPrefix: "",
        description: `Direct replacement: ${ORIGINAL_DOMAIN} -> ${domain}`
      };
    }
    const prefix = domain.slice(0, 6);
    const suffix = domain.slice(6);
    return {
      mode: "split",
      mainDomain: suffix,
      subdomainPrefix: prefix,
      description: `Split mode: subdomain prefix="${prefix}", main domain="${suffix}"`
    };
  }

  private static stringToLengthPrefixed(value: string): ByteBuffer {
    const length = value.length;
    const result = Buffer.alloc(4 + length + (length - 1));
    result[0] = length;
    result[1] = 0x00;
    result[2] = 0x00;
    result[3] = 0x00;

    let pos = 4;
    for (let i = 0; i < length; i += 1) {
      result[pos++] = value.charCodeAt(i);
      if (i < length - 1) {
        result[pos++] = 0x00;
      }
    }
    return result;
  }

  private static stringToUtf16LE(value: string): ByteBuffer {
    const buffer = Buffer.alloc(value.length * 2);
    for (let i = 0; i < value.length; i += 1) {
      buffer.writeUInt16LE(value.charCodeAt(i), i * 2);
    }
    return buffer;
  }

  private static findAllOccurrences(buffer: ByteBuffer, pattern: ByteBuffer): number[] {
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

  private static replaceBytes(
    buffer: ByteBuffer,
    oldBytes: ByteBuffer,
    newBytes: ByteBuffer
  ): { buffer: ByteBuffer; count: number } {
    let count = 0;
    const result = Buffer.from(buffer);

    if (newBytes.length > oldBytes.length) {
      Logger.warn(
        "ClientPatcher",
        `New pattern (${newBytes.length}) longer than old (${oldBytes.length}), skipping`
      );
      return { buffer: result, count: 0 };
    }

    const positions = this.findAllOccurrences(result, oldBytes);
    for (const pos of positions) {
      newBytes.copy(result, pos);
      count += 1;
    }

    return { buffer: result, count };
  }

  private static findAndReplaceDomainSmart(
    data: ByteBuffer,
    oldDomain: string,
    newDomain: string
  ): { buffer: ByteBuffer; count: number } {
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

  private static applyDomainPatches(
    data: ByteBuffer,
    domain: string,
    protocol = DEFAULT_PROTOCOL
  ): { buffer: ByteBuffer; count: number } {
    let result: ByteBuffer = Buffer.from(data);
    let totalCount = 0;
    const strategy = this.getDomainStrategy(domain);

    Logger.info("ClientPatcher", `Patching strategy: ${strategy.description}`);

    const oldSentry = "https://ca900df42fcf57d4dd8401a86ddd7da2@sentry.hytale.com/2";
    const newSentry = `${protocol}t@${domain}/2`;
    const sentryResult = this.replaceBytes(
      result,
      this.stringToLengthPrefixed(oldSentry),
      this.stringToLengthPrefixed(newSentry)
    );
    result = sentryResult.buffer;
    if (sentryResult.count > 0) {
      totalCount += sentryResult.count;
    }

    const domainResult = this.replaceBytes(
      result,
      this.stringToLengthPrefixed(ORIGINAL_DOMAIN),
      this.stringToLengthPrefixed(strategy.mainDomain)
    );
    result = domainResult.buffer;
    if (domainResult.count > 0) {
      totalCount += domainResult.count;
    }

    const subdomains = [
      "https://tools.",
      "https://sessions.",
      "https://account-data.",
      "https://telemetry."
    ];
    const newSubdomainPrefix = protocol + strategy.subdomainPrefix;

    for (const sub of subdomains) {
      const subResult = this.replaceBytes(
        result,
        this.stringToLengthPrefixed(sub),
        this.stringToLengthPrefixed(newSubdomainPrefix)
      );
      result = subResult.buffer;
      if (subResult.count > 0) {
        totalCount += subResult.count;
      }
    }

    return { buffer: result, count: totalCount };
  }

  private static patchDiscordUrl(data: ByteBuffer): { buffer: ByteBuffer; count: number } {
    let count = 0;
    const result: ByteBuffer = Buffer.from(data);

    const oldUrl = ".gg/hytale";
    const newUrl = ".gg/...";

    const lpResult = this.replaceBytes(
      result,
      this.stringToLengthPrefixed(oldUrl),
      this.stringToLengthPrefixed(newUrl)
    );
    if (lpResult.count > 0) {
      return { buffer: lpResult.buffer, count: lpResult.count };
    }

    const oldUtf16 = this.stringToUtf16LE(oldUrl);
    const newUtf16 = this.stringToUtf16LE(newUrl);

    const positions = this.findAllOccurrences(result, oldUtf16);
    for (const pos of positions) {
      newUtf16.copy(result, pos);
      count += 1;
    }

    return { buffer: result, count };
  }

  private static getPatchStatus(clientPath: string, targetDomain: string): PatchStatus {
    const patchFlagFile = clientPath + this.patchedFlag;
    if (fs.existsSync(patchFlagFile)) {
      try {
        const flagData = JSON.parse(fs.readFileSync(patchFlagFile, "utf8")) as {
          targetDomain?: string;
        };
        const currentDomain = flagData.targetDomain ?? null;
        if (currentDomain === targetDomain) {
          const data = fs.readFileSync(clientPath);
          const strategy = this.getDomainStrategy(targetDomain);
          const domainPattern = this.stringToLengthPrefixed(strategy.mainDomain);
          if (data.includes(domainPattern)) {
            return { patched: true, currentDomain, needsRestore: false };
          }
          return { patched: false, currentDomain: null, needsRestore: false };
        }
        return { patched: false, currentDomain, needsRestore: true };
      } catch {
        return { patched: false, currentDomain: null, needsRestore: false };
      }
    }
    return { patched: false, currentDomain: null, needsRestore: false };
  }

  private static isPatchedAlready(clientPath: string, targetDomain: string): boolean {
    return this.getPatchStatus(clientPath, targetDomain).patched;
  }

  private static restoreFromBackup(clientPath: string): boolean {
    const backupPath = clientPath + ".original";
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, clientPath);
      const patchFlagFile = clientPath + this.patchedFlag;
      if (fs.existsSync(patchFlagFile)) {
        fs.unlinkSync(patchFlagFile);
      }
      return true;
    }
    return false;
  }

  private static markAsPatched(clientPath: string, targetDomain: string): void {
    const strategy = this.getDomainStrategy(targetDomain);
    const patchFlagFile = clientPath + this.patchedFlag;
    const payload = {
      patchedAt: new Date().toISOString(),
      originalDomain: ORIGINAL_DOMAIN,
      targetDomain,
      patchMode: strategy.mode,
      mainDomain: strategy.mainDomain,
      subdomainPrefix: strategy.subdomainPrefix,
      patcherVersion: "1.0.0"
    };
    fs.writeFileSync(patchFlagFile, JSON.stringify(payload, null, 2));
  }

  private static backupClient(clientPath: string): string | null {
    const backupPath = clientPath + ".original";
    try {
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(clientPath, backupPath);
        return backupPath;
      }

      const currentSize = fs.statSync(clientPath).size;
      const backupSize = fs.statSync(backupPath).size;
      if (currentSize !== backupSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const oldBackupPath = `${clientPath}.original.${timestamp}`;
        fs.renameSync(backupPath, oldBackupPath);
        fs.copyFileSync(clientPath, backupPath);
        return backupPath;
      }

      return backupPath;
    } catch (error) {
      Logger.warn("ClientPatcher", `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private static async patchClient(
    clientPath: string,
    targetDomain: string,
    progressCallback?: (message: string, percent?: number) => void
  ): Promise<PatchResult> {
    const strategy = this.getDomainStrategy(targetDomain);
    Logger.info("ClientPatcher", `Patching client: ${clientPath}`);
    Logger.info("ClientPatcher", `Target domain: ${targetDomain} (${targetDomain.length} chars)`);
    Logger.info("ClientPatcher", `Mode: ${strategy.mode}`);

    if (!fs.existsSync(clientPath)) {
      const error = `Client binary not found: ${clientPath}`;
      Logger.error("ClientPatcher", error);
      return { success: false, alreadyPatched: false, patchCount: 0, error };
    }

    const patchStatus = this.getPatchStatus(clientPath, targetDomain);
    if (patchStatus.patched) {
      if (progressCallback) progressCallback("Client already patched", 100);
      return { success: true, alreadyPatched: true, patchCount: 0 };
    }

    if (patchStatus.needsRestore) {
      if (progressCallback) progressCallback("Restoring original for domain change...", 5);
      this.restoreFromBackup(clientPath);
    }

    if (progressCallback) progressCallback("Preparing to patch client...", 10);
    this.backupClient(clientPath);

    if (progressCallback) progressCallback("Reading client binary...", 20);
    const data = fs.readFileSync(clientPath);

    if (progressCallback) progressCallback("Patching domain references...", 50);
    const { buffer: patchedData, count } = this.applyDomainPatches(data, targetDomain);

    const { buffer: finalData, count: discordCount } = this.patchDiscordUrl(patchedData);

    if (count === 0 && discordCount === 0) {
      const legacyResult = this.findAndReplaceDomainSmart(data, ORIGINAL_DOMAIN, strategy.mainDomain);
      if (legacyResult.count > 0) {
        fs.writeFileSync(clientPath, legacyResult.buffer);
        this.markAsPatched(clientPath, targetDomain);
        return { success: true, alreadyPatched: false, patchCount: legacyResult.count };
      }
      return {
        success: true,
        alreadyPatched: false,
        patchCount: 0,
        warning: "No occurrences found in client binary"
      };
    }

    if (progressCallback) progressCallback("Writing patched binary...", 80);
    fs.writeFileSync(clientPath, finalData);
    this.markAsPatched(clientPath, targetDomain);
    if (progressCallback) progressCallback("Patching complete", 100);

    return { success: true, alreadyPatched: false, patchCount: count + discordCount };
  }

  private static serverJarContainsDualAuth(serverPath: string): boolean {
    try {
      const data = fs.readFileSync(serverPath);
      const signature = Buffer.from("DualAuthContext", "utf8");
      return data.includes(signature);
    } catch {
      return false;
    }
  }

  private static restoreLegacyServerPatch(serverPath: string): {
    restored: boolean;
    error?: string;
  } {
    const legacyFlag = serverPath + ".patched_custom";
    const dualauthFlag = serverPath + ".dualauth_patched";
    const hasLegacyFlag = fs.existsSync(legacyFlag) || fs.existsSync(dualauthFlag);
    const hasDualAuth = this.serverJarContainsDualAuth(serverPath);

    if (!hasLegacyFlag && !hasDualAuth) {
      return { restored: false };
    }

    const backupPath = serverPath + ".original";
    if (!fs.existsSync(backupPath)) {
      return {
        restored: false,
        error: "Legacy server patch detected but no backup found"
      };
    }

    fs.copyFileSync(backupPath, serverPath);
    try {
      if (fs.existsSync(legacyFlag)) fs.unlinkSync(legacyFlag);
      if (fs.existsSync(dualauthFlag)) fs.unlinkSync(dualauthFlag);
    } catch {
    }

    return { restored: true };
  }

  private static async ensureServerAgent(
    serverPath: string,
    progressCallback?: (message: string, percent?: number) => void
  ): Promise<{ success: boolean; agentPath?: string; error?: string }> {
    if (!fs.existsSync(serverPath)) {
      return { success: true };
    }

    const restoreResult = this.restoreLegacyServerPatch(serverPath);
    if (restoreResult.error) {
      return { success: false, error: restoreResult.error };
    }

    const serverDir = path.dirname(serverPath);
    const agentResult = await DualAuthAgentManager.ensureAgentAvailable(
      serverDir,
      progressCallback
    );
    if (!agentResult.success) {
      return { success: false, error: agentResult.error || "Agent download failed" };
    }

    return { success: true, agentPath: agentResult.agentPath };
  }

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

  static async ensureClientPatched(
    clientPath: string,
    authDomain?: string,
    gameDir?: string,
    branch = "release"
  ): Promise<PatchResult> {
    let targetDomain: string;
    try {
      targetDomain = this.getNewDomain(authDomain);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.error("ClientPatcher", message);
      return { success: false, alreadyPatched: false, patchCount: 0, error: message };
    }

    const patchStatus = this.getPatchStatus(clientPath, targetDomain);
    if (targetDomain === ORIGINAL_DOMAIN && patchStatus.needsRestore) {
      this.restoreFromBackup(clientPath);
    }

    const clientResult =
      targetDomain === ORIGINAL_DOMAIN
        ? { success: true, alreadyPatched: true, patchCount: 0 }
        : await this.patchClient(clientPath, targetDomain);

    let serverResult: PatchResult | null = null;
    let serverGameDir = gameDir;
    if (!serverGameDir) {
      serverGameDir = path.dirname(clientPath);
      if (path.basename(serverGameDir).toLowerCase() === "client") {
        serverGameDir = path.dirname(serverGameDir);
      }
    }
    const serverPath = this.findServerPath(serverGameDir);
    if (serverPath) {
      const agentResult = await this.ensureServerAgent(serverPath);
      if (!agentResult.success) {
        return {
          success: false,
          alreadyPatched: false,
          patchCount: clientResult.patchCount || 0,
          error: `DUALAUTH_AGENT_DOWNLOAD_FAILED: ${agentResult.error ?? "unknown error"}`
        };
      }
      serverResult = {
        success: true,
        alreadyPatched: true,
        patchCount: 0,
        agentPath: agentResult.agentPath
      };
    }

    const patchCount =
      (clientResult.patchCount || 0) + (serverResult?.patchCount || 0);
    const alreadyPatched =
      clientResult.alreadyPatched && (serverResult?.alreadyPatched ?? true);
    const success = clientResult.success || (serverResult?.success ?? false);

    return {
      success,
      alreadyPatched,
      patchCount,
      error: clientResult.error ?? serverResult?.error,
      warning: clientResult.warning ?? serverResult?.warning,
      agentPath: serverResult?.agentPath
    };
  }
}
