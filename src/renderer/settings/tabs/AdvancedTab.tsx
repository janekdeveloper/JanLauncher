import Button from "../../components/common/Button";
import { useI18n } from "../../i18n";
import { api } from "../../services/api";
import styles from "../settingsContent.module.css";

const AdvancedTab = () => {
  const { t } = useI18n();

  const handleRestartOnboarding = async () => {
    try {
      await api.settings.update({ hasCompletedOnboarding: false });
      window.location.reload();
    } catch (error) {
      console.error("Failed to restart onboarding:", error);
    }
  };

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
        <div className={styles.cacheSection}>
          <div>
            <p className={styles.label}>{t("settings.restartOnboarding")}</p>
            <p className={styles.labelHint}>{t("settings.restartOnboardingHint")}</p>
          </div>
          <Button variant="secondary" onClick={handleRestartOnboarding}>
            {t("settings.restartOnboarding")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedTab;
