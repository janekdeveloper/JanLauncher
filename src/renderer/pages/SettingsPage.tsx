import Button from "../components/common/Button";
import Input from "../components/common/Input";
import { useI18n, type Language } from "../i18n";
import { useDropdown } from "../hooks/useDropdown";
import { useSettingsViewModel } from "../viewmodels/useSettingsViewModel";
import { api } from "../services/api";
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
    jvmArgsString,
    updateJavaPath,
    updateMemory,
    updateJvmArgs,
    save
  } = useSettingsViewModel();
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
        <Button variant="secondary" onClick={save}>
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
              max={16384}
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
              max={16384}
              step={512}
              value={memory}
              onChange={(event) => {
                const next = Number(event.target.value);
                updateMemory(next);
              }}
            />
            <div className={styles.memoryLabels}>
              <span>2 GB</span>
              <span>16 GB</span>
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
                        setLanguage(option.value as Language);
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
