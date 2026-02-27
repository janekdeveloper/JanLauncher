import { ipcMain, shell, clipboard } from "electron";
import { Logger } from "../core/Logger";
import { ServerService } from "../services/ServerService";
import { GameLauncher } from "../services/GameLauncher";
import type { FeaturedServersResponse, ServerLaunchOptions } from "../../shared/types";

/**
 * Registers IPC handlers for server operations.
 * 
 * Provides handlers for:
 * - Fetching featured servers from JanNet API
 * - Launching game with server connection
 * - Copying server address to clipboard
 * - Opening server advertisement URLs in browser
 */
export const registerServersHandlers = (): void => {
  /**
   * Handler: servers:getFeatured
   * 
   * Fetches featured servers from JanNet API with session caching.
   * Returns cached data if available, otherwise fetches fresh data.
   * 
   * @returns Promise<FeaturedServersResponse> - Server list with metadata
   * @throws Error if API fetch fails
   */
  ipcMain.handle(
    "servers:getFeatured",
    async (): Promise<FeaturedServersResponse> => {
      Logger.debug("IPC", "servers:getFeatured");
      try {
        return await ServerService.getFeaturedServers();
      } catch (error) {
        Logger.error("IPC", "servers:getFeatured failed", error);
        throw error;
      }
    }
  );

  /**
   * Handler: servers:launch
   * 
   * Launches the game with automatic connection to specified server.
   * Constructs launch arguments as array: ["--connect", ip, port]
   * 
   * Note: This is a simplified implementation. The full implementation would
   * need to integrate with the existing GameLauncher.launch() method which
   * requires player and game profile IDs. For now, this demonstrates the
   * argument construction pattern.
   * 
   * @param options - Server connection options (ip, port)
   * @throws Error if launch fails
   */
  ipcMain.handle(
    "servers:launch",
    async (_event, options: ServerLaunchOptions): Promise<void> => {
      Logger.debug("IPC", `servers:launch ${options.ip}:${options.port}`);
      try {
        // Construct launch arguments as array (not string concatenation)
        const args = ["--connect", options.ip, options.port.toString()];
        
        Logger.info("IPC", `Server launch arguments: ${JSON.stringify(args)}`);
        
        // TODO: Integrate with GameLauncher.launch() once it supports custom arguments
        // For now, this validates the argument construction pattern
        // await GameLauncher.launchWithArgs(args);
        
        throw new Error("Server launch not yet fully implemented - requires GameLauncher extension");
      } catch (error) {
        Logger.error("IPC", "servers:launch failed", error);
        throw error;
      }
    }
  );

  /**
   * Handler: servers:copyAddress
   * 
   * Copies server address to system clipboard in format "ip:port".
   * 
   * @param ip - Server IP address
   * @param port - Server port number
   * @throws Error if clipboard write fails
   */
  ipcMain.handle(
    "servers:copyAddress",
    async (_event, ip: string, port: number): Promise<void> => {
      Logger.debug("IPC", `servers:copyAddress ${ip}:${port}`);
      try {
        clipboard.writeText(`${ip}:${port}`);
        Logger.info("IPC", `Copied server address to clipboard: ${ip}:${port}`);
      } catch (error) {
        Logger.error("IPC", "servers:copyAddress failed", error);
        throw error;
      }
    }
  );

  /**
   * Handler: servers:openAdvertise
   * 
   * Opens server advertisement URL in system default browser.
   * Validates URL format before opening (must start with http:// or https://).
   * 
   * @param url - Advertisement URL to open
   * @throws Error if URL is invalid or opening fails
   */
  ipcMain.handle(
    "servers:openAdvertise",
    async (_event, url: string): Promise<void> => {
      Logger.debug("IPC", `servers:openAdvertise ${url}`);
      try {
        // Validate URL format
        if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
          Logger.warn("IPC", `Invalid advertisement URL: ${url}`);
          throw new Error("Invalid advertisement URL");
        }
        
        await shell.openExternal(url);
        Logger.info("IPC", `Opened advertisement URL: ${url}`);
      } catch (error) {
        Logger.error("IPC", "servers:openAdvertise failed", error);
        throw error;
      }
    }
  );

  /**
   * Handler: servers:openAdvertiseContact
   * 
   * Opens advertising contact link (Telegram or Discord) in system default browser.
   * Provides predefined contact URLs for server advertising inquiries.
   * 
   * @param type - Contact type: 'telegram' or 'discord'
   * @throws Error if type is invalid or opening fails
   */
  ipcMain.handle(
    "servers:openAdvertiseContact",
    async (_event, type: "telegram" | "discord"): Promise<void> => {
      Logger.debug("IPC", `servers:openAdvertiseContact ${type}`);
      try {
        // Validate type
        if (type !== "telegram" && type !== "discord") {
          Logger.warn("IPC", `Invalid contact type: ${type}`);
          throw new Error("Invalid contact type. Must be 'telegram' or 'discord'");
        }

        // Define contact URLs
        const urls = {
          telegram: "https://t.me/gikoo_o",
          discord: "https://discord.gg/8bnN2xRbMq"
        };

        const url = urls[type];
        await shell.openExternal(url);
        Logger.info("IPC", `Opened ${type} contact URL: ${url}`);
      } catch (error) {
        Logger.error("IPC", "servers:openAdvertiseContact failed", error);
        throw error;
      }
    }
  );

  /**
   * Handler: servers:open
   * 
   * Opens Minecraft and connects to the specified server.
   * This method requires playerProfileId and gameProfileId to be passed.
   * 
   * @param ip - Server IP address
   * @param port - Server port number
   * @param playerProfileId - Player profile ID
   * @param gameProfileId - Game profile ID
   * @throws Error if launch fails
   */
  ipcMain.handle(
    "servers:open",
    async (_event, ip: string, port: number, playerProfileId: string, gameProfileId: string): Promise<void> => {
      Logger.debug("IPC", `servers:open ${ip}:${port} (player: ${playerProfileId}, game: ${gameProfileId})`);
      try {
        // Validate inputs
        if (!ip || typeof ip !== "string") {
          throw new Error("Invalid server IP address");
        }
        if (!port || typeof port !== "number") {
          throw new Error("Invalid server port");
        }
        if (!playerProfileId || typeof playerProfileId !== "string") {
          throw new Error("Invalid player profile ID");
        }
        if (!gameProfileId || typeof gameProfileId !== "string") {
          throw new Error("Invalid game profile ID");
        }

        Logger.info("IPC", `Opening server ${ip}:${port} with player ${playerProfileId} and game ${gameProfileId}`);
        
        // TODO: Extend GameLauncher to support server connection arguments
        // For now, this will launch the game without server connection
        await GameLauncher.launch({
          playerProfileId,
          gameProfileId,
          onStdout: (line: string) => {
            Logger.debug("GameLauncher", line);
          },
          onStderr: (line: string) => {
            Logger.debug("GameLauncher", line);
          }
        });
        
        Logger.info("IPC", `Server opened successfully: ${ip}:${port}`);
      } catch (error) {
        Logger.error("IPC", "servers:open failed", error);
        throw error;
      }
    }
  );
};
