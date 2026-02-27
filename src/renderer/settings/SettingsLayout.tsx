import { useState } from "react";
import { useI18n } from "../i18n";
import {
  SettingsIcon,
  GameProfileIcon,
  PackageIcon,
  LayoutIcon,
  RefreshIcon
} from "../components/icons";
import { SettingsProvider, useSettingsContext } from "./SettingsContext";
import GeneralTab from "./tabs/GeneralTab";
import GameTab from "./tabs/GameTab";
import JavaTab from "./tabs/JavaTab";
import InterfaceTab from "./tabs/InterfaceTab";
import AdvancedTab from "./tabs/AdvancedTab";
import styles from "./SettingsLayout.module.css";

export type SettingsTabId =
  | "general"
  | "game"
  | "java"
  | "interface"
  | "advanced";

const TABS: { id: SettingsTabId; labelKey: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "general", labelKey: "settings.tabs.general", Icon: SettingsIcon },
  { id: "game", labelKey: "settings.tabs.game", Icon: GameProfileIcon },
  { id: "java", labelKey: "settings.tabs.java", Icon: PackageIcon },
  { id: "interface", labelKey: "settings.tabs.interface", Icon: LayoutIcon },
  { id: "advanced", labelKey: "settings.tabs.advanced", Icon: RefreshIcon }
];

const TAB_COMPONENTS: Record<SettingsTabId, React.ComponentType> = {
  general: GeneralTab,
  game: GameTab,
  java: JavaTab,
  interface: InterfaceTab,
  advanced: AdvancedTab
};

const SettingsLayoutInner = () => {
  const { t } = useI18n();
  const { settings, isLoading } = useSettingsContext();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");

  if (isLoading || !settings) {
    return (
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          {TABS.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              type="button"
              className={styles.sidebarItem}
              disabled
            >
              <Icon className={styles.sidebarIcon} />
              {t(labelKey)}
            </button>
          ))}
        </aside>
        <main className={styles.content}>
          <div className={styles.loading}>{t("settings.loading")}</div>
        </main>
      </div>
    );
  }

  const TabComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar} aria-label="Settings sections">
        {TABS.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={`${styles.sidebarItem} ${activeTab === id ? styles.sidebarItemActive : ""}`}
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? "true" : undefined}
          >
            <Icon className={styles.sidebarIcon} />
            {t(labelKey)}
          </button>
        ))}
      </nav>
      <main className={styles.content}>
        <TabComponent />
      </main>
    </div>
  );
};

const SettingsLayout = () => (
  <SettingsProvider>
    <SettingsLayoutInner />
  </SettingsProvider>
);

export default SettingsLayout;
