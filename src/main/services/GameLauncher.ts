import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";
import { GameInstaller } from "./GameInstaller";
import { JavaManager } from "./JavaManager";
import { ModManager } from "./ModManager";
import { GameProfileManager } from "./GameProfileManager";
import { PlayerProfileManager } from "./PlayerProfileManager";
import { AuthManager } from "../core/auth/AuthManager";
import { AccountValidator } from "../core/auth/AccountValidator";
import { AccountState } from "../core/auth/auth.types";
import { ClientPatcher } from "./ClientPatcher";
import { VersionManager } from "./VersionManager";
import { UpdateService } from "../updater/UpdateService";

export type LaunchOptions = {
  playerProfileId: string;
  gameProfileId: string;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
};

/**
 * Handles game launch process including validation, Java setup, mod syncing, and process spawning.
 */
export class GameLauncher {
  /**
   * Launches the game with specified player and game profiles.
   * Automatically checks for updates and updates if needed.
   * 
   * @param options - Launch options including profile IDs and output handlers
   */
  static async launch(options: LaunchOptions): Promise<void> {
    const { playerProfileId, gameProfileId, onStdout, onStderr } = options;

    Logger.info("GameLauncher", `Starting game launch (player: ${playerProfileId}, game: ${gameProfileId})`);

    if (!GameInstaller.isGameInstalled()) {
      const error = new Error("Game is not installed");
      Logger.error("GameLauncher", "Game installation check failed", error);
      throw error;
    }

    await this.checkAndUpdateGame(gameProfileId);

    const playerProfileManager = new PlayerProfileManager();
    const gameProfileManager = new GameProfileManager();

    let playerProfile;
    let gameProfile;

    try {
      playerProfile = playerProfileManager.getProfile(playerProfileId);
      gameProfile = gameProfileManager.getProfile(gameProfileId);
    } catch (error) {
      Logger.error("GameLauncher", "Failed to load profiles", error);
      throw error;
    }

    Logger.info("GameLauncher", `Loaded profiles: player="${playerProfile.nickname}", game="${gameProfile.name}"`);

    let javaPath: string;
    try {
      javaPath = await JavaManager.ensureJava();
      Logger.info("GameLauncher", `Java resolved: ${javaPath}`);
    } catch (error) {
      Logger.error("GameLauncher", "Failed to ensure Java", error);
      throw error;
    }

    try {
      await ModManager.syncMods(gameProfileId);
      Logger.info("GameLauncher", "Mods synchronized");
    } catch (error) {
      Logger.error("GameLauncher", "Failed to sync mods (continuing anyway)", error);
    }

    const gameDir = Paths.getGameDir();
    const clientPath = Paths.findClientExecutable(gameDir);
    const userDataDir = Paths.getUserDataDir(gameProfileId);

    if (!clientPath) {
      const error = new Error(`Client executable not found in game directory: ${gameDir}`);
      Logger.error("GameLauncher", "Client executable check failed", error);
      throw error;
    }

    try {
      fs.mkdirSync(userDataDir, { recursive: true });
    } catch (error) {
      Logger.error("GameLauncher", `Failed to create UserData directory: ${userDataDir}`, error);
    }

    Logger.info("GameLauncher", `Game directory: ${gameDir}`);
    Logger.info("GameLauncher", `Client executable: ${clientPath}`);
    Logger.info("GameLauncher", `UserData directory: ${userDataDir}`);

    const uuid = playerProfile.id;
    const playerName = playerProfile.nickname;

    let authSession;
    try {
      const validation = await AccountValidator.validateAccount(playerProfileId);
      
      if (!validation.canLaunch || !validation.session) {
        throw new Error(
          `Account validation failed: ${validation.reason}${validation.error ? ` - ${validation.error}` : ""}`
        );
      }

      authSession = validation.session;
      Logger.info("GameLauncher", `Account validated, state: ${validation.state}`);
    } catch (error) {
      throw new Error(
        `Failed to authenticate account: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const authDomain = authSession.providerId;
    const patchResult = await ClientPatcher.ensureClientPatched(
      clientPath,
      authDomain,
      gameDir
    );
    if (!patchResult.success) {
      Logger.warn(
        "GameLauncher",
        `Client patching failed: ${patchResult.error ?? "unknown error"}`
      );
    }

    const jvmArgs = this.buildJvmArgs(gameProfile.gameOptions);
    const launchArgs = [
      "--app-dir",
      gameDir,
      "--java-exec",
      javaPath,
      "--auth-mode",
      "authenticated",
      "--uuid",
      authSession.uuid,
      "--name",
      authSession.username,
      "--identity-token",
      authSession.identityToken,
      "--session-token",
      authSession.sessionToken,
      "--user-dir",
      userDataDir
    ];

    Logger.debug("GameLauncher", `JVM arguments: ${jvmArgs.join(" ")}`);

    const child = this.spawnGameProcess({
      javaPath,
      clientPath,
      jvmArgs,
      userDataDir,
      launchArgs
    });

    this.setupProcessLogging(child, onStdout, onStderr, playerProfileId);

    UpdateService.setGameRunning(true);

    child.unref();

    Logger.info("GameLauncher", "Game process launched successfully");
  }

  /**
   * Checks for game updates and updates if a new version is available.
   * 
   * @param gameProfileId - The game profile ID to use for update
   */
  private static async checkAndUpdateGame(gameProfileId: string): Promise<void> {
    try {
      Logger.info("GameLauncher", "Checking for game updates...");
      const updateInfo = await VersionManager.checkForUpdate();

      if (updateInfo.needsUpdate) {
        Logger.info(
          "GameLauncher",
          `Update available: ${updateInfo.installedVersion} -> ${updateInfo.latestVersion}, starting update...`
        );

        await GameInstaller.updateGame({
          profileId: gameProfileId,
          onProgress: (progress) => {
            Logger.info("GameLauncher", `Update progress: ${progress.message}${progress.percent ? ` (${progress.percent}%)` : ""}`);
          }
        });

        Logger.info("GameLauncher", "Game update completed successfully");
      } else {
        Logger.info("GameLauncher", "Game is up to date");
      }
    } catch (error) {
      Logger.error("GameLauncher", "Failed to check/update game", error);
      Logger.warn("GameLauncher", "Continuing with launch despite update check failure");
    }
  }

  private static buildJvmArgs(gameOptions: { minMemory: number; maxMemory: number; args: string[] }): string[] {
    const args: string[] = [];

    if (gameOptions.minMemory > 0) {
      args.push(`-Xms${gameOptions.minMemory}M`);
    }
    if (gameOptions.maxMemory > 0) {
      args.push(`-Xmx${gameOptions.maxMemory}M`);
    }

    if (gameOptions.args && gameOptions.args.length > 0) {
      args.push(...gameOptions.args);
    }

    return args;
  }

  private static spawnGameProcess(options: {
    javaPath: string;
    clientPath: string;
    jvmArgs: string[];
    userDataDir: string;
    launchArgs: string[];
  }): ChildProcess {
    const { javaPath, clientPath, jvmArgs, launchArgs } = options;

    const spawnOptions: Parameters<typeof spawn>[2] = {
      cwd: Paths.getGameDir(),
      detached: true,
      stdio: "pipe",
      env: {
        ...process.env
      }
    };

    if (process.platform === "win32") {
      spawnOptions.windowsHide = true;
    }

    const isNativeExecutable = !clientPath.endsWith(".jar");

    if (isNativeExecutable) {
      Logger.debug("GameLauncher", "Spawning native executable");
      return spawn(clientPath, launchArgs, spawnOptions);
    } else {
      Logger.debug("GameLauncher", "Spawning Java process");
      const allArgs = [...jvmArgs, "-jar", clientPath, ...launchArgs];
      return spawn(javaPath, allArgs, spawnOptions);
    }
  }

  private static setupProcessLogging(
    child: ChildProcess,
    onStdout?: (line: string) => void,
    onStderr?: (line: string) => void,
    playerProfileId?: string
  ): void {
    if (child.stdout) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        const lines = chunk.split(/\r?\n/).filter((line) => line.trim());
        for (const line of lines) {
          Logger.gameInfo("Game", `[stdout] ${line}`);
          onStdout?.(line);
        }
      });
    }

    if (child.stderr) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", async (chunk: string) => {
        const lines = chunk.split(/\r?\n/).filter((line) => line.trim());
        for (const line of lines) {
          Logger.gameError("Game", `[stderr] ${line}`);
          onStderr?.(line);

          if (
            (line.includes("Authentication") || line.includes("authentication") || 
             line.includes("credentials required") || line.includes("invalid token") ||
             line.includes("token expired") || line.includes("unauthorized") ||
             line.includes("username mismatch") || line.includes("Token validation failed")) &&
            playerProfileId
          ) {
            Logger.warn(
              "GameLauncher",
              "Authentication error detected, handling through AccountValidator"
            );
            try {
              const result = await AccountValidator.handleAuthError(playerProfileId, line);
              if (result.state === AccountState.VALID || result.canLaunch) {
                Logger.info("GameLauncher", "Auth error resolved, account is valid");
              } else {
                Logger.warn(
                  "GameLauncher",
                  `Auth error could not be resolved: ${result.reason}, canLaunch: ${result.canLaunch}`
                );
              }
            } catch (error) {
              Logger.warn(
                "GameLauncher",
                `Failed to handle auth error: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          }
        }
      });
    }

    child.on("error", (error) => {
      Logger.error("GameLauncher", "Game process error", error);
    });

    child.on("exit", (code, signal) => {
      UpdateService.setGameRunning(false);

      if (code !== null) {
        Logger.gameInfo("Game", `Game process exited with code: ${code}`);
      } else if (signal) {
        Logger.gameInfo("Game", `Game process exited with signal: ${signal}`);
      }
    });
  }
}
