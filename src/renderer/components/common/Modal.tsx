import React from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n";
import { CloseIcon } from "../icons";
import styles from "./Modal.module.css";

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

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = blocking ? undefined : onClose;
  const handleClose = blocking ? undefined : onClose;

  return createPortal(
    <div
      className={`${styles.backdrop} ${blocking ? styles.blocking : ""}`}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={styles.modal}
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
              onClick={handleClose}
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
