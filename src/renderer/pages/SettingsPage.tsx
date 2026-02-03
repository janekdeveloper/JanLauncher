import Button from "../components/common/Button";
import Input from "../components/common/Input";
import { useI18n, type Language } from "../i18n";
import { useDropdown } from "../hooks/useDropdown";
import { useSettingsViewModel } from "../viewmodels/useSettingsViewModel";
import { api } from "../services/api";
import { FolderIcon } from "../components/icons";
import { useLauncherStore } from "../store/launcherStore";
import styles from "./SettingsPage.module.css";

const SettingsPage = () => {
  const { t, language, setLanguage } = useI18n();
  const {
    ref: languageRef,
    isOpen: isLanguageOpen,
    toggle: toggleLanguage,
    close: closeLanguage
  } = useDropdown();
  const {
    settings,
    memory,
    memoryLimit,
    jvmArgsString,
    updateJavaPath,
    updateMemory,
    updateJvmArgs,
    updateRussianLocalization,
    updateLauncherLanguage,
    save
  } = useSettingsViewModel();
  const { selectedGameId } = useLauncherStore();
  const languageOptions = [
    { value: "ru", label: "Русский" },
    { value: "en", label: "English" },
    { value: "uk", label: "Українська" },
    { value: "pl", label: "Polski" },
    { value: "be", label: "Беларуская" }
  ] as const;

  if (!settings) {
    return (
      <section className={styles.page}>
        <div className={styles.loading}>{t("settings.loading")}</div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t("settings.title")}</h2>
          <p className={styles.subtitle}>{t("settings.subtitle")}</p>
        </div>
        <Button variant="secondary" onClick={() => save(language)}>
          {t("settings.save")}
        </Button>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <Input
            label={t("settings.javaPathLabel")}
            value={settings.javaPath || ""}
            onChange={(event) => updateJavaPath(event.target.value)}
            placeholder={t("settings.javaPathPlaceholder")}
          />
          <div className={styles.foldersSection}>
            <p className={styles.label}>{t("settings.foldersTitle")}</p>
            <div className={styles.foldersGrid}>
              <button
                type="button"
                className={styles.folderButton}
                onClick={() => api.paths.openGameDir()}
              >
                <FolderIcon className={styles.folderIcon} />
                <span className={styles.folderButtonText}>
                  {t("settings.openGameDir")}
                </span>
              </button>
              <button
                type="button"
                className={styles.folderButton}
                onClick={() => api.paths.openConfigDir()}
              >
                <FolderIcon className={styles.folderIcon} />
                <span className={styles.folderButtonText}>
                  {t("settings.openConfigDir")}
                </span>
              </button>
              <button
                type="button"
                className={styles.folderButton}
                onClick={() => {
                  if (selectedGameId) {
                    api.paths.openUserDataDir(selectedGameId);
                  }
                }}
                disabled={!selectedGameId}
              >
                <FolderIcon className={styles.folderIcon} />
                <span className={styles.folderButtonText}>
                  {t("settings.openUserDataDir")}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.memoryHeader}>
            <div className={styles.memoryInfo}>
              <p className={styles.label}>{t("settings.memoryLabel")}</p>
              <p className={styles.memoryValue}>
                {Math.round(memory / 1024)}
                <span className={styles.memoryUnit}>GB</span>
              </p>
            </div>
            <Input
              type="number"
              min={2048}
              max={memoryLimit}
              step={512}
              value={memory}
              onChange={(event) => {
                const next = Number(event.target.value) || 0;
                updateMemory(next);
              }}
              className={styles.memoryInput}
            />
          </div>
          <div className={styles.memorySliderWrapper}>
            <input
              className={styles.range}
              type="range"
              min={2048}
              max={memoryLimit}
              step={512}
              value={memory}
              onChange={(event) => {
                const next = Number(event.target.value);
                updateMemory(next);
              }}
            />
            <div className={styles.memoryLabels}>
              <span>2 GB</span>
              <span>{Math.round(memoryLimit / 1024)} GB</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <Input
            label={t("settings.jvmArgsLabel")}
            multiline
            rows={4}
            value={jvmArgsString}
            onChange={(event) => updateJvmArgs(event.target.value)}
            placeholder="-Xmx4G -Dfile.encoding=UTF-8"
          />
        </div>

        <div className={styles.card}>
          <div className={styles.languageHeader}>
            <div>
              <p className={styles.label}>{t("settings.languageLabel")}</p>
              <p className={styles.languageHint}>{t("settings.languageHint")}</p>
            </div>
            <div className={styles.languagePicker} ref={languageRef}>
              <button
                type="button"
                className={styles.languageButton}
                onClick={toggleLanguage}
                aria-expanded={isLanguageOpen}
              >
                <span className={styles.languageButtonText}>
                  {
                    languageOptions.find((option) => option.value === language)
                      ?.label
                  }
                </span>
                <span
                  className={`${styles.languageChevron} ${
                    isLanguageOpen ? styles.languageChevronOpen : ""
                  }`}
                  aria-hidden="true"
                />
              </button>
              {isLanguageOpen ? (
                <div className={styles.languageMenu} role="listbox">
                  {languageOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.languageOption} ${
                        option.value === language
                          ? styles.languageOptionActive
                          : ""
                      }`}
                      onClick={() => {
                        const newLanguage = option.value as Language;
                        setLanguage(newLanguage);
                        updateLauncherLanguage(newLanguage);
                        if (newLanguage === "ru") {
                          updateRussianLocalization(true);
                        } else {
                          updateRussianLocalization(false);
                        }
                        closeLanguage();
                      }}
                    >
                      <span className={styles.languageOptionLabel}>
                        {option.label}
                      </span>
                      <span className={styles.languageOptionCode}>
                        {option.value.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {language === "ru" && (
            <div className={styles.checkboxWrapper}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={settings?.enableRussianLocalization ?? false}
                  onChange={(e) => {
                    updateRussianLocalization(e.target.checked);
                  }}
                  className={styles.checkbox}
                />
                <span>{t("settings.enableRussianLocalization")}</span>
              </label>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cacheSection}>
            <div>
              <p className={styles.label}>{t("settings.clearCache")}</p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                await api.translation.clearCache();
              }}
            >
              {t("settings.clearCache")}
            </Button>
          </div>
        </div>

      </div>
    </section>
  );
};

export default SettingsPage;
