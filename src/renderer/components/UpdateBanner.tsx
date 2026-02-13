import React, { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import Button from "./common/Button";
import { UpdateIcon, DownloadIcon, CheckCircleIcon, RefreshIcon, AlertCircleIcon, LoaderIcon, CloseIcon } from "./icons";
import styles from "./UpdateBanner.module.css";

type UpdateStatus = "idle" | "checking" | "update-available" | "downloading" | "downloaded" | "error";

const UpdateBanner: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const currentStatus = await api.updater.status();
        setStatus(currentStatus.status);
        setVersion(currentStatus.version || null);
        setProgress(currentStatus.progress || 0);
        setError(currentStatus.error || null);
      } catch (err) {
        console.error("Failed to load update status:", err);
      }
    };

    loadStatus();
  }, []);

  useEffect(() => {
    const cleanupAvailable = api.updater.onUpdateAvailable((data) => {
      setStatus("update-available");
      setVersion(data.version);
      setError(null);
      setIsDismissed(false);
    });

    const cleanupNotAvailable = api.updater.onUpdateNotAvailable(() => {
      setStatus("idle");
      setVersion(null);
      setError(null);
    });

    const cleanupProgress = api.updater.onDownloadProgress((data) => {
      setStatus("downloading");
      setProgress(data.percent);
      setError(null);
    });

    const cleanupDownloaded = api.updater.onUpdateDownloaded((data) => {
      setStatus("downloaded");
      setVersion(data.version);
      setProgress(100);
      setError(null);
      setIsDismissed(false);
    });

    const cleanupError = api.updater.onError((data) => {
      setStatus("error");
      setError(data.error);
    });

    return () => {
      cleanupAvailable();
      cleanupNotAvailable();
      cleanupProgress();
      cleanupDownloaded();
      cleanupError();
    };
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      setStatus("downloading");
      setError(null);
      await api.updater.download();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setStatus("error");
    }
  }, []);

  const handleRestartAndUpdate = useCallback(async () => {
    try {
      await api.updater.quitAndInstall();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setStatus("error");
    }
  }, []);

  const handleLater = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    api.updater.installOnQuit().catch((err) => {
      console.error("Failed to schedule install on quit:", err);
    });
  }, [isClosing]);

  const handleDismiss = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
  }, [isClosing]);

  const handleBannerAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget || !isClosing) return;
      if (String((e as React.AnimationEvent<HTMLDivElement>).animationName || "").includes("lideUp")) {
        setIsDismissed(true);
        setIsClosing(false);
      }
    },
    [isClosing]
  );

  if (isDismissed && !isClosing) return null;
  if (status === "idle" || status === "checking") return null;

  if (status === "error") {
    return (
      <div
        className={`${styles.banner} ${isClosing ? styles.bannerClosing : ""}`}
        data-status="error"
        onAnimationEnd={handleBannerAnimationEnd}
      >
        <div className={styles.content}>
          <div className={styles.iconWrapper}>
            <AlertCircleIcon className={styles.icon} />
          </div>
          <div className={styles.textContent}>
            <div className={styles.title}>Update Error</div>
            <div className={styles.message}>{error || "Unknown error occurred"}</div>
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={handleDismiss}>
              Dismiss
            </Button>
          </div>
          <button className={styles.closeButton} onClick={handleDismiss} aria-label="Close">
            <CloseIcon className={styles.closeIcon} />
          </button>
        </div>
      </div>
    );
  }

  if (status === "update-available") {
    return (
      <div
        className={`${styles.banner} ${isClosing ? styles.bannerClosing : ""}`}
        data-status="available"
        onAnimationEnd={handleBannerAnimationEnd}
      >
        <div className={styles.content}>
          <div className={styles.iconWrapper}>
            <UpdateIcon className={styles.icon} />
          </div>
          <div className={styles.textContent}>
            <div className={styles.title}>Update Available</div>
            <div className={styles.message}>Version {version} is ready to download</div>
          </div>
          <div className={styles.actions}>
            <Button variant="primary" size="sm" onClick={handleDownload}>
              <DownloadIcon className={styles.buttonIcon} />
              Download
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLater}>
              Later
            </Button>
          </div>
          <button className={styles.closeButton} onClick={handleLater} aria-label="Close">
            <CloseIcon className={styles.closeIcon} />
          </button>
        </div>
      </div>
    );
  }

  if (status === "downloading") {
    return (
      <div
        className={`${styles.banner} ${isClosing ? styles.bannerClosing : ""}`}
        data-status="downloading"
        onAnimationEnd={handleBannerAnimationEnd}
      >
        <div className={styles.content}>
          <div className={styles.iconWrapper}>
            <LoaderIcon className={`${styles.icon} ${styles.spinning}`} />
          </div>
          <div className={styles.textContent}>
            <div className={styles.title}>Downloading Update</div>
            <div className={styles.message}>Version {version} • {progress.toFixed(0)}%</div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
              <div className={styles.progressGlow} style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "downloaded") {
    return (
      <div
        className={`${styles.banner} ${isClosing ? styles.bannerClosing : ""}`}
        data-status="downloaded"
        onAnimationEnd={handleBannerAnimationEnd}
      >
        <div className={styles.content}>
          <div className={styles.iconWrapper}>
            <CheckCircleIcon className={styles.icon} />
          </div>
          <div className={styles.textContent}>
            <div className={styles.title}>Update Ready</div>
            <div className={styles.message}>Version {version} downloaded. Restart to install.</div>
          </div>
          <div className={styles.actions}>
            <Button variant="primary" size="sm" onClick={handleRestartAndUpdate}>
              <RefreshIcon className={styles.buttonIcon} />
              Restart & Update
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLater}>
              Later
            </Button>
          </div>
          <button className={styles.closeButton} onClick={handleLater} aria-label="Close">
            <CloseIcon className={styles.closeIcon} />
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default UpdateBanner;
