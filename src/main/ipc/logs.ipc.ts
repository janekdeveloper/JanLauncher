import { ipcMain, BrowserWindow } from "electron";
import fs from "node:fs";
import { Logger } from "../core/Logger";

const MAX_LINES = 1000;
const watchers = new Map<number, fs.FSWatcher>();

/**
 * Registers IPC handlers for log management.
 */
export const registerLogsHandlers = (): void => {
  ipcMain.handle("logs:read", async (): Promise<string[]> => {
    Logger.debug("IPC", "logs:read");
    try {
      const logFilePath = Logger.getLatestLogFile("main");
      if (!logFilePath || !fs.existsSync(logFilePath)) {
        return [];
      }

      const content = fs.readFileSync(logFilePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim().length > 0);

      return lines.slice(-MAX_LINES);
    } catch (error) {
      Logger.error("IPC", "Failed to read logs", error);
      throw error;
    }
  });

  ipcMain.handle("logs:subscribe", async (event): Promise<void> => {
    const windowId = event.sender.id;
    Logger.debug("IPC", `logs:subscribe for window ${windowId}`);

    const existingWatcher = watchers.get(windowId);
    if (existingWatcher) {
      existingWatcher.close();
      watchers.delete(windowId);
    }

    try {
      const logFilePath = Logger.getLatestLogFile("main");
      if (!logFilePath || !fs.existsSync(logFilePath)) {
        return;
      }

      const stats = fs.statSync(logFilePath);
      let lastPosition = stats.size;

      const watcher = fs.watch(logFilePath, { persistent: false }, (eventType) => {
        if (eventType !== "change") return;

        try {
          const stats = fs.statSync(logFilePath);
          if (stats.size <= lastPosition) {
            return;
          }

          const fd = fs.openSync(logFilePath, "r");
          const buffer = Buffer.alloc(stats.size - lastPosition);
          fs.readSync(fd, buffer, 0, buffer.length, lastPosition);
          fs.closeSync(fd);
          lastPosition = stats.size;

          const newContent = buffer.toString("utf-8");
          const newLines = newContent
            .split("\n")
            .filter((line) => line.trim().length > 0);

          const window = BrowserWindow.fromId(windowId);
          if (window && !window.isDestroyed()) {
            newLines.forEach((line) => {
              window.webContents.send("logs:newLine", line);
            });
          }
        } catch (error) {
          Logger.error("IPC", "Error reading new log lines", error);
        }
      });

      watchers.set(windowId, watcher);

      const window = BrowserWindow.fromId(windowId);
      if (window) {
        window.once("closed", () => {
          const watcher = watchers.get(windowId);
          if (watcher) {
            watcher.close();
            watchers.delete(windowId);
          }
        });
      }
    } catch (error) {
      Logger.error("IPC", "Failed to subscribe to logs", error);
      throw error;
    }
  });

  ipcMain.on("logs:unsubscribe", (event) => {
    const windowId = event.sender.id;
    const watcher = watchers.get(windowId);
    if (watcher) {
      watcher.close();
      watchers.delete(windowId);
      Logger.debug("IPC", `logs:unsubscribe for window ${windowId}`);
    }
  });
};
