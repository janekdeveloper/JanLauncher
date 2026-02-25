import { useI18n } from "../i18n";
import styles from "./StepMonitoring.module.css";

type StepMonitoringProps = {
  onReady?: () => void;
};

const StepMonitoring = (_props: StepMonitoringProps) => {
  const { t } = useI18n();

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>{t("onboarding.monitoringTitle")}</h2>
      <p className={styles.subtitle}>{t("onboarding.monitoringSubtitle")}</p>
      
      <div className={styles.features}>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>🎮</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>{t("onboarding.monitoringServers")}</h3>
            <p className={styles.featureDescription}>{t("onboarding.monitoringServersDesc")}</p>
          </div>
        </div>

        <div className={styles.feature}>
          <div className={styles.featureIcon}>🚀</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>{t("onboarding.monitoringQuickLaunch")}</h3>
            <p className={styles.featureDescription}>{t("onboarding.monitoringQuickLaunchDesc")}</p>
          </div>
        </div>

        <div className={styles.feature}>
          <div className={styles.featureIcon}>📢</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>{t("onboarding.monitoringAdvertise")}</h3>
            <p className={styles.featureDescription}>{t("onboarding.monitoringAdvertiseDesc")}</p>
          </div>
        </div>
      </div>

      <div className={styles.note}>
        <p>{t("onboarding.monitoringNote")}</p>
      </div>
    </div>
  );
};

export default StepMonitoring;
