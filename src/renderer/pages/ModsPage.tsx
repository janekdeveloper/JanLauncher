import { useState } from "react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import { ExternalLinkIcon, DownloadIcon, CalendarIcon, PackageIcon, CheckCircleIcon } from "../components/icons";
import { useI18n } from "../i18n";
import { useModsViewModel } from "../viewmodels/useModsViewModel";
import styles from "./ModsPage.module.css";

const ModsPage = () => {
  const { t } = useI18n();
  const {
    selectedGame,
    query,
    setQuery,
    selectedFilter,
    setSelectedFilter,
    filters,
    searchResults,
    installedMods,
    isSearching,
    isLoadingInstalled,
    installingModId,
    togglingModId,
    uninstallingModId,
    searchPageIndex,
    totalPages,
    currentPage,
    goToPage,
    nextPage,
    prevPage,
    installMod,
    toggleMod,
    uninstallMod,
    isModInstalled,
    openModUrl
  } = useModsViewModel();

  const [activeTab, setActiveTab] = useState<"search" | "installed">("search");

  const handleInstall = async (modId: number) => {
    try {
      await installMod(modId);
    } catch {
    }
  };

  const handleToggle = async (modId: string) => {
    try {
      await toggleMod(modId);
    } catch {
    }
  };

  const handleUninstall = async (modId: string) => {
    if (!confirm(t("mods.confirmUninstall"))) return;
    try {
      await uninstallMod(modId);
    } catch {
    }
  };

  const handleOpenModUrl = async (mod: typeof searchResults[0]) => {
    await openModUrl(mod);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return t("mods.today");
      if (diffDays === 1) return t("mods.yesterday");
      if (diffDays < 7) return t("mods.daysAgo", { days: diffDays });
      if (diffDays < 30) return t("mods.weeksAgo", { weeks: Math.floor(diffDays / 7) });
      return date.toLocaleDateString();
    } catch {
      return null;
    }
  };

  const formatDownloads = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t("mods.title")}</h2>
          <p className={styles.subtitle}>{t("mods.subtitle")}</p>
        </div>
        <div className={styles.profileBadge}>
          {t("mods.profileLabel")}:{" "}
          {selectedGame?.name ?? t("mods.profileNotSelected")}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === "search" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("search")}
        >
          {t("mods.searchTab")}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === "installed" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("installed")}
        >
          {t("mods.installedTab")} ({installedMods.length})
        </button>
      </div>

      {activeTab === "search" ? (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchSection}>
              <Input
                label={t("mods.searchLabel")}
                placeholder={t("mods.searchPlaceholder")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className={styles.filtersSection}>
              <label className={styles.filtersLabel}>{t("mods.sortBy")}:</label>
              <div className={styles.filters}>
                {filters.map((filter) => (
                  <button
                    key={`${filter.sortField}-${filter.sortOrder}`}
                    type="button"
                    className={`${styles.filterButton} ${
                      selectedFilter.sortField === filter.sortField &&
                      selectedFilter.sortOrder === filter.sortOrder
                        ? styles.filterButtonActive
                        : ""
                    }`}
                    onClick={() => setSelectedFilter(filter)}
                  >
                    {t(`mods.filters.${filter.label}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.catalog}>
            {isSearching ? (
              <div className={styles.loading}>{t("mods.searching")}</div>
            ) : searchResults.length === 0 && query.trim() ? (
              <div className={styles.emptyState}>
                <h4>{t("mods.noResults")}</h4>
                <p>{t("mods.noResultsHint")}</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className={styles.emptyState}>
                <h4>{t("mods.emptyTitle")}</h4>
                <p>{t("mods.emptyBody")}</p>
              </div>
            ) : (
              <>
                <div className={styles.modGrid}>
                  {searchResults.map((mod) => {
                    const installed = isModInstalled(mod.id);
                    const installing = installingModId === mod.id;
                    const modLogo = mod.logo?.thumbnailUrl || mod.logo?.url;
                    const lastUpdated = formatDate(mod.dateModified);
                    
                    return (
                      <div key={mod.id} className={styles.modCard}>
                        {/* Header */}
                        <div className={styles.modCardHeader}>
                          <div className={styles.modCardIconWrapper}>
                            {modLogo ? (
                              <img
                                src={modLogo}
                                alt={mod.name}
                                className={styles.modCardIcon}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent && !parent.querySelector(`.${styles.modCardIconPlaceholder}`)) {
                                    const placeholder = document.createElement("div");
                                    placeholder.className = styles.modCardIconPlaceholder;
                                    const text = document.createElement("span");
                                    text.className = styles.modCardIconPlaceholderText;
                                    text.textContent = mod.name.charAt(0).toUpperCase();
                                    placeholder.appendChild(text);
                                    parent.appendChild(placeholder);
                                  }
                                }}
                              />
                            ) : (
                              <div className={styles.modCardIconPlaceholder}>
                                <span className={styles.modCardIconPlaceholderText}>
                                  {mod.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className={styles.modCardHeaderContent}>
                            <h3 className={styles.modCardTitle}>{mod.name}</h3>
                            {mod.authors.length > 0 && (
                              <div className={styles.modCardAuthor}>
                                <span className={styles.modCardAuthorLabel}>{t("mods.author")}:</span>
                                <span className={styles.modCardAuthorName}>{mod.authors[0].name}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Body */}
                        <div className={styles.modCardBody}>
                          <p className={styles.modCardDescription}>
                            {mod.summary || t("mods.noDescription")}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className={styles.modCardDivider} />

                        {/* Meta */}
                        <div className={styles.modCardMeta}>
                          {mod.downloadCount > 0 && (
                            <div className={styles.modCardMetaItem}>
                              <DownloadIcon className={styles.modCardMetaIcon} />
                              <span className={styles.modCardMetaText}>
                                {formatDownloads(mod.downloadCount)}
                              </span>
                            </div>
                          )}
                          {mod.latestFilesIndexes.length > 0 && (
                            <div className={styles.modCardMetaItem}>
                              <PackageIcon className={styles.modCardMetaIcon} />
                              <span className={styles.modCardMetaText}>
                                {mod.latestFilesIndexes[0].gameVersion}
                              </span>
                            </div>
                          )}
                          {lastUpdated && (
                            <div className={styles.modCardMetaItem}>
                              <CalendarIcon className={styles.modCardMetaIcon} />
                              <span className={styles.modCardMetaText}>{lastUpdated}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className={styles.modCardActions}>
                          {installed ? (
                            <Button
                              variant="secondary"
                              disabled
                              className={styles.modCardActionInstalled}
                            >
                              <CheckCircleIcon className={styles.modCardActionIcon} />
                              {t("mods.installed")}
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              onClick={() => handleInstall(mod.id)}
                              disabled={installing || !selectedGame}
                              className={styles.modCardActionInstall}
                            >
                              {installing ? (
                                <>
                                  <span className={styles.modCardActionSpinner} />
                                  {t("mods.installing")}
                                </>
                              ) : (
                                <>
                                  <DownloadIcon className={styles.modCardActionIcon} />
                                  {t("mods.install")}
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenModUrl(mod)}
                            title={t("mods.openInBrowser")}
                            className={styles.modCardActionExternal}
                          >
                            <ExternalLinkIcon className={styles.modCardActionIcon} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <Button
                      variant="ghost"
                      onClick={prevPage}
                      disabled={isSearching || searchPageIndex === 0}
                    >
                      {t("mods.prevPage")}
                    </Button>
                    <span className={styles.paginationInfo}>
                      {t("mods.pageInfo", { current: currentPage, total: totalPages })}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={nextPage}
                      disabled={isSearching || searchPageIndex >= totalPages - 1}
                    >
                      {t("mods.nextPage")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <div className={styles.catalog}>
          {isLoadingInstalled ? (
            <div className={styles.loading}>{t("mods.loading")}</div>
          ) : installedMods.length === 0 ? (
            <div className={styles.emptyState}>
              <h4>{t("mods.noInstalledMods")}</h4>
              <p>{t("mods.noInstalledModsHint")}</p>
            </div>
          ) : (
            <div className={styles.modList}>
              {installedMods.map((mod) => {
                const toggling = togglingModId === mod.id;
                const uninstalling = uninstallingModId === mod.id;
                return (
                  <div key={mod.id} className={styles.modItem}>
                    <div className={styles.modItemContent}>
                      <div className={styles.modItemHeader}>
                        <h4 className={styles.modName}>{mod.name}</h4>
                        <span
                          className={`${styles.modStatus} ${
                            mod.enabled ? styles.modStatusEnabled : styles.modStatusDisabled
                          }`}
                        >
                          {mod.enabled ? t("mods.enabled") : t("mods.disabled")}
                        </span>
                      </div>
                      {mod.description && (
                        <p className={styles.modDescription}>{mod.description}</p>
                      )}
                      <div className={styles.modItemMeta}>
                        {mod.author && (
                          <span>{t("mods.author")}: {mod.author}</span>
                        )}
                        {mod.version && <span>{t("mods.version")}: {mod.version}</span>}
                        {mod.missing && (
                          <span className={styles.modMissing}>{t("mods.missing")}</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.modItemActions}>
                      <Button
                        variant={mod.enabled ? "secondary" : "primary"}
                        size="sm"
                        onClick={() => handleToggle(mod.id)}
                        disabled={toggling || uninstalling}
                      >
                        {toggling
                          ? t("mods.toggling")
                          : mod.enabled
                          ? t("mods.disable")
                          : t("mods.enable")}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleUninstall(mod.id)}
                        disabled={toggling || uninstalling}
                      >
                        {uninstalling ? t("mods.uninstalling") : t("mods.uninstall")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ModsPage;
