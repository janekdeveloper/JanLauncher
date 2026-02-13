import Button from "../components/common/Button";
import { useI18n } from "../i18n";
import styles from "./StepFinish.module.css";

type StepFinishProps = {
  onComplete: () => void;
};

const StepFinish = ({ onComplete }: StepFinishProps) => {
  const { t } = useI18n();

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>{t("onboarding.finishTitle")}</h2>
      <p className={styles.message}>{t("onboarding.finishMessage")}</p>
      <Button variant="primary" size="lg" onClick={onComplete} className={styles.startButton}>
        {t("onboarding.getStarted")}
      </Button>
    </div>
  );
};

export default StepFinish;
