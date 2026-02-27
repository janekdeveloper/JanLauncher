import { Logger } from "../core/Logger";
import { getJanNetApiClient } from "../api/JanNetApiClient";
import type { FeaturedServersResponse } from "../../shared/types";

/**
 * Service for managing featured game servers with session-based caching.
 * 
 * Fetches server data from JanNet API and caches it for the application session.
 * Cache persists until application restart or manual clear.
 */
export class ServerService {
  private static cache: FeaturedServersResponse | null = null;

  /**
   * Fetches featured servers from JanNet API with cache-first logic.
   * 
   * Returns cached data if available, otherwise fetches from API and caches the result.
   * 
   * @returns Promise resolving to FeaturedServersResponse
   * @throws Error if API fetch fails
   */
  static async getFeaturedServers(): Promise<FeaturedServersResponse> {
    if (this.cache) {
      Logger.debug("ServerService", "Returning cached servers");
      return this.cache;
    }

    try {
      const client = getJanNetApiClient();
      const response = await client.getFeaturedServers();
      this.cache = response;
      Logger.info("ServerService", `Fetched ${response.servers.length} servers from API`);
      return response;
    } catch (error) {
      Logger.error("ServerService", "Failed to fetch featured servers", error);
      throw new Error("Failed to fetch featured servers");
    }
  }

  /**
   * Clears the session cache.
   * 
   * Next call to getFeaturedServers will fetch fresh data from API.
   */
  static clearCache(): void {
    this.cache = null;
    Logger.debug("ServerService", "Cache cleared");
  }
}
