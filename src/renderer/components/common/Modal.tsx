import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n";
import { CloseIcon } from "../icons";
import styles from "./Modal.module.css";

const MODAL_EXIT_MS = 220;

type ModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel?: string;
  blocking?: boolean;
};

const Modal = ({
  isOpen,
  title,
  onClose,
  children,
  footer,
  closeLabel,
  blocking = false
}: ModalProps) => {
  const { t } = useI18n();
  const [isClosing, setIsClosing] = useState(false);
  const closeRequestedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      closeRequestedRef.current = false;
    }
  }, [isOpen]);

  const handleCloseRequest = () => {
    if (blocking || isClosing || closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    setIsClosing(true);
  };

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !isClosing) return;
    if ((e as React.AnimationEvent<HTMLDivElement>).animationName?.includes("BackdropOut")) {
      onClose();
      setIsClosing(false);
    }
  };

  if (!isOpen && !isClosing) {
    return null;
  }

  const backdropClass = [
    styles.backdrop,
    blocking ? styles.blocking : "",
    isClosing ? styles.backdropClosing : styles.backdropEnter,
  ]
    .filter(Boolean)
    .join(" ");
  const modalClass = isClosing ? styles.modalClosing : styles.modalEnter;

  return createPortal(
    <div
      className={backdropClass}
      onClick={blocking ? undefined : handleCloseRequest}
      onAnimationEnd={handleAnimationEnd}
      role="presentation"
    >
      <div
        className={`${styles.modal} ${modalClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          {!blocking && (
            <button
              type="button"
              className={styles.closeButton}
              onClick={handleCloseRequest}
              aria-label={closeLabel ?? t("common.close")}
            >
              <CloseIcon className={styles.closeIcon} />
            </button>
          )}
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
