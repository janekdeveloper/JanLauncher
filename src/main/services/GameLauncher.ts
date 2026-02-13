import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import { Logger } from "../core/Logger";
import { Paths } from "../core/Paths";
import { ConfigStore } from "../core/ConfigStore";
import { GameInstaller } from "./GameInstaller";
import { JavaManager } from "./JavaManager";
import { ModManager } from "./ModManager";
import { GameProfileManager } from "./GameProfileManager";
import { PlayerProfileManager } from "./PlayerProfileManager";
import { AccountValidator } from "../core/auth/AccountValidator";
import { AccountState } from "../core/auth/auth.types";
import { AuthManager } from "../core/auth/AuthManager";
import { ClientPatcher } from "./ClientPatcher";
import { DualAuthAgentManager } from "./DualAuthAgentManager";
import { buildDualAuthEnv } from "./DualAuthEnv";
import { VersionManager } from "../versioning/VersionManager";
import { VersionStorage } from "../versioning/VersionStorage";
import { UpdateService } from "../updater/UpdateService";
import { WindowManager } from "../windows/windowManager";
import { RussianLocalizationManager } from "../localization/RussianLocalizationManager";

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

    if (!GameInstaller.isGameInstalled(gameProfileId)) {
      const error = new Error("Game is not installed");
      Logger.error("GameLauncher", "Game installation check failed", error);
      throw error;
    }

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

    const activeVersion = VersionManager.resolveActiveVersion(gameProfileId);
    const gameDir = VersionStorage.getVersionDir(activeVersion.branch, activeVersion.versionId);
    const clientPath = Paths.findClientExecutable(gameDir);
    const userDataDir = Paths.getUserDataDir(gameProfileId);

    if (!clientPath) {
      const error = new Error(`Client executable not found in game directory: ${gameDir}`);
      Logger.error("GameLauncher", "Client executable check failed", error);
      throw error;
    }

    const settings = ConfigStore.getSettings();
    const shouldApplyLocalization =
      settings.launcherLanguage === "ru" && settings.enableRussianLocalization === true;

    if (shouldApplyLocalization) {
      Logger.info(
        "GameLauncher",
        "Applying Russian localization before launch..."
      );
      try {
        await RussianLocalizationManager.applyRussianLocalization(
          activeVersion.branch,
          activeVersion.versionId
        );
        Logger.info(
          "GameLauncher",
          "Russian localization applied successfully, proceeding with launch"
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.error(
          "GameLauncher",
          `Failed to apply Russian localization: ${errorMessage}`,
          error
        );
        throw new Error(
          `Не удалось применить русскую локализацию: ${errorMessage}. Запуск игры отменен.`
        );
      }
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

    if (authSession.providerId === "hytale.com") {
      try {
        const refreshed = await AuthManager.refreshSession(playerProfileId);
        if (refreshed) {
          authSession = refreshed;
          Logger.info("GameLauncher", "Refreshed Hytale game session for launch");
        }
      } catch (err) {
        Logger.warn(
          "GameLauncher",
          `Failed to refresh Hytale session before launch, using existing tokens: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const authProvider = AuthManager.getProvider(authSession.providerId);
    const authDomain = authProvider.authDomain;
    const patchResult = await ClientPatcher.ensureClientPatched(
      clientPath,
      authDomain,
      gameDir,
      activeVersion.branch
    );
    if (!patchResult.success) {
      const errorMessage = patchResult.error ?? "Client patching failed";
      Logger.error("GameLauncher", errorMessage);
      throw new Error(errorMessage);
    }

    const dualauthEnv = buildDualAuthEnv(authProvider);
    const baseEnv = { ...process.env, ...dualauthEnv };
    const launchEnv = patchResult.agentPath
      ? DualAuthAgentManager.applyJavaAgentEnv(baseEnv, patchResult.agentPath)
      : baseEnv;

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
      launchArgs,
      gameDir,
      envOverrides: launchEnv
    });

    if (!child.pid) {
      const error = new Error("Game process failed to start: no PID assigned");
      Logger.error("GameLauncher", "Game process spawn failed", error);
      throw error;
    }

    Logger.info("GameLauncher", `Game process spawned successfully with PID: ${child.pid}`);

    this.setupProcessLogging(child, onStdout, onStderr, playerProfileId);

    UpdateService.setGameRunning(true);

    child.unref();

    setTimeout(() => {
      if (child.killed || child.exitCode !== null) {
        Logger.warn("GameLauncher", "Game process exited immediately, skipping window minimization");
        return;
      }
      WindowManager.minimizeMainWindow();
    }, 500);

    Logger.info("GameLauncher", "Game process launched successfully");
  }

  /**
   * Checks for game updates and updates if a new version is available.
   * 
   * @param gameProfileId - The game profile ID to use for update
   */
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
    gameDir: string;
    envOverrides?: NodeJS.ProcessEnv;
  }): ChildProcess {
    const { javaPath, clientPath, jvmArgs, launchArgs, gameDir, envOverrides } = options;

    const spawnOptions: Parameters<typeof spawn>[2] = {
      cwd: gameDir,
      detached: true,
      stdio: "pipe",
      env: {
        ...process.env,
        ...envOverrides
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
      UpdateService.setGameRunning(false);
    });

    child.on("exit", (code, signal) => {
      UpdateService.setGameRunning(false);

      if (code !== null) {
        Logger.gameInfo("Game", `Game process exited with code: ${code}`);
      } else if (signal) {
        Logger.gameInfo("Game", `Game process exited with signal: ${signal}`);
      }

      WindowManager.restoreMainWindow();
    });
  }
}
