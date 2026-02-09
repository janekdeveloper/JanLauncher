import { NavLink } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  HomeIcon,
  LogsIcon,
  ModsIcon,
  NewsIcon,
  SettingsIcon,
  TelegramIcon,
  DiscordIcon
} from "../../components/icons";
import { useI18n } from "../../i18n";
import { api } from "../../services/api";
import { DISCORD_INVITE_URL, TELEGRAM_URL } from "../../constants/links";
import styles from "./Sidebar.module.css";

const Sidebar = () => {
  const { t } = useI18n();
  const [tooltip, setTooltip] = useState<{
    text: string;
    top: number;
    left: number;
  } | null>(null);
  const navRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  const navItems = [
    { to: "/", label: t("nav.home"), end: true, icon: HomeIcon },
    { to: "/mods", label: t("nav.mods"), icon: ModsIcon },
    { to: "/news", label: t("nav.news"), icon: NewsIcon },
    { to: "/settings", label: t("nav.settings"), icon: SettingsIcon },
    { to: "/logs", label: t("nav.logs"), icon: LogsIcon }
  ];

  const handleMouseEnter = (item: typeof navItems[0], element: HTMLAnchorElement) => {
    const rect = element.getBoundingClientRect();
    setTooltip({
      text: item.label,
      top: rect.top + rect.height / 2,
      left: rect.right + 12
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <span className={styles.logoLetter}>J</span>
          </div>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                ref={(el) => {
                  if (el) navRefs.current.set(item.to, el);
                }}
                to={item.to}
                end={item.end}
                title={item.label}
                aria-label={item.label}
                onMouseEnter={(e) => handleMouseEnter(item, e.currentTarget)}
                onMouseLeave={handleMouseLeave}
                className={({ isActive }) =>
                  [
                    styles.navItem,
                    isActive ? styles.navItemActive : undefined
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Icon className={styles.navIcon} />
              </NavLink>
            );
          })}
        </nav>

        <div className={styles.socialButtons}>
          <button
            type="button"
            onClick={() => api.news.openUrl(TELEGRAM_URL)}
            className={styles.socialButton}
            aria-label="Telegram"
            title="Telegram"
            onMouseEnter={(e) => handleMouseEnter({ label: "Telegram" }, e.currentTarget)}
            onMouseLeave={handleMouseLeave}
          >
            <TelegramIcon className={styles.socialIcon} />
          </button>
          <button
            type="button"
            onClick={() => api.news.openUrl(DISCORD_INVITE_URL)}
            className={styles.socialButton}
            aria-label="Discord"
            title="Discord"
            onMouseEnter={(e) => handleMouseEnter({ label: "Discord" }, e.currentTarget)}
            onMouseLeave={handleMouseLeave}
          >
            <DiscordIcon className={styles.socialIcon} />
          </button>
        </div>
      </aside>
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{
            top: `${tooltip.top}px`,
            left: `${tooltip.left}px`
          }}
        >
          {tooltip.text}
        </div>
      )}
    </>
  );
};

export default Sidebar;
