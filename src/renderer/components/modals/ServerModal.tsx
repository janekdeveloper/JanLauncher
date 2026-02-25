import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../icons";
import type { FeaturedServer } from "../../../shared/types";
import { useI18n } from "../../i18n/I18nContext";
import { useLauncherStore } from "../../store/launcherStore";
import ContactModal from "./ContactModal";
import styles from "./ServerModal.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ServerModalProps = {
  server: FeaturedServer;
  isOpen: boolean;
  onClose: () => void;
};

const ServerModal = ({ server, isOpen, onClose }: ServerModalProps) => {
  const { t } = useI18n();
  const { selectedPlayerId, selectedGameId } = useLauncherStore();
  const [isClosing, setIsClosing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [launchStatus, setLaunchStatus] = useState<"idle" | "launching" | "error">("idle");
  const [showContactModal, setShowContactModal] = useState(false);
  const closeRequestedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleCloseRequest = useCallback(() => {
    if (isClosing || closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    setIsClosing(true);
  }, [isClosing]);

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !isClosing) return;
    if ((e as React.AnimationEvent<HTMLDivElement>).animationName?.includes("serverBackdropOut")) {
      onClose();
      setIsClosing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      closeRequestedRef.current = false;
      setCopyStatus("idle");
      setLaunchStatus("idle");
      setShowContactModal(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCloseRequest();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleCloseRequest]);

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      if (event.shiftKey) {
        if (document.activeElement === first && last) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last && first) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const handleLaunch = async () => {
    if (!selectedPlayerId || !selectedGameId) {
      setLaunchStatus("error");
      return;
    }
    
    setLaunchStatus("launching");
    try {
      await window.api?.servers.open(server.ip, server.port, selectedPlayerId, selectedGameId);
      handleCloseRequest();
    } catch (error) {
      setLaunchStatus("error");
    }
  };

  const handleCopy = async () => {
    try {
      await window.api?.servers.copyAddress(server.ip, server.port);
      setCopyStatus("success");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (error) {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  const handleAdvertise = async () => {
    if (server.advertiseUrl) {
      try {
        await window.api?.servers.openAdvertise(server.advertiseUrl);
      } catch (error) {
        console.error("Failed to open advertise URL", error);
      }
    }
  };

  const handleBuyAdvertising = () => {
    setShowContactModal(true);
  };

  const handleContactSelect = async (type: "telegram" | "discord") => {
    try {
      await window.api?.servers.openAdvertiseContact(type);
      setShowContactModal(false);
    } catch (error) {
      console.error(`Failed to open ${type} contact`, error);
    }
  };

  if (!isOpen && !isClosing) {
    return null;
  }

  const backdropClass = [
    styles.backdrop,
    isClosing ? styles.backdropClosing : styles.backdropEnter
  ].join(" ");
  const modalClass = isClosing ? styles.modalClosing : styles.modalEnter;

  return (
    <>
      {createPortal(
        <div
          className={backdropClass}
          onClick={handleCloseRequest}
          onAnimationEnd={handleAnimationEnd}
          role="presentation"
        >
          <div
            ref={dialogRef}
            className={`${styles.modal} ${modalClass}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="server-modal-title"
            aria-describedby="server-modal-description"
            onClick={(e) => e.stopPropagation()}
          >
            <header className={styles.header}>
              <h2 id="server-modal-title" className={styles.title}>
                {server.name}
              </h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={handleCloseRequest}
                aria-label="Close"
              >
                <CloseIcon className={styles.closeIcon} />
              </button>
            </header>
            <div className={styles.body}>
              <p id="server-modal-description" className={styles.description}>
                {server.description}
              </p>
              <div className={styles.address}>
                {server.ip}:{server.port}
              </div>
              
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                  onClick={handleLaunch}
                  disabled={launchStatus === "launching"}
                >
                  {launchStatus === "launching" ? t("servers.launching") : t("servers.launchGame")}
                </button>
                
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                  onClick={handleCopy}
                >
                  {copyStatus === "success" ? t("servers.copied") : 
                   copyStatus === "error" ? t("servers.copyFailed") : t("servers.copyAddress")}
                </button>
                
                {server.advertiseUrl && (
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                    onClick={handleAdvertise}
                  >
                    {t("servers.viewDetails")}
                  </button>
                )}

                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.buyAdButton}`}
                  onClick={handleBuyAdvertising}
                >
                  <span className={styles.buyAdIcon}>💎</span>
                  <span>{t("servers.buyAdvertising")}</span>
                </button>
              </div>
              
              {launchStatus === "error" && (
                <p className={styles.errorMessage}>
                  {!selectedPlayerId || !selectedGameId 
                    ? t("servers.selectProfilesError")
                    : t("servers.launchError")}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <ContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        onSelect={handleContactSelect}
      />
    </>
  );
};

export default ServerModal;