import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n/I18nContext";
import styles from "./ContactModal.module.css";

type ContactModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: "telegram" | "discord") => void;
};

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{t("servers.buyAdvertising")}</h3>
        <p className={styles.description}>
          {t("servers.chooseContactMethod")}
        </p>
        <div className={styles.options}>
          <button
            type="button"
            className={styles.option}
            onClick={() => onSelect("telegram")}
          >
            <span className={styles.icon}>✈️</span>
            <span className={styles.label}>{t("servers.advertiseTelegram")}</span>
          </button>
          <button
            type="button"
            className={styles.option}
            onClick={() => onSelect("discord")}
          >
            <span className={styles.icon}>💬</span>
            <span className={styles.label}>{t("servers.advertiseDiscord")}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ContactModal;
