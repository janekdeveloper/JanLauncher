import { registerSettingsHandlers } from "./settings.ipc";
import { registerWindowHandlers } from "./window.ipc";
import { registerPlayerProfilesHandlers } from "./playerProfiles.ipc";
import { registerGameProfilesHandlers } from "./gameProfiles.ipc";
import { registerLogsHandlers } from "./logs.ipc";
import { registerGameLauncherHandlers } from "./gameLauncher.ipc";
import { registerGameInstallerHandlers } from "./gameInstaller.ipc";
import { registerModsHandlers } from "./mods.ipc";
import { registerNewsHandlers } from "./news.ipc";
import { registerAuthHandlers } from "./auth.ipc";
import { registerTranslationHandlers } from "./translation.ipc";
import { registerPathsHandlers } from "./paths.ipc";
import { registerExternalHandlers } from "./external.ipc";
import { registerAppHandlers } from "./app.ipc";
import { registerUpdateHandlers } from "../updater/updateIpc";
import { registerVersionsHandlers } from "./versions.ipc";
import { registerSystemHandlers } from "./system.ipc";
import { registerServersHandlers } from "./servers.ipc";
import { Logger } from "../core/Logger";

/**
 * Registers all IPC handlers for the application.
 */
export const registerIpcHandlers = (): void => {
  Logger.info("IPC", "Registering IPC handlers");
  registerSettingsHandlers();
  registerWindowHandlers();
  registerPlayerProfilesHandlers();
  registerGameProfilesHandlers();
  registerLogsHandlers();
  registerGameLauncherHandlers();
  registerGameInstallerHandlers();
  registerModsHandlers();
  registerNewsHandlers();
  registerAuthHandlers();
  registerTranslationHandlers();
  registerPathsHandlers();
  registerExternalHandlers();
  registerAppHandlers();
  registerVersionsHandlers();
  registerSystemHandlers();
  registerServersHandlers();
  registerUpdateHandlers();
  Logger.info("IPC", "IPC handlers registered");
};
