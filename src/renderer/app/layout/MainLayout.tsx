import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { useI18n } from "../../i18n";
import { api } from "../../services/api";
import type { Settings } from "../../../shared/types";
import styles from "./MainLayout.module.css";

const MainLayout = () => {
  const { t } = useI18n();
  const location = useLocation();
  const [sidebarPosition, setSidebarPosition] = useState<"left" | "top">("top");

  useEffect(() => {
    let isMounted = true;

    api.settings
      .get()
      .then((data) => {
        if (!isMounted) return;
        setSidebarPosition(data.sidebarPosition === "left" ? "left" : "top");
      })
      .catch(() => {
        if (!isMounted) return;
        setSidebarPosition("left");
      });

    const handleSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<Partial<Settings>>;
      if (
        Object.prototype.hasOwnProperty.call(
          customEvent.detail ?? {},
          "sidebarPosition"
        )
      ) {
        setSidebarPosition(
          customEvent.detail?.sidebarPosition === "left" ? "left" : "top"
        );
      }
    };

    window.addEventListener(
      "janlauncher:settings-updated",
      handleSettingsUpdated
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        "janlauncher:settings-updated",
        handleSettingsUpdated
      );
    };
  }, []);

  const shellClassName = [
    styles.shell,
    sidebarPosition === "top" ? styles.shellVertical : styles.shellHorizontal
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
      <Sidebar position={sidebarPosition} />
      <div className={styles.content}>
        <header
          className={[
            styles.header,
            sidebarPosition === "top" ? styles.headerHidden : undefined
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div>
            <p className={styles.subtitle}>{t("layout.subtitle")}</p>
            <h1 className={styles.title}>JanLauncher</h1>
          </div>
        </header>
        <main className={styles.main}>
          <div key={location.pathname} className={styles.pageEnter}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
