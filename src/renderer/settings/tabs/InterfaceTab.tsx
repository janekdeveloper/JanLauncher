import { useI18n } from "../../i18n";
import { useSettingsContext } from "../SettingsContext";
import styles from "../settingsContent.module.css";

const InterfaceTab = () => {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettingsContext();

  if (!settings) return null;

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>{t("settings.tabs.interface")}</h2>
      <p className={styles.subtitle}>{t("settings.interfaceTabHint")}</p>

      <div className={styles.grid}>
        <div className={styles.card}>
          <p className={styles.label}>{t("settings.sidebarPositionLabel")}</p>
          <div className={styles.checkboxWrapper}>
            <label className={styles.checkboxLabel}>
              <input
                type="radio"
                name="sidebar-position"
                value="left"
                checked={(settings.sidebarPosition ?? "left") === "left"}
                onChange={() => updateSettings({ sidebarPosition: "left" })}
                className={styles.checkboxInput}
              />
              <span className={styles.checkboxControl} aria-hidden="true" />
              <span>{t("settings.sidebarPositionLeft")}</span>
            </label>
          </div>
          <div className={styles.checkboxWrapper}>
            <label className={styles.checkboxLabel}>
              <input
                type="radio"
                name="sidebar-position"
                value="top"
                checked={settings.sidebarPosition === "top"}
                onChange={() => updateSettings({ sidebarPosition: "top" })}
                className={styles.checkboxInput}
              />
              <span className={styles.checkboxControl} aria-hidden="true" />
              <span>{t("settings.sidebarPositionTop")}</span>
            </label>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.checkboxWrapper}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.showVersionBranchSelector ?? false}
                onChange={(e) => updateSettings({ showVersionBranchSelector: e.target.checked })}
                className={styles.checkboxInput}
              />
              <span className={styles.checkboxControl} aria-hidden="true" />
              <span>{t("settings.showVersionBranchSelector")}</span>
            </label>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.checkboxWrapper}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.showLogsNav ?? false}
                onChange={(e) => updateSettings({ showLogsNav: e.target.checked })}
                className={styles.checkboxInput}
              />
              <span className={styles.checkboxControl} aria-hidden="true" />
              <span>{t("settings.showLogsNav")}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterfaceTab;
