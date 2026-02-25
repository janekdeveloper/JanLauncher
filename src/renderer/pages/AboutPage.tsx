import { useEffect, useState } from "react";
import AboutCard from "../components/about/AboutCard";
import {
  GitHubIcon,
  DiscordIcon,
  TelegramIcon
} from "../components/icons";
import { useI18n } from "../i18n";
import { api } from "../services/api";
import {
  GITHUB_REPO_URL,
  DISCORD_INVITE_URL,
  TELEGRAM_URL
} from "../constants/links";
import styles from "./AboutPage.module.css";

type AppInfo = { version: string; platform: string };

const PLATFORM_KEYS: Record<string, string> = {
  win32: "about.platformWindows",
  darwin: "about.platformMacOS",
  linux: "about.platformLinux"
};

const BASE_URL =
  typeof import.meta.env.BASE_URL === "string" ? import.meta.env.BASE_URL : "./";

const GITHUB_JANEKDEVELOPER = "https://github.com/janekdeveloper";
const TELEGRAM_NIKKOTIN_BEATS = "https://t.me/nikkotin_beats";

const TEAM = [
  { name: "JanDev", roleKey: "about.roleLeadDeveloper" as const, avatar: `${BASE_URL}jandev.jpg`, url: GITHUB_JANEKDEVELOPER },
  { name: "Nikkotin", roleKey: "about.roleMusicComposer" as const, avatar: `${BASE_URL}nikkotin.jpg`, url: TELEGRAM_NIKKOTIN_BEATS }
] as const;

const AboutPage = () => {
  const { t } = useI18n();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    api.app
      .getAppInfo()
      .then(setAppInfo)
      .catch(() => setAppInfo(null));
  }, []);

  const platformLabel =
    appInfo?.platform != null
      ? t(PLATFORM_KEYS[appInfo.platform] ?? "about.platformLinux")
      : "—";

  const openLink = (url: string) => {
    window.api?.openExternal(url);
  };

  return (
    <div className={styles.page}>
      <AboutCard className={styles.mainCard}>
        <header className={styles.hero}>
          <div className={styles.logoWrap} aria-hidden="true">
            <span className={styles.logoLetter}>J</span>
          </div>
          <div className={styles.heroText}>
            <h1 className={styles.title}>JanLauncher</h1>
            <div className={styles.meta}>
              {appInfo != null ? (
                <>
                  <span className={styles.version}>v{appInfo.version}</span>
                  <span className={styles.sep}>·</span>
                  <span className={styles.platform}>{platformLabel}</span>
                  <span className={styles.sep}>·</span>
                  <span className={styles.status}>{t("about.statusActive")}</span>
                </>
              ) : (
                <span className={styles.version}>—</span>
              )}
            </div>
            <p className={styles.tagline}>{t("about.tagline")}</p>
          </div>
        </header>

        <hr className={styles.divider} />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("about.sectionTeam")}</h2>
          <div className={styles.teamGrid}>
            {TEAM.map((member) => {
              const { name, roleKey, avatar } = member;
              const url = "url" in member ? member.url : undefined;
              const content = (
                <>
                  <img
                    src={avatar}
                    alt=""
                    className={styles.teamAvatar}
                  />
                  <div className={styles.teamInfo}>
                    <span className={styles.teamName}>{name}</span>
                    <span className={styles.teamRole}>{t(roleKey)}</span>
                  </div>
                </>
              );
              if (url) {
                return (
                  <button
                    key={name}
                    type="button"
                    className={styles.teamCard}
                    onClick={() => openLink(url)}
                    aria-label={url.startsWith("https://t.me/") ? `${name} — Telegram` : `${name} — GitHub`}
                  >
                    {content}
                  </button>
                );
              }
              return (
                <div key={name} className={styles.teamCard}>
                  {content}
                </div>
              );
            })}
          </div>
        </section>

        <hr className={styles.divider} />

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("about.sectionLinks")}</h2>
          <div className={styles.links}>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => openLink(GITHUB_REPO_URL)}
              aria-label="GitHub"
            >
              <GitHubIcon className={styles.linkIcon} />
              <span>GitHub</span>
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => openLink(DISCORD_INVITE_URL)}
              aria-label="Discord"
            >
              <DiscordIcon className={styles.linkIcon} />
              <span>Discord</span>
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => openLink(TELEGRAM_URL)}
              aria-label="Telegram"
            >
              <TelegramIcon className={styles.linkIcon} />
              <span>Telegram</span>
            </button>
          </div>
        </section>
      </AboutCard>
    </div>
  );
};

export default AboutPage;
