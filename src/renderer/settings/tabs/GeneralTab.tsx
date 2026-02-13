import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import Button from "../../components/common/Button";
import { useI18n, type Language } from "../../i18n";
import { useDropdown } from "../../hooks/useDropdown";
import { useSettingsContext } from "../SettingsContext";
import { api } from "../../services/api";
import { FolderIcon } from "../../components/icons";
import styles from "../settingsContent.module.css";

const LANGUAGE_OPTIONS = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "uk", label: "Українська" },
  { value: "pl", label: "Polski" },
  { value: "be", label: "Беларуская" },
  { value: "es", label: "Español" }
] as const;

const GeneralTab = () => {
  const { t, language, setLanguage } = useI18n();
  const { settings, gameProfiles, updateSettings } = useSettingsContext();
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const { ref: languageRef, isOpen: isLanguageOpen, toggle: toggleLanguage, close: closeLanguage } = useDropdown([languageMenuRef]);
  const [languageMenuStyle, setLanguageMenuStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!isLanguageOpen) {
      setLanguageMenuStyle(null);
      return;
    }
    const updatePosition = () => {
      if (!languageRef.current) return;
      const rect = languageRef.current.getBoundingClientRect();
      setLanguageMenuStyle({
        position: "fixed",
        top: rect.bottom + 10,
        left: rect.left,
        width: rect.width,
        right: "auto",
        zIndex: 1000
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isLanguageOpen, languageRef]);

  if (!settings) return null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t("settings.title")}</h2>
          <p className={styles.subtitle}>{t("settings.subtitle")}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() =>
            updateSettings({
              ...settings,
              launcherLanguage: language
            })
          }
        >
          {t("settings.save")}
        </Button>
      </div>

      <div className={styles.grid}>
        <div className={`${styles.card} ${isLanguageOpen ? styles.cardRaised : ""}`}>
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
                  {LANGUAGE_OPTIONS.find((o) => o.value === language)?.label}
                </span>
                <span
                  className={`${styles.languageChevron} ${isLanguageOpen ? styles.languageChevronOpen : ""}`}
                  aria-hidden="true"
                />
              </button>
              {isLanguageOpen && languageMenuStyle
                ? createPortal(
                    <div
                      className={styles.languageMenu}
                      role="listbox"
                      ref={languageMenuRef}
                      style={languageMenuStyle}
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`${styles.languageOption} ${option.value === language ? styles.languageOptionActive : ""}`}
                          onClick={() => {
                            setLanguage(option.value as Language);
                            updateSettings({
                              launcherLanguage: option.value,
                              enableRussianLocalization: option.value === "ru"
                            });
                            closeLanguage();
                          }}
                        >
                          <span className={styles.languageOptionLabel}>{option.label}</span>
                          <span className={styles.languageOptionCode}>{option.value.toUpperCase()}</span>
                        </button>
                      ))}
                    </div>,
                    document.body
                  )
                : null}
            </div>
          </div>
          {language === "ru" && (
            <div className={styles.checkboxWrapper}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={settings.enableRussianLocalization ?? false}
                  onChange={(e) => updateSettings({ enableRussianLocalization: e.target.checked })}
                  className={styles.checkboxInput}
                />
                <span className={styles.checkboxControl} aria-hidden="true" />
                <span>{t("settings.enableRussianLocalization")}</span>
              </label>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <p className={styles.label}>{t("settings.foldersTitle")}</p>
          <div className={styles.foldersGrid}>
            <button
              type="button"
              className={styles.folderButton}
              onClick={() => api.paths.openConfigDir()}
            >
              <FolderIcon className={styles.folderIcon} />
              <span className={styles.folderButtonText}>{t("settings.openConfigDir")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralTab;
