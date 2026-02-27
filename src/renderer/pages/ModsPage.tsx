import { useState, useCallback, useRef, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Select from "../components/common/Select";
import { ExternalLinkIcon, DownloadIcon, CalendarIcon, PackageIcon, CheckCircleIcon, FolderIcon, VersionTagIcon, RefreshIcon, GameProfileIcon } from "../components/icons";
import { useI18n } from "../i18n";
import { useModsViewModel } from "../viewmodels/useModsViewModel";
import { useLauncherStore } from "../store/launcherStore";
import { api } from "../services/api";
import type { Mod } from "../../shared/types";
import styles from "./ModsPage.module.css";

type InstalledModItemProps = {
  mod: Mod;
  index: number;
  togglingModId: string | null;
  uninstallingModId: string | null;
  installingModId: number | null;
  isSelected: boolean;
  onToggle: (modId: string) => Promise<void>;
  onUninstall: (modId: string) => Promise<void>;
  onReinstall: (mod: Mod) => Promise<void>;
  onSelect: (modId: string, options?: { shiftKey: boolean; index: number }) => void;
  formatDate: (dateString?: string) => string | null;
  formatFileSize: (bytes: number) => string;
  t: (key: string) => string;
  styles: typeof import("./ModsPage.module.css");
};

const InstalledModItem = ({
  mod,
  index,
  togglingModId,
  uninstallingModId,
  installingModId,
  isSelected,
  onToggle,
  onUninstall,
  onReinstall,
  onSelect,
  formatDate,
  formatFileSize,
  t,
  styles: s
}: InstalledModItemProps) => {
  const toggling = togglingModId === mod.id;
  const uninstalling = uninstallingModId === mod.id;
  const reinstalling = mod.curseForgeId != null && installingModId === mod.curseForgeId;
  return (
    <div
      role="button"
      tabIndex={0}
      className={`${s.modItem} ${isSelected ? s.modItemSelected : ""}`}
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
      }}
      onClick={(e) => onSelect(mod.id, { shiftKey: e.shiftKey, index })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(mod.id, { shiftKey: e.shiftKey, index });
        }
      }}
      aria-pressed={isSelected}
      aria-label={mod.name}
    >
      <div className={s.modItemIconWrap}>
        {mod.iconUrl ? (
          <img
            src={mod.iconUrl}
            alt=""
            className={s.modItemIconImg}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const fallback = target.nextElementSibling;
              if (fallback) (fallback as HTMLElement).style.display = "flex";
            }}
          />
        ) : null}
        <span
          className={s.modItemIconLetter}
          style={mod.iconUrl ? { display: "none" } : undefined}
        >
          {mod.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className={s.modItemContent}>
        <div className={s.modItemHeader}>
          <h4 className={s.modName}>{mod.name}</h4>
          <span
            className={`${s.modStatus} ${
              mod.enabled ? s.modStatusEnabled : s.modStatusDisabled
            }`}
          >
            {mod.enabled ? t("mods.enabled") : t("mods.disabled")}
          </span>
        </div>
        {mod.description && (
          <p className={s.modDescription}>{mod.description}</p>
        )}
        <div className={s.modItemMeta}>
          {mod.author && (
            <span>{t("mods.author")}: {mod.author}</span>
          )}
          {mod.version && <span>{t("mods.version")}: {mod.version}</span>}
          <span>{formatFileSize(mod.fileSize)}</span>
          {formatDate(mod.dateInstalled) && (
            <span>{formatDate(mod.dateInstalled)}</span>
          )}
          {mod.missing && (
            <span className={s.modMissing}>{t("mods.missing")}</span>
          )}
        </div>
      </div>
      <div className={s.modItemActions} onClick={(e) => e.stopPropagation()}>
        <Button
          variant={mod.enabled ? "secondary" : "primary"}
          size="sm"
          onClick={() => onToggle(mod.id)}
          disabled={toggling || uninstalling || reinstalling}
        >
          {toggling
            ? t("mods.toggling")
            : mod.enabled
            ? t("mods.disable")
            : t("mods.enable")}
        </Button>
        {mod.curseForgeId != null && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onReinstall(mod)}
            disabled={toggling || uninstalling || reinstalling}
          >
            {reinstalling ? t("mods.reinstalling") : t("mods.reinstall")}
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          onClick={() => onUninstall(mod.id)}
          disabled={toggling || uninstalling || reinstalling}
        >
          {uninstalling ? t("mods.uninstalling") : t("mods.uninstall")}
        </Button>
      </div>
    </div>
  );
};

const ModsPage = () => {
  const { t } = useI18n();
  const { gameProfiles, selectedGameId, setSelectedGameId } = useLauncherStore();
  const {
    selectedGame,
    query,
    setQuery,
    selectedFilter,
    setSelectedFilter,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedGameVersion,
    setSelectedGameVersion,
    categories,
    gameVersions,
    isLoadingFilters,
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
    openModUrl,
    resetSearchState
  } = useModsViewModel();

  const [activeTab, setActiveTab] = useState<"search" | "installed">("search");
  const [installedScrollParent, setInstalledScrollParent] = useState<HTMLDivElement | null>(null);
  const [selectedModIds, setSelectedModIds] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);
  const installedCatalogRef = useCallback((el: HTMLDivElement | null) => {
    setInstalledScrollParent(el);
  }, []);

  const handleSelectMod = useCallback(
    (modId: string, options?: { shiftKey: boolean; index: number }) => {
      const shiftKey = options?.shiftKey ?? false;
      const index = options?.index ?? 0;
      if (shiftKey && options?.index !== undefined) {
        const anchor = lastClickedIndexRef.current ?? index;
        const start = Math.min(anchor, index);
        const end = Math.max(anchor, index);
        const idsInRange = installedMods
          .slice(start, end + 1)
          .map((m) => m.id);
        setSelectedModIds(new Set(idsInRange));
      } else {
        lastClickedIndexRef.current = index;
        setSelectedModIds((prev) => {
          const next = new Set(prev);
          if (next.has(modId)) next.delete(modId);
          else next.add(modId);
          return next;
        });
      }
    },
    [installedMods]
  );

  const selectAllMods = useCallback(() => {
    setSelectedModIds(new Set(installedMods.map((m) => m.id)));
  }, [installedMods]);

  const clearModSelection = useCallback(() => {
    setSelectedModIds(new Set());
  }, []);

  const selectedMods = installedMods.filter((m) => selectedModIds.has(m.id));
  const selectedEnabledCount = selectedMods.filter((m) => m.enabled).length;
  const selectedDisabledCount = selectedMods.length - selectedEnabledCount;

  const handleEnableSelected = useCallback(async () => {
    for (const mod of selectedMods) {
      if (!mod.enabled) {
        try {
          await toggleMod(mod.id);
        } catch {
          //
        }
      }
    }
  }, [selectedMods, toggleMod]);

  const handleDisableSelected = useCallback(async () => {
    for (const mod of selectedMods) {
      if (mod.enabled) {
        try {
          await toggleMod(mod.id);
        } catch {
          //
        }
      }
    }
  }, [selectedMods, toggleMod]);

  const handleUninstallSelected = useCallback(async () => {
    const n = selectedModIds.size;
    if (n === 0) return;
    if (!confirm(t("mods.confirmUninstallSelected", { count: n }))) return;
    const ids = Array.from(selectedModIds);
    for (const id of ids) {
      try {
        await uninstallMod(id);
      } catch {
        //
      }
    }
    clearModSelection();
  }, [selectedModIds, uninstallMod, t, clearModSelection]);

  const handleReinstall = useCallback(
    async (mod: Mod) => {
      if (mod.curseForgeId == null) return;
      try {
        await installMod(mod.curseForgeId, mod.curseForgeFileId);
      } catch {
        //
      }
    },
    [installMod]
  );

  const handleReinstallSelected = useCallback(async () => {
    for (const mod of selectedMods) {
      if (mod.curseForgeId != null) {
        try {
          await installMod(mod.curseForgeId, mod.curseForgeFileId);
        } catch {
          //
        }
      }
    }
  }, [selectedMods, installMod]);

  const selectedReinstallableCount = selectedMods.filter((m) => m.curseForgeId != null).length;

  useEffect(() => {
    if (activeTab !== "installed" || installedMods.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const isSelectAll = (e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A" || e.code === "KeyA");
      if (!isSelectAll) return;
      const target = e.target as HTMLElement;
      if (target?.closest("input") || target?.closest("textarea") || target?.closest("[contenteditable=true]")) return;
      e.preventDefault();
      e.stopPropagation();
      selectAllMods();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [activeTab, installedMods.length, selectAllMods]);

  useEffect(() => {
    if (activeTab === "installed") {
      const id = requestAnimationFrame(() => {
        installedCatalogRef.current?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [activeTab]);

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

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t("mods.title")}</h2>
          <p className={styles.subtitle}>{t("mods.subtitle")}</p>
        </div>
        <div className={styles.headerActions}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => selectedGameId && api.paths.openUserDataDir(selectedGameId)}
            disabled={!selectedGameId}
            className={styles.openModsFolderButton}
            title={t("mods.openModsFolder")}
            aria-label={t("mods.openModsFolder")}
          >
            <FolderIcon className={styles.openModsFolderIcon} aria-hidden />
            <span className={styles.openModsFolderText}>{t("mods.openModsFolder")}</span>
          </Button>
          <div className={styles.profileSelector}>
            <Select<string>
            id="mods-game-profile"
            value={selectedGameId || null}
            onChange={(id) => {
              if (id) setSelectedGameId(id);
            }}
            options={gameProfiles.map((profile) => ({ 
              value: profile.id, 
              label: profile.name 
            }))}
            placeholder={t("mods.profileNotSelected")}
            aria-label={t("mods.profileLabel")}
            label={
              <>
                <GameProfileIcon className={styles.selectLabelIcon} aria-hidden />
                {t("mods.profileLabel")}
              </>
            }
            className={styles.profileSelect}
            maxListHeight={200}
          />
          </div>
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
            <div className={styles.toolbarRow}>
              <div className={styles.selectGroup}>
                <Select<number>
                  id="mods-category"
                  value={selectedCategoryId}
                  onChange={setSelectedCategoryId}
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder={t("mods.filter.allCategories")}
                  disabled={isLoadingFilters}
                  aria-label={t("mods.filter.allCategories")}
                  label={
                    <>
                      <FolderIcon className={styles.selectLabelIcon} aria-hidden />
                      {t("mods.filter.category")}
                    </>
                  }
                  className={styles.modSelect}
                  maxListHeight={200}
                />
              </div>
              <div className={styles.selectGroup}>
                <Select<string>
                  id="mods-version"
                  value={selectedGameVersion}
                  onChange={setSelectedGameVersion}
                  options={gameVersions.map((v) => ({ value: v, label: v }))}
                  placeholder={t("mods.filter.allVersions")}
                  disabled={isLoadingFilters}
                  aria-label={t("mods.filter.allVersions")}
                  label={
                    <>
                      <VersionTagIcon className={styles.selectLabelIcon} aria-hidden />
                      {t("mods.filter.version")}
                    </>
                  }
                  className={styles.modSelect}
                  maxListHeight={200}
                />
              </div>
              <div className={styles.searchSection}>
                <Input
                  label={t("mods.searchLabel")}
                  placeholder={t("mods.searchPlaceholder")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
            <div className={styles.toolbarRowSecond}>
              <div className={styles.filtersSection}>
                <label className={styles.filtersLabel}>{t("mods.sortBy")}</label>
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
              <div className={styles.resetSection}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetSearchState}
                  className={styles.resetButton}
                  title={t("mods.resetFilters")}
                >
                  <RefreshIcon className={styles.resetButtonIcon} aria-hidden />
                  {t("mods.resetFilters")}
                </Button>
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
                  {searchResults.map((mod, index) => {
                    const installed = isModInstalled(mod.id);
                    const installing = installingModId === mod.id;
                    const modLogo = mod.logo?.thumbnailUrl || mod.logo?.url;
                    const lastUpdated = formatDate(mod.dateModified);
                    
                    return (
                      <div
                        key={mod.id}
                        className={`${styles.modCard} listItemEnter`}
                        style={{ animationDelay: `${Math.min(index, 7) * 40}ms` }}
                        >
                        <div className={styles.modCardHeader}>
                          <div className={styles.modCardIconWrapper}>
                            {modLogo ? (
                              <img
                                src={modLogo}
                                alt={mod.name}
                                className={styles.modCardIcon}
                                loading="lazy"
                                decoding="async"
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

                        <div className={styles.modCardBody}>
                          <p className={styles.modCardDescription}>
                            {mod.summary || t("mods.noDescription")}
                          </p>
                        </div>

                        <div className={styles.modCardDivider} />

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
        <div
          ref={installedCatalogRef}
          className={`${styles.catalog} ${styles.catalogInstalledList}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A" || e.nativeEvent?.code === "KeyA")) {
              e.preventDefault();
              e.stopPropagation();
              if (installedMods.length > 0) selectAllMods();
            }
          }}
        >
          {isLoadingInstalled ? (
            <div className={styles.loading}>{t("mods.loading")}</div>
          ) : installedMods.length === 0 ? (
            <div className={styles.emptyState}>
              <h4>{t("mods.noInstalledMods")}</h4>
              <p>{t("mods.noInstalledModsHint")}</p>
            </div>
          ) : (
            <>
              {selectedModIds.size > 0 && (
                <div className={styles.installedToolbar}>
                  <span className={styles.installedToolbarCount}>
                    {t("mods.selectedCount", { count: selectedModIds.size })}
                  </span>
                  <div className={styles.installedToolbarActions}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleEnableSelected}
                      disabled={selectedDisabledCount === 0}
                      title={t("mods.enableSelected")}
                    >
                      {t("mods.enableSelected")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleDisableSelected}
                      disabled={selectedEnabledCount === 0}
                      title={t("mods.disableSelected")}
                    >
                      {t("mods.disableSelected")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleReinstallSelected}
                      disabled={selectedReinstallableCount === 0}
                      title={t("mods.reinstallSelected")}
                    >
                      {t("mods.reinstallSelected")}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleUninstallSelected}
                      title={t("mods.uninstallSelected")}
                    >
                      {t("mods.uninstallSelected")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearModSelection}
                    >
                      {t("mods.clearSelection")}
                    </Button>
                  </div>
                </div>
              )}
              {installedScrollParent ? (
                <Virtuoso
                  customScrollParent={installedScrollParent}
                  data={installedMods}
                  itemContent={(index, mod) => (
                    <div className={styles.modItemWrapper}>
                      <InstalledModItem
                        mod={mod}
                        index={index}
                        togglingModId={togglingModId}
                        uninstallingModId={uninstallingModId}
                        installingModId={installingModId}
                        isSelected={selectedModIds.has(mod.id)}
                        onToggle={handleToggle}
                        onUninstall={handleUninstall}
                        onReinstall={handleReinstall}
                        onSelect={handleSelectMod}
                        formatDate={formatDate}
                        formatFileSize={formatFileSize}
                        t={t}
                        styles={styles}
                      />
                    </div>
                  )}
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default ModsPage;
