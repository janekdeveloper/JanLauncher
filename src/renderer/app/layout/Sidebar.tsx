import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
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

type IndicatorRect = { top: number; left: number; width: number; height: number };

type SidebarPosition = "left" | "top";

type SidebarProps = {
  position?: SidebarPosition;
};

type TooltipPlacement = "right" | "bottom";

type TooltipState = {
  text: string;
  top: number;
  left: number;
  placement: TooltipPlacement;
};

const Sidebar = ({ position = "left" }: SidebarProps) => {
  const { t } = useI18n();
  const location = useLocation();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const navRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const navContainerRef = useRef<HTMLElement>(null);
  const [showLogsNav, setShowLogsNav] = useState(false);
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);

  useEffect(() => {
    let isMounted = true;

    api.settings
      .get()
      .then((data) => {
        if (!isMounted) return;
        setShowLogsNav(data.showLogsNav ?? false);
      })
      .catch(() => {
        if (!isMounted) return;
        setShowLogsNav(false);
      });

    const handleSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ showLogsNav?: boolean }>;
      if (
        Object.prototype.hasOwnProperty.call(
          customEvent.detail ?? {},
          "showLogsNav"
        )
      ) {
        setShowLogsNav(
          customEvent.detail?.showLogsNav === undefined
            ? true
            : Boolean(customEvent.detail.showLogsNav)
        );
      }
    };

    const unsubscribe = api.settings.onUpdated((patch) => {
      if (Object.prototype.hasOwnProperty.call(patch ?? {}, "showLogsNav")) {
        setShowLogsNav(
          (patch?.showLogsNav === undefined ? true : Boolean(patch.showLogsNav))
        );
      }
      window.dispatchEvent(
        new CustomEvent("janlauncher:settings-updated", { detail: patch })
      );
    });

    window.addEventListener(
      "janlauncher:settings-updated",
      handleSettingsUpdated
    );

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener(
        "janlauncher:settings-updated",
        handleSettingsUpdated
      );
    };
  }, []);

  const allNavItems: Array<
    | { to: string; label: string; end?: boolean; icon: typeof HomeIcon }
    | { action: "openSettings"; label: string; icon: typeof SettingsIcon }
  > = [
    { to: "/", label: t("nav.home"), end: true, icon: HomeIcon },
    { to: "/mods", label: t("nav.mods"), icon: ModsIcon },
    { to: "/news", label: t("nav.news"), icon: NewsIcon },
    { action: "openSettings", label: t("nav.settings"), icon: SettingsIcon },
    { to: "/logs", label: t("nav.logs"), icon: LogsIcon }
  ];

  const navItems = showLogsNav
    ? allNavItems
    : allNavItems.filter((item) => !("to" in item) || item.to !== "/logs");

  const navItemsWithTo = navItems.filter((item): item is typeof item & { to: string } => "to" in item);

  const handleMouseEnter = (
    item: { label: string },
    element: HTMLAnchorElement
  ) => {
    const rect = element.getBoundingClientRect();
    if (position === "top") {
      setTooltip({
        text: item.label,
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
        placement: "bottom"
      });
    } else {
      setTooltip({
        text: item.label,
        top: rect.top + rect.height / 2,
        left: rect.right + 12,
        placement: "right"
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  useEffect(() => {
    const pathname = location.pathname;
    const activeItem = navItemsWithTo.find(
      (item) => item.to === pathname || (item.to === "/" && pathname === "/")
    );
    if (!activeItem || !navContainerRef.current) {
      setIndicator(null);
      return;
    }
    const el = navRefs.current.get(activeItem.to);
    if (!el) {
      setIndicator(null);
      return;
    }
    const schedule = () => {
      const navRect = navContainerRef.current?.getBoundingClientRect();
      const linkRect = el.getBoundingClientRect();
      if (!navRect) return;
      setIndicator({
        top: linkRect.top - navRect.top,
        left: linkRect.left - navRect.left,
        width: linkRect.width,
        height: linkRect.height
      });
    };
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(schedule);
    });
    return () => cancelAnimationFrame(id);
  }, [location.pathname, navItemsWithTo]);

  return (
    <>
      <aside
        className={[
          styles.sidebar,
          position === "top" ? styles.sidebarTop : styles.sidebarLeft
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.brand}>
          <div className={styles.logo}>
            <span className={styles.logoLetter}>J</span>
          </div>
          {position === "top" && (
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>JanLauncher</span>
              <span className={styles.brandSubtitle}>{t("layout.subtitle")}</span>
            </div>
          )}
        </div>

        <nav
          ref={navContainerRef}
          className={[
            styles.nav,
            position === "top" ? styles.navHorizontal : styles.navVertical
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {indicator != null && (
            <div
              className={[
                styles.navIndicator,
                position === "top" ? styles.navIndicatorHorizontal : styles.navIndicatorVertical
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                top: indicator.top,
                left: indicator.left,
                width: indicator.width,
                height: indicator.height
              }}
              aria-hidden="true"
            />
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            if ("action" in item && item.action === "openSettings") {
              return (
                <button
                  key="settings"
                  type="button"
                  ref={(el) => {
                    if (el) navRefs.current.set("__settings", el);
                  }}
                  title={item.label}
                  aria-label={item.label}
                  onMouseEnter={(e) => handleMouseEnter(item, e.currentTarget)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => api.window.openSettings()}
                  className={[styles.navItem, position === "top" ? styles.navItemTop : undefined]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Icon className={styles.navIcon} />
                </button>
              );
            }
            const linkItem = item as { to: string; label: string; end?: boolean; icon: typeof HomeIcon };
            return (
              <NavLink
                key={linkItem.to}
                ref={(el) => {
                  if (el) navRefs.current.set(linkItem.to, el);
                }}
                to={linkItem.to}
                end={linkItem.end}
                title={linkItem.label}
                aria-label={linkItem.label}
                onMouseEnter={(e) => handleMouseEnter(item, e.currentTarget)}
                onMouseLeave={handleMouseLeave}
                className={({ isActive }) =>
                  [
                    styles.navItem,
                    position === "top" ? styles.navItemTop : undefined,
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

        <div
          className={[
            styles.socialButtons,
            position === "top"
              ? styles.socialButtonsHorizontal
              : styles.socialButtonsVertical
          ]
            .filter(Boolean)
            .join(" ")}
        >
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
          className={[
            styles.tooltip,
            tooltip.placement === "bottom"
              ? styles.tooltipBottom
              : styles.tooltipRight
          ]
            .filter(Boolean)
            .join(" ")}
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
