import Button from "../../components/common/Button";
import { useI18n } from "../../i18n";
import { api } from "../../services/api";
import styles from "../settingsContent.module.css";

const AdvancedTab = () => {
  const { t } = useI18n();

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>{t("settings.tabs.advanced")}</h2>
      <p className={styles.subtitle}>{t("settings.advancedTabHint")}</p>
      <div className={styles.card}>
        <div className={styles.cacheSection}>
          <div>
            <p className={styles.label}>{t("settings.clearCache")}</p>
          </div>
          <Button variant="secondary" onClick={() => api.translation.clearCache()}>
            {t("settings.clearCache")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedTab;
