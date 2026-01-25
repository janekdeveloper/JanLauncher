import fs from "node:fs";
import path from "node:path";
import { Paths } from "./Paths";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogTarget = "main" | "renderer" | "game";

/**
 * Centralized logging service with session-based file logging.
 * 
 * Each application session creates a new log file with timestamp.
 * Logs are organized by process type (main, renderer, game).
 * Old logs are automatically cleaned up (60 days retention).
 */
export class Logger {
  private static initialized = false;
  private static sessionStartTime: Date | null = null;
  private static logFilePath: string | null = null;
  private static target: LogTarget = "main";

  /**
   * Initializes Logger with process type and creates session log file.
   * 
   * @param target - Process type: "main", "renderer", or "game"
   */
  static init(target: LogTarget = "main"): void {
    if (this.initialized) return;

    this.target = target;
    this.sessionStartTime = new Date();
    
    try {
      const logDir = this.getLogDirectory();
      const fileName = this.generateLogFileName(this.sessionStartTime);
      this.logFilePath = path.join(logDir, fileName);

      fs.mkdirSync(logDir, { recursive: true });

      if (target === "main") {
        this.cleanupOldLogs();
      }

      const sessionMarker = `[${this.formatTimestamp(this.sessionStartTime)}] [INFO] [Logger] Session started (target: ${target})\n`;
      fs.writeFileSync(this.logFilePath, sessionMarker, "utf-8");
    } catch (error) {
      this.logFilePath = null;
      this.writeToConsole(
        "error",
        `[${this.formatTimestamp(new Date())}] [ERROR] [Logger] Failed to initialize logger | ${this.serializeError(error)}`
      );
    }

    this.initialized = true;
  }

  /**
   * Gets the current log file path.
   */
  static getLogFilePath(): string {
    if (!this.logFilePath) {
      throw new Error("Logger not initialized or log file path not available");
    }
    return this.logFilePath;
  }

  /**
   * Gets the latest log file path for a specific target.
   * Useful for reading logs in IPC handlers.
   */
  static getLatestLogFile(target: LogTarget = "main"): string | null {
    try {
      const logDir = this.getLogDirectoryForTarget(target);
      if (!fs.existsSync(logDir)) {
        return null;
      }

      const files = fs.readdirSync(logDir)
        .filter((file) => file.endsWith(".log"))
        .map((file) => ({
          name: file,
          path: path.join(logDir, file),
          mtime: fs.statSync(path.join(logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      return files.length > 0 ? files[0].path : null;
    } catch {
      return null;
    }
  }

  static debug(scope: string, message: string): void {
    this.write("debug", scope, message);
  }

  static info(scope: string, message: string): void {
    this.write("info", scope, message);
  }

  static warn(scope: string, message: string): void {
    this.write("warn", scope, message);
  }

  static error(scope: string, message: string, error?: unknown): void {
    const errorDetails = error ? ` | ${this.serializeError(error)}` : "";
    this.write("error", scope, `${message}${errorDetails}`);
  }

  /**
   * Game-specific logging methods.
   * These write to the game log file while also logging to console.
   */
  static gameDebug(scope: string, message: string): void {
    this.writeToTarget("game", "debug", scope, message);
  }

  static gameInfo(scope: string, message: string): void {
    this.writeToTarget("game", "info", scope, message);
  }

  static gameWarn(scope: string, message: string): void {
    this.writeToTarget("game", "warn", scope, message);
  }

  static gameError(scope: string, message: string, error?: unknown): void {
    const errorDetails = error ? ` | ${this.serializeError(error)}` : "";
    this.writeToTarget("game", "error", scope, `${message}${errorDetails}`);
  }

  private static write(level: LogLevel, scope: string, message: string): void {
    this.writeToTarget(this.target, level, scope, message);
  }

  private static writeToTarget(
    target: LogTarget,
    level: LogLevel,
    scope: string,
    message: string
  ): void {
    const timestamp = this.formatTimestamp(new Date());
    const line = `[${timestamp}] [${level.toUpperCase()}] [${this.sanitize(
      scope
    )}] ${this.sanitize(message)}`;

    this.writeToConsole(level, line);

    let targetLogFilePath: string | null = null;

    if (target === this.target) {
      targetLogFilePath = this.logFilePath;
    } else {
      if (target === "game") {
        targetLogFilePath = this.getOrCreateGameLogFile();
      }
    }

    if (!targetLogFilePath) return;

    try {
      fs.appendFileSync(targetLogFilePath, `${line}\n`, "utf-8");
    } catch (error) {
      this.writeToConsole(
        "error",
        `[${timestamp}] [ERROR] [Logger] Failed to write log file | ${this.serializeError(
          error
        )}`
      );
    }
  }

  private static gameLogFilePath: string | null = null;

  /**
   * Gets or creates the game log file for the current session.
   * Used when main process writes game logs.
   */
  private static getOrCreateGameLogFile(): string | null {
    if (this.gameLogFilePath && fs.existsSync(this.gameLogFilePath)) {
      return this.gameLogFilePath;
    }

    try {
      const gameLogDir = Paths.logsGameDir;
      fs.mkdirSync(gameLogDir, { recursive: true });

      const sessionTime = this.sessionStartTime || new Date();
      const fileName = this.generateLogFileName(sessionTime);
      this.gameLogFilePath = path.join(gameLogDir, fileName);

      if (!fs.existsSync(this.gameLogFilePath)) {
        const sessionMarker = `[${this.formatTimestamp(sessionTime)}] [INFO] [Logger] Game session started\n`;
        fs.writeFileSync(this.gameLogFilePath, sessionMarker, "utf-8");
      }

      return this.gameLogFilePath;
    } catch (error) {
      this.writeToConsole(
        "error",
        `[${this.formatTimestamp(new Date())}] [ERROR] [Logger] Failed to create game log file | ${this.serializeError(error)}`
      );
      return null;
    }
  }

  private static writeToConsole(level: LogLevel, line: string): void {
    switch (level) {
      case "debug":
        console.debug(line);
        break;
      case "info":
        console.info(line);
        break;
      case "warn":
        console.warn(line);
        break;
      case "error":
        console.error(line);
        break;
      default:
        console.info(line);
    }
  }

  private static formatTimestamp(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private static sanitize(value: string): string {
    return value.replace(/[\r\n]+/g, " ");
  }

  private static serializeError(error: unknown): string {
    if (error instanceof Error) {
      const stack = error.stack ? ` | ${error.stack}` : "";
      return `${error.name}: ${error.message}${stack}`.replace(/[\r\n]+/g, " ");
    }
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private static getLogDirectory(): string {
    return this.getLogDirectoryForTarget(this.target);
  }

  private static getLogDirectoryForTarget(target: LogTarget): string {
    switch (target) {
      case "main":
        return Paths.logsMainDir;
      case "renderer":
        return Paths.logsRendererDir;
      case "game":
        return Paths.logsGameDir;
      default:
        return Paths.logsMainDir;
    }
  }

  private static generateLogFileName(sessionTime: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    const year = sessionTime.getFullYear();
    const month = pad(sessionTime.getMonth() + 1);
    const day = pad(sessionTime.getDate());
    const hours = pad(sessionTime.getHours());
    const minutes = pad(sessionTime.getMinutes());
    const seconds = pad(sessionTime.getSeconds());
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}.log`;
  }

  /**
   * Cleans up log files older than 60 days.
   * Only called from main process to avoid race conditions.
   */
  private static cleanupOldLogs(): void {
    const RETENTION_DAYS = 60;
    const retentionTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const targets: LogTarget[] = ["main", "renderer", "game"];
    
    for (const target of targets) {
      try {
        const logDir = this.getLogDirectoryForTarget(target);
        if (!fs.existsSync(logDir)) {
          continue;
        }

        const files = fs.readdirSync(logDir);
        let deletedCount = 0;

        for (const file of files) {
          if (!file.endsWith(".log")) {
            continue;
          }

          const filePath = path.join(logDir, file);
          try {
            const stats = fs.statSync(filePath);
            if (stats.mtime.getTime() < retentionTime) {
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          } catch (error) {
          }
        }

        if (deletedCount > 0) {
          this.writeToConsole(
            "info",
            `[${this.formatTimestamp(new Date())}] [INFO] [Logger] Cleaned up ${deletedCount} old log file(s) from ${target}/`
          );
        }
      } catch (error) {
        this.writeToConsole(
          "warn",
          `[${this.formatTimestamp(new Date())}] [WARN] [Logger] Failed to cleanup logs in ${target}/ | ${this.serializeError(error)}`
        );
      }
    }
  }
}
