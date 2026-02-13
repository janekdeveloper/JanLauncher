import { useLogsViewModel } from "../viewmodels/useLogsViewModel";
import { useI18n } from "../i18n";
import { api } from "../services/api";
import { FolderIcon } from "../components/icons";
import styles from "./LogsPage.module.css";

const LogsPage = () => {
  const { t } = useI18n();
  const { logs, loading, error, containerRef, handleScroll } = useLogsViewModel();

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t("logs.title")}</h2>
          <p className={styles.subtitle}>{t("logs.subtitle")}</p>
        </div>
        <button
          type="button"
          className={styles.openLogsButton}
          onClick={() => api.paths.openLogsDir()}
          title={t("logs.openLogsFolder")}
          aria-label={t("logs.openLogsFolder")}
        >
          <FolderIcon className={styles.openLogsIcon} />
          <span className={styles.openLogsText}>{t("logs.openLogsFolder")}</span>
        </button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
        </div>
      )}

      <div
        ref={containerRef}
        className={styles.logContainer}
        onScroll={handleScroll}
      >
        {loading ? (
          <div className={styles.loading}>Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className={styles.empty}>No logs available</div>
        ) : (
          logs.map((log, index) => (
            <div
              key={log.id}
              className={`${styles.logRow} listItemEnter`}
              style={{ animationDelay: `${Math.min(index, 7) * 40}ms` }}
              data-level={log.level}
            >
              <div className={styles.logMeta}>
                <span className={styles.logTime}>{log.timestamp}</span>
                <span className={styles.logLevel}>{log.level}</span>
              </div>
              <div className={styles.logMessage}>{log.message}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default LogsPage;
