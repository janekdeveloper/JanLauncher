import { useEffect, useState } from "react";
import type { FeaturedServer } from "../../shared/types";
import { ServerList } from "../components/ServerList";
import ServerModal from "../components/modals/ServerModal";
import ContactModal from "../components/modals/ContactModal";
import { useI18n } from "../i18n";
import styles from "./CatalogPage.module.css";

const CatalogPage = () => {
  const { t } = useI18n();
  const [servers, setServers] = useState<FeaturedServer[]>([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [serversError, setServersError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<FeaturedServer | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  // Fetch servers on component mount
  useEffect(() => {
    const loadServers = async () => {
      try {
        setServersLoading(true);
        setServersError(null);
        const response = await window.api?.servers.getFeatured();
        if (response) {
          const pageServers = response.servers.filter(s => s.type === "page");
          setServers(pageServers);
        }
      } catch (err) {
        setServersError("Failed to load servers");
      } finally {
        setServersLoading(false);
      }
    };

    loadServers();
  }, []);

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

  return (
    <section className={styles.page}>
      {/* Server Catalog Section */}
      <div className={styles.serverSection}>
        <div className={styles.headerContainer}>
          <div className={styles.headerText}>
            <h2 className={styles.sectionTitle}>{t("servers.catalogTitle")}</h2>
            <p className={styles.sectionDescription}>
              {t("servers.catalogSubtitle")}
            </p>
          </div>
          <button 
            className={styles.buyAdButton}
            onClick={handleBuyAdvertising}
          >
            <span className={styles.buyAdIcon}>💎</span>
            <span>{t("servers.buyAdvertising")}</span>
          </button>
        </div>
        {serversLoading ? (
          <div className={styles.serverLoading}>Loading servers...</div>
        ) : serversError ? (
          <div className={styles.serverError}>{serversError}</div>
        ) : (
          <ServerList servers={servers} onServerClick={setSelectedServer} />
        )}
      </div>

      {selectedServer && (
        <ServerModal
          server={selectedServer}
          isOpen={selectedServer !== null}
          onClose={() => setSelectedServer(null)}
        />
      )}

      <ContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        onSelect={handleContactSelect}
      />
    </section>
  );
};

export default CatalogPage;
