import { useI18n, type Language } from "../i18n";
import { api } from "../services/api";
import styles from "./StepLanguage.module.css";

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "uk", label: "Українська" },
  { value: "pl", label: "Polski" },
  { value: "be", label: "Беларуская" },
  { value: "es", label: "Español" }
];

type StepLanguageProps = {
  onReady: () => void;
};

const StepLanguage = ({ onReady }: StepLanguageProps) => {
  const { t, setLanguage } = useI18n();

  const handleSelect = (value: Language) => {
    setLanguage(value);
    api.settings.update({ launcherLanguage: value }).then(() => onReady());
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>{t("onboarding.languageTitle")}</h2>
      <p className={styles.subtitle}>{t("onboarding.languageSubtitle")}</p>
      <div className={styles.grid}>
        {LANGUAGE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={styles.option}
            onClick={() => handleSelect(value)}
          >
            <span className={styles.optionLabel}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StepLanguage;
