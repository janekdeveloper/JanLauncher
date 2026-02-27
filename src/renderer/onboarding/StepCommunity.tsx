import { useI18n } from "../i18n";
import { DiscordIcon, TelegramIcon, GitHubIcon } from "../components/icons";
import { DISCORD_INVITE_URL, TELEGRAM_URL, GITHUB_REPO_URL } from "../constants/links";
import styles from "./StepCommunity.module.css";

type StepCommunityProps = {
  onReady?: () => void;
};

const StepCommunity = (_props: StepCommunityProps) => {
  const { t } = useI18n();

  const openUrl = (url: string) => {
    window.api?.openExternal?.(url);
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>{t("onboarding.communityTitle")}</h2>
      <p className={styles.subtitle}>{t("onboarding.communitySubtitle")}</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => openUrl(DISCORD_INVITE_URL)}
        >
          <DiscordIcon className={styles.actionIcon} />
          <span>{t("onboarding.joinDiscord")}</span>
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => openUrl(TELEGRAM_URL)}
        >
          <TelegramIcon className={styles.actionIcon} />
          <span>{t("onboarding.openTelegram")}</span>
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => openUrl(GITHUB_REPO_URL)}
        >
          <GitHubIcon className={styles.actionIcon} />
          <span>{t("onboarding.starOnGitHub")}</span>
        </button>
      </div>
    </div>
  );
};

export default StepCommunity;
