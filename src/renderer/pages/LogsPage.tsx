import { useEffect, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useLogsViewModel } from "../viewmodels/useLogsViewModel";
import { useI18n } from "../i18n";
import { api } from "../services/api";
import { FolderIcon } from "../components/icons";
import styles from "./LogsPage.module.css";

const LogsPage = () => {
  const { t } = useI18n();
  const { logs, loading, error, atBottomRef, scrollToEndRef } = useLogsViewModel();
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    scrollToEndRef.current = () => {
      if (logs.length > 0) {
        virtuosoRef.current?.scrollToIndex({
          index: logs.length - 1,
          behavior: "smooth"
        });
      }
    };
    return () => {
      scrollToEndRef.current = null;
    };
  }, [logs.length, scrollToEndRef]);

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

      <div className={styles.logContainer}>
        {loading ? (
          <div className={styles.loading}>Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className={styles.empty}>No logs available</div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={logs}
            className={styles.virtuoso}
            initialTopMostItemIndex={logs.length - 1}
            followOutput={(isAtBottom) => (isAtBottom ? "smooth" : false)}
            atBottomStateChange={(atBottom) => {
              atBottomRef.current = atBottom;
            }}
            itemContent={(_, log) => (
              <div
                key={log.id}
                className={`${styles.logRow} listItemEnter`}
                data-level={log.level}
              >
                <div className={styles.logMeta}>
                  <span className={styles.logTime}>{log.timestamp}</span>
                  <span className={styles.logLevel}>{log.level}</span>
                </div>
                <div className={styles.logMessage}>{log.message}</div>
              </div>
            )}
          />
        )}
      </div>
    </section>
  );
};

export default LogsPage;
