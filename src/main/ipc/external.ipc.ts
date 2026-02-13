import { ipcMain, shell } from "electron";
import { Logger } from "../core/Logger";

const VALID_URL_PREFIXES = ["https://", "http://"];

function isValidExternalUrl(url: unknown): url is string {
  return (
    typeof url === "string" &&
    url.length > 0 &&
    VALID_URL_PREFIXES.some((prefix) => url.startsWith(prefix))
  );
}

/**
 * Registers IPC handlers for opening external URLs in the system browser.
 */
export const registerExternalHandlers = (): void => {
  ipcMain.handle("external:open", async (_event, url: string): Promise<void> => {
    if (!isValidExternalUrl(url)) {
      Logger.warn("IPC", `external:open rejected invalid URL: ${url}`);
      throw new Error("Invalid URL: must be a non-empty string starting with https:// or http://");
    }
    try {
      await shell.openExternal(url);
    } catch (error) {
      Logger.error("IPC", "external:open failed", error);
      throw error;
    }
  });
};
