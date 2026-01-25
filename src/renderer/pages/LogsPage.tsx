import { useLogsViewModel } from "../viewmodels/useLogsViewModel";
import { useI18n } from "../i18n";
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
          logs.map((log) => (
            <div key={log.id} className={styles.logRow} data-level={log.level}>
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
