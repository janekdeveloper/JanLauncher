import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, DiscordIcon, TelegramIcon } from "../icons";
import { useI18n } from "../../i18n";
import { DISCORD_INVITE_URL, TELEGRAM_URL } from "../../constants/links";
import styles from "./CommunityModal.module.css";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type CommunityModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const CommunityModal = ({ isOpen, onClose }: CommunityModalProps) => {
  const { t } = useI18n();
  const [isClosing, setIsClosing] = useState(false);
  const closeRequestedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleCloseRequest = useCallback(() => {
    if (isClosing || closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    setIsClosing(true);
  }, [isClosing]);

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !isClosing) return;
    if ((e as React.AnimationEvent<HTMLDivElement>).animationName?.includes("communityBackdropOut")) {
      onClose();
      setIsClosing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      closeRequestedRef.current = false;
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

  const handleDiscord = () => {
    window.api?.openExternal(DISCORD_INVITE_URL);
  };

  const handleTelegram = () => {
    window.api?.openExternal(TELEGRAM_URL);
  };

  if (!isOpen && !isClosing) {
    return null;
  }

  const backdropClass = [
    styles.backdrop,
    isClosing ? styles.backdropClosing : styles.backdropEnter
  ].join(" ");
  const modalClass = isClosing ? styles.modalClosing : styles.modalEnter;

  return createPortal(
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
        aria-labelledby="community-modal-title"
        aria-describedby="community-modal-description"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="community-modal-title" className={styles.title}>
            {t("communityModal.title")}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleCloseRequest}
            aria-label={t("common.close")}
          >
            <CloseIcon className={styles.closeIcon} />
          </button>
        </header>
        <div className={styles.body}>
          <p id="community-modal-description" className={styles.description}>
            {t("communityModal.description")}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
              onClick={handleDiscord}
            >
              <DiscordIcon className={styles.actionIcon} />
              {t("communityModal.joinDiscord")}
            </button>
            <button
              type="button"
              className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
              onClick={handleTelegram}
            >
              <TelegramIcon className={styles.actionIcon} />
              {t("communityModal.openTelegram")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CommunityModal;
