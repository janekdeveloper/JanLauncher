import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useI18n } from "../../i18n";
import styles from "./MainLayout.module.css";

const MainLayout = () => {
  const { t } = useI18n();

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.subtitle}>{t("layout.subtitle")}</p>
            <h1 className={styles.title}>JanLauncher</h1>
          </div>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
