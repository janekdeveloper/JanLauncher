import { useState, useCallback } from "react";
import Button from "../components/common/Button";
import StepLanguage from "./StepLanguage";
import StepAccount from "./StepAccount";
import StepGameProfile from "./StepGameProfile";
import StepCommunity from "./StepCommunity";
import StepMonitoring from "./StepMonitoring";
import StepFinish from "./StepFinish";
import { useI18n } from "../i18n";
import styles from "./OnboardingLayout.module.css";

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

type OnboardingLayoutProps = {
  onComplete: () => void;
};

const OnboardingLayout = ({ onComplete }: OnboardingLayoutProps) => {
  const { t } = useI18n();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [step1Ready, setStep1Ready] = useState(false);
  const [step2Ready, setStep2Ready] = useState(false);
  const [step3Ready, setStep3Ready] = useState(false);

  const STEPS: { step: OnboardingStep; labelKey: string }[] = [
    { step: 1, labelKey: "onboarding.stepLanguage" },
    { step: 2, labelKey: "onboarding.stepAccount" },
    { step: 3, labelKey: "onboarding.stepGameProfile" },
    { step: 4, labelKey: "onboarding.stepCommunity" },
    { step: 5, labelKey: "onboarding.stepMonitoring" },
    { step: 6, labelKey: "onboarding.stepFinish" }
  ];

  const goNext = useCallback(() => {
    if (step < 6) {
      setStep((s) => (s + 1) as OnboardingStep);
    } else {
      onComplete();
    }
  }, [step, onComplete]);

  const goBack = useCallback(() => {
    if (step > 1) {
      setStep((s) => (s - 1) as OnboardingStep);
    }
  }, [step]);

  const canGoNext =
    (step === 1 && step1Ready) ||
    (step === 2 && step2Ready) ||
    (step === 3 && step3Ready) ||
    step === 4 ||
    step === 5 ||
    step === 6;

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.stepIndicator} role="navigation" aria-label="Onboarding steps">
            {STEPS.map(({ step: s, labelKey }, index) => (
              <div
                key={s}
                className={`${styles.stepItem} ${step === s ? styles.stepItemActive : ""} ${step > s ? styles.stepItemDone : ""}`}
                aria-current={step === s ? "step" : undefined}
              >
                <span className={styles.stepNumber}>{s}</span>
                <span className={styles.stepLabel}>{t(labelKey)}</span>
                {index < STEPS.length - 1 && <span className={styles.stepLine} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className={styles.content} key={step}>
        {step === 1 && (
          <StepLanguage onReady={() => setStep1Ready(true)} />
        )}
        {step === 2 && (
          <StepAccount onReady={() => setStep2Ready(true)} />
        )}
        {step === 3 && (
          <StepGameProfile onReady={() => setStep3Ready(true)} />
        )}
        {step === 4 && (
          <StepCommunity />
        )}
        {step === 5 && (
          <StepMonitoring />
        )}
        {step === 6 && (
          <StepFinish onComplete={onComplete} />
        )}
      </main>

      <footer className={styles.footer}>
        {step > 1 && (
          <Button variant="ghost" onClick={goBack} className={styles.backButton}>
            {t("onboarding.back")}
          </Button>
        )}
        <div className={styles.footerSpacer} />
        {step < 6 && (
          <Button
            variant="primary"
            onClick={goNext}
            className={styles.nextButton}
            disabled={!canGoNext}
          >
            {t("onboarding.next")}
          </Button>
        )}
      </footer>
    </div>
  );
};

export default OnboardingLayout;
