import React from "react";
import type { FeaturedServer } from "../../shared/types";
import { LayoutIcon, InfoCircleIcon, UserIcon } from "./icons";
import styles from "./ServerList.module.css";

interface ServerListProps {
  servers: FeaturedServer[];
  onServerClick: (server: FeaturedServer) => void;
}

export const ServerList: React.FC<ServerListProps> = ({ servers, onServerClick }) => {
  if (servers.length === 0) {
    return <div className={styles.empty}>No servers available</div>;
  }

  return (
    <div className={styles.list}>
      {servers.map((server, index) => (
        <div
          key={`${server.ip}-${server.port}-${index}`}
          className={styles.item}
          onClick={() => onServerClick(server)}
        >
          <div className={styles.iconWrapper}>
            <LayoutIcon className={styles.serverIcon} />
          </div>
          
          <div className={styles.content}>
            <div className={styles.header}>
              <div className={styles.name}>{server.name}</div>
              <div className={styles.statusBadge}>
                <span className={styles.statusDot}></span>
                <span className={styles.statusText}>Online</span>
              </div>
            </div>
            
            <div className={styles.descriptionRow}>
              <InfoCircleIcon className={styles.descIcon} />
              <div className={styles.description}>{server.description}</div>
            </div>
            
            <div className={styles.footer}>
              <div className={styles.playersInfo}>
                <UserIcon className={styles.playerIcon} />
                <span className={styles.playersText}>Players online</span>
              </div>
              <div className={styles.address}>{server.ip}:{server.port}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
