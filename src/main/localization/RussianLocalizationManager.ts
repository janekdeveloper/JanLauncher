import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import AdmZip from "adm-zip";
import { Logger } from "../core/Logger";
import { VersionStorage } from "../versioning/VersionStorage";
import type { GameVersionBranch } from "../../shared/types";

const LANGUAGE_PACK_URL =
  "https://raw.githubusercontent.com/janekdeveloper/JanLauncher/refs/heads/game_translation/rus/ru-RU.zip";
const FONTS_URL =
  "https://raw.githubusercontent.com/janekdeveloper/JanLauncher/refs/heads/game_translation/rus/fonts_rus.zip";

/**
 * Manages Russian localization for the game.
 * Handles downloading and applying language packs and fonts.
 */
export class RussianLocalizationManager {
  /**
   * Applies Russian localization to a specific game version.
   * Downloads and extracts language pack and fonts if needed.
   * 
   * @param branch - Game version branch
   * @param versionId - Game version ID
   */
  static async applyRussianLocalization(
    branch: GameVersionBranch,
    versionId: string
  ): Promise<void> {
    const versionDir = VersionStorage.getVersionDir(branch, versionId);
    
    if (!fs.existsSync(versionDir)) {
      throw new Error(`Game version directory not found: ${versionDir}`);
    }

    Logger.info(
      "RussianLocalizationManager",
      `Applying Russian localization to ${branch}/${versionId}`
    );

    try {
      await this.applyLanguagePack(versionDir);
      await this.applyFonts(versionDir);
      Logger.info(
        "RussianLocalizationManager",
        `Russian localization applied successfully to ${branch}/${versionId}`
      );
    } catch (error) {
      Logger.error(
        "RussianLocalizationManager",
        `Failed to apply Russian localization: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error
      );
      throw error;
    }
  }

  /**
   * Downloads and applies the Russian language pack.
   */
  private static async applyLanguagePack(versionDir: string): Promise<void> {
    const languageDir = path.join(
      versionDir,
      "Client",
      "Data",
      "Shared",
      "Language"
    );

    Logger.info("RussianLocalizationManager", "Downloading language pack...");
    const zipPath = await this.downloadFile(LANGUAGE_PACK_URL, "ru-RU.zip");

    try {
      Logger.info("RussianLocalizationManager", "Extracting language pack...");
      const extractDir = path.join(path.dirname(zipPath), "ru-RU_extract");
      fs.mkdirSync(extractDir, { recursive: true });

      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();

      let ruRUFolderFound = false;

      for (const entry of entries) {
        const entryPath = entry.entryName;
        this.assertSafeArchivePath(extractDir, entryPath);

        const targetPath = path.join(extractDir, entryPath);
        if (entry.isDirectory) {
          fs.mkdirSync(targetPath, { recursive: true });
          if (entryPath === "ru-RU" || entryPath === "ru-RU/") {
            ruRUFolderFound = true;
          }
        } else {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, entry.getData());
        }
      }

      if (!ruRUFolderFound) {
        throw new Error("ru-RU folder not found in language pack archive");
      }

      const ruRUSource = path.join(extractDir, "ru-RU");
      if (!fs.existsSync(ruRUSource)) {
        throw new Error("ru-RU folder not found after extraction");
      }

      fs.mkdirSync(languageDir, { recursive: true });

      const ruRUTarget = path.join(languageDir, "ru-RU");
      if (fs.existsSync(ruRUTarget)) {
        Logger.info("RussianLocalizationManager", "Removing existing ru-RU folder...");
        fs.rmSync(ruRUTarget, { recursive: true, force: true });
      }

      Logger.info("RussianLocalizationManager", "Copying ru-RU folder...");
      fs.cpSync(ruRUSource, ruRUTarget, { recursive: true });

      fs.rmSync(extractDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);

      Logger.info("RussianLocalizationManager", "Language pack applied successfully");
    } catch (error) {
      if (fs.existsSync(zipPath)) {
        try {
          fs.unlinkSync(zipPath);
        } catch {
        }
      }
      throw error;
    }
  }

  /**
   * Downloads and applies Russian fonts.
   */
  private static async applyFonts(versionDir: string): Promise<void> {
    const fontsDir = path.join(
      versionDir,
      "Client",
      "Data",
      "Shared",
      "Fonts"
    );

    Logger.info("RussianLocalizationManager", "Downloading fonts...");
    const zipPath = await this.downloadFile(FONTS_URL, "fonts_rus.zip");

    try {
      Logger.info("RussianLocalizationManager", "Extracting fonts...");
      const extractDir = path.join(path.dirname(zipPath), "fonts_rus_extract");
      fs.mkdirSync(extractDir, { recursive: true });

      const zip = new AdmZip(zipPath);
      const entries = zip.getEntries();

      const requiredFiles = ["Lexend-Bold.json", "Lexend-Bold.png"];
      const foundFiles = new Set<string>();

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        const entryPath = entry.entryName;
        const fileName = path.basename(entryPath);
        
        if (requiredFiles.includes(fileName)) {
          this.assertSafeArchivePath(extractDir, entryPath);
          const targetPath = path.join(extractDir, fileName);
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, entry.getData());
          foundFiles.add(fileName);
        }
      }

      if (foundFiles.size !== requiredFiles.length) {
        const missing = requiredFiles.filter((f) => !foundFiles.has(f));
        throw new Error(`Required font files not found in archive: ${missing.join(", ")}`);
      }

      fs.mkdirSync(fontsDir, { recursive: true });

      for (const fileName of requiredFiles) {
        const sourcePath = path.join(extractDir, fileName);
        const targetPath = path.join(fontsDir, fileName);
        
        Logger.info("RussianLocalizationManager", `Copying ${fileName}...`);
        fs.copyFileSync(sourcePath, targetPath);
      }

      fs.rmSync(extractDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);

      Logger.info("RussianLocalizationManager", "Fonts applied successfully");
    } catch (error) {
      if (fs.existsSync(zipPath)) {
        try {
          fs.unlinkSync(zipPath);
        } catch {
        }
      }
      throw error;
    }
  }

  /**
   * Downloads a file from a URL to the cache directory.
   */
  private static async downloadFile(url: string, fileName: string): Promise<string> {
    const cacheDir = VersionStorage.getCacheDir();
    const filePath = path.join(cacheDir, `russian_localization_${fileName}`);

    if (fs.existsSync(filePath)) {
      Logger.debug("RussianLocalizationManager", `Using cached file: ${filePath}`);
      return filePath;
    }

    Logger.info("RussianLocalizationManager", `Downloading ${url}...`);

    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 5 * 60 * 1000,
      headers: {
        "User-Agent": "JanLauncher-RussianLocalizationManager"
      }
    });

    fs.mkdirSync(cacheDir, { recursive: true });
    const writer = fs.createWriteStream(filePath);

    await new Promise<void>((resolve, reject) => {
      response.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    Logger.info("RussianLocalizationManager", `Downloaded to ${filePath}`);
    return filePath;
  }

  /**
   * Validates that an archive entry path is safe (no path traversal).
   */
  private static assertSafeArchivePath(baseDir: string, entryPath: string): void {
    const resolvedPath = path.resolve(baseDir, entryPath);
    const resolvedBase = path.resolve(baseDir);
    
    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error(`Unsafe archive path detected: ${entryPath}`);
    }
  }
}
