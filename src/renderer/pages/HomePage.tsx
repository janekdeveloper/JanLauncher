import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Modal from "../components/common/Modal";
import { ProgressBar } from "../components/common/ProgressBar";
import {
  ChevronDownIcon,
  EditIcon,
  GameProfileIcon,
  TrashIcon,
  UserIcon
} from "../components/icons";
import { useDropdown } from "../hooks/useDropdown";
import { useI18n } from "../i18n";
import { useHomeViewModel } from "../viewmodels/useHomeViewModel";
import { api } from "../services/api";
import type { AuthDomain, GameVersionBranch } from "../../shared/types";
import type { AuthProviderInfo } from "../../main/core/auth/auth.types";
import { DISCORD_INVITE_URL } from "../constants/links";
import styles from "./HomePage.module.css";

type DockOption = {
  id: string;
  label: string;
  meta?: string;
  invalid?: boolean;
};

type DockSelectProps = {
  label: string;
  value: string;
  icon: ReactNode;
  options: DockOption[];
  onSelect: (id: string) => void;
  onCreate?: () => void;
  renderActions?: (id: string) => ReactNode;
  createLabel?: string;
  emptyLabel: string;
};

const DockSelect = ({
  label,
  value,
  icon,
  options,
  onSelect,
  onCreate,
  renderActions,
  createLabel,
  emptyLabel
}: DockSelectProps) => {
  const { ref, isOpen, toggle, close } = useDropdown();

  return (
    <div className={styles.dropdown} ref={ref}>
      <button
        type="button"
        className={styles.dropdownButton}
        onClick={toggle}
        aria-expanded={isOpen}
      >
        <span className={styles.dropdownIcon}>{icon}</span>
        <span className={styles.dropdownText}>
          <span className={styles.dropdownLabel}>{label}</span>
          <span className={styles.dropdownValue}>{value}</span>
        </span>
        <ChevronDownIcon
          className={`${styles.dropdownChevron} ${
            isOpen ? styles.dropdownChevronOpen : ""
          }`}
        />
      </button>
      {isOpen ? (
        <div className={styles.dropdownMenu} role="listbox">
          {options.length ? (
            options.map((option) => (
              <div key={option.id} className={styles.dropdownItemRow}>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    onSelect(option.id);
                    close();
                  }}
                >
                  <span className={`${styles.dropdownItemLabel} ${option.invalid ? styles.dropdownItemLabelInvalid : ""}`}>
                    {option.label}
                  </span>
                  {option.meta ? (
                    <span className={`${styles.dropdownItemMeta} ${option.invalid ? styles.dropdownItemMetaInvalid : ""}`}>
                      {option.meta}
                    </span>
                  ) : null}
                </button>
                {renderActions ? (
                  <div className={styles.dropdownItemActions}>
                    {renderActions(option.id)}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className={styles.dropdownEmpty}>{emptyLabel}</div>
          )}
          {onCreate && createLabel ? (
          <button
            type="button"
            className={styles.dropdownCreate}
            onClick={() => {
              close();
              onCreate();
            }}
          >
            {createLabel}
          </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const HomePage = () => {
  const { t } = useI18n();
  const {
    playerProfiles,
    gameProfiles,
    selectedPlayerId,
    setSelectedPlayerId,
    selectedGameId,
    setSelectedGameId,
    isLaunching,
    launch,
    selectedPlayer,
    selectedGame,
    canLaunch,
    isPlayerModalOpen,
    isGameModalOpen,
    playerDraft,
    gameDraft,
    setPlayerDraft,
    setGameDraft,
    authDomainDraft,
    setAuthDomainDraft,
    openPlayerModal,
    closePlayerModal,
    openGameModal,
    closeGameModal,
    createPlayerProfile,
    createGameProfile,
    openEditPlayerModal,
    openDeleteConfirm,
    deleteConfirmOpen,
    deletingPlayerId,
    closeDeleteConfirm,
    confirmDeletePlayer,
    isEditingPlayer,
    errorModalOpen,
    errorMessage,
    closeErrorModal,
    isInstalling,
    installCompleted,
    installProgress,
    handleInstallGame,
    isGameNotInstalled,
    isAccountValid,
    isValidatingAccount,
    refreshPlayerProfiles,
    authProviders,
    versionBranch,
    activeVersionId,
    availableVersions,
    versionsLoading,
    versionsLoadingAvailable,
    versionsError,
    setVersionsError,
    versionInstallProgress,
    isVersionInstalling,
    showVersionBranchSelector,
    setActiveBranch,
    setActiveVersion,
    installVersion,
    removeVersion
  } = useHomeViewModel();

  useEffect(() => {
    refreshPlayerProfiles();
  }, [location.pathname, location.hash, refreshPlayerProfiles]);

  const getProviderLabel = (provider?: AuthProviderInfo | null): string => {
    if (!provider) return "";
    if (provider.labelKey) {
      return t(provider.labelKey);
    }
    return provider.displayName;
  };

  const playerOptions: DockOption[] = playerProfiles.map((profile) => {
    const isSelected = profile.id === selectedPlayerId;
    const isValidating = isSelected ? isValidatingAccount : false;
    const isInvalid = isSelected ? isAccountValid === false : false;

    let meta = "";
    const provider = authProviders.find((p) => p.id === profile.authDomain);
    if (provider) {
      meta = getProviderLabel(provider);
    } else if (profile.authDomain) {
      meta = profile.authDomain;
    } else {
      const defaultProvider = authProviders.find((p) => p.isAvailable);
      if (defaultProvider) {
        meta = getProviderLabel(defaultProvider);
      }
    }

    if (isInvalid) {
      meta = t("home.invalidAccount");
    }

    if (isSelected && isValidating) {
      meta = t("home.validatingAccount");
    }

    return {
      id: profile.id,
      label: profile.nickname,
      meta,
      invalid: isInvalid
    };
  });

  const gameOptions: DockOption[] = gameProfiles.map((profile) => ({
    id: profile.id,
    label: profile.name,
    meta: t("home.modCount", { count: profile.mods.length })
  }));

  const branchOptions: DockOption[] = [
    { id: "release", label: t("home.branchRelease") },
    { id: "pre-release", label: t("home.branchPreRelease") },
    { id: "beta", label: t("home.branchBeta") },
    { id: "alpha", label: t("home.branchAlpha") }
  ];

  const versionOptions: DockOption[] = availableVersions.map((version) => {
    const isActive = version.id === activeVersionId;
    return {
      id: `${version.branch}:${version.id}`,
      label: version.isLatest ? `${version.label} (${t("home.versionLatest")})` : version.label,
      meta: isActive
        ? t("home.versionActive")
        : version.installed
          ? t("home.versionInstalled")
          : t("home.versionNotInstalled")
    };
  });

  const activeVersion = availableVersions.find((version) => version.id === activeVersionId);
  const branchValue =
    branchOptions.find((option) => option.id === versionBranch)?.label ??
    versionBranch;
  const versionValue = versionsLoadingAvailable
    ? t("home.versionLoading")
    : activeVersion
      ? activeVersion.isLatest
        ? `${activeVersion.label} (${t("home.versionLatest")})`
        : activeVersion.label
      : t("home.versionPlaceholder");

  const isAgentError = Boolean(errorMessage?.startsWith("DUALAUTH_AGENT_DOWNLOAD_FAILED"));
  const agentErrorDetails = isAgentError
    ? errorMessage?.split(":").slice(1).join(":").trim()
    : "";

  return (
    <section className={styles.page}>
      <div className={styles.center}>
        <div className={styles.playCard}>
          <p className={styles.playSubtitle}>{t("home.playSubtitle")}</p>
          <h2 className={styles.playTitle}>{t("home.playTitle")}</h2>
          <p className={styles.playHint}>
            {t("home.playHint")}
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={launch}
            disabled={!canLaunch || isLaunching}
            className={styles.playButton}
          >
            {isLaunching ? t("home.launching") : t("home.playButton")}
          </Button>
        </div>
      </div>

      <div className={styles.dock}>
        <DockSelect
          label={t("home.accountLabel")}
          value={selectedPlayer?.nickname ?? t("home.accountPlaceholder")}
          icon={<UserIcon className={styles.iconSvg} />}
          options={playerOptions}
          onSelect={setSelectedPlayerId}
          renderActions={(id) => (
            <>
              <button
                type="button"
                className={styles.actionButton}
                onClick={(event) => {
                  event.stopPropagation();
                  openEditPlayerModal(id);
                }}
                aria-label={t("home.editAccount")}
              >
                <EditIcon className={styles.actionIcon} />
              </button>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.actionDanger}`}
                onClick={(event) => {
                  event.stopPropagation();
                  openDeleteConfirm(id);
                }}
                aria-label={t("home.deleteAccount")}
              >
                <TrashIcon className={styles.actionIcon} />
              </button>
            </>
          )}
          onCreate={openPlayerModal}
          createLabel={t("home.createAccount")}
          emptyLabel={t("home.emptyAccounts")}
        />
        <DockSelect
          label={t("home.gameProfileLabel")}
          value={selectedGame?.name ?? t("home.gameProfilePlaceholder")}
          icon={<GameProfileIcon className={styles.iconSvg} />}
          options={gameOptions}
          onSelect={setSelectedGameId}
          onCreate={openGameModal}
          createLabel={t("home.createGameProfile")}
          emptyLabel={t("home.emptyGameProfiles")}
        />
        {showVersionBranchSelector && (
          <DockSelect
            label={t("home.branchLabel")}
            value={branchValue}
            icon={<GameProfileIcon className={styles.iconSvg} />}
            options={branchOptions}
            onSelect={(id) => setActiveBranch(id as GameVersionBranch)}
            emptyLabel={t("home.branchEmpty")}
          />
        )}
        <DockSelect
          label={t("home.versionLabel")}
          value={versionValue}
          icon={<GameProfileIcon className={styles.iconSvg} />}
          options={versionOptions}
          onSelect={(compositeId) => {
            const [, versionId] = compositeId.split(":", 2);
            setActiveVersion(versionId);
          }}
          renderActions={(compositeId) => {
            const [, versionId] = compositeId.split(":", 2);
            const version = availableVersions.find((item) => item.id === versionId);
            if (!version) return null;
            if (version.installed) {
              const isActive = version.id === activeVersionId;
              return (
                <button
                  type="button"
                  className={styles.versionActionButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeVersion(versionId);
                  }}
                  disabled={isActive}
                  aria-label={t("home.versionRemove")}
                >
                  {t("home.versionRemove")}
                </button>
              );
            }
            return (
              <button
                type="button"
                className={styles.versionActionButton}
                onClick={(event) => {
                  event.stopPropagation();
                  installVersion(versionId);
                }}
                disabled={isVersionInstalling}
                aria-label={t("home.versionInstall")}
              >
                {t("home.versionInstall")}
              </button>
            );
          }}
          emptyLabel={versionsLoadingAvailable ? t("home.versionLoading") : t("home.versionEmpty")}
        />
      </div>

      <Modal
        isOpen={isVersionInstalling}
        title={t("home.versionInstallingTitle")}
        onClose={() => {}}
        blocking={true}
      >
        <div className={styles.progressModalContent}>
          <ProgressBar
            percent={versionInstallProgress?.percent}
            label={versionInstallProgress?.message ?? t("home.versionInstalling")}
          />
        </div>
      </Modal>

      {versionsError && (
        <Modal
          isOpen={Boolean(versionsError)}
          title={t("home.versionErrorTitle")}
          onClose={() => {
            setVersionsError(null);
          }}
        >
          <div className={styles.errorModalContent}>
            <p className={styles.errorMessage}>{versionsError}</p>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={isPlayerModalOpen}
        title={
          isEditingPlayer ? t("home.editAccountTitle") : t("home.newAccountTitle")
        }
        onClose={closePlayerModal}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="ghost" onClick={closePlayerModal}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={createPlayerProfile}>
              {isEditingPlayer ? t("common.save") : t("common.create")}
            </Button>
          </div>
        }
      >
        <Input
          label={t("home.nicknameLabel")}
          placeholder={t("home.nicknamePlaceholder")}
          value={playerDraft}
          onChange={(event) => setPlayerDraft(event.target.value)}
        />
        <div className={styles.field}>
          <span className={styles.label}>{t("home.authSystemLabel")}</span>
          <div className={styles.authSystemSelector}>
            {authProviders.length > 0 ? (
              authProviders.map((provider: AuthProviderInfo) => {
                const isSelected = authDomainDraft === provider.id;
                const isDisabled = !provider.isAvailable;
                
                const isOfficialProvider = provider.kind === "official";
                
                return (
            <button
                    key={provider.id}
              type="button"
              className={`${styles.authSystemOption} ${
                      isSelected ? styles.authSystemOptionActive : ""
                    } ${isDisabled ? styles.authSystemOptionDisabled : ""}`}
                    onClick={() => setAuthDomainDraft(provider.id as AuthDomain)}
                    disabled={isDisabled}
            >
              <div className={styles.authSystemOptionContent}>
                <div className={styles.authSystemOptionIcon}>
                        {isOfficialProvider ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                        ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                    <line x1="7" y1="8" x2="17" y2="8" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                  </svg>
                        )}
                </div>
                <div className={styles.authSystemOptionText}>
                  <span className={styles.authSystemOptionName}>
                    {getProviderLabel(provider)}
                  </span>
                  <span className={styles.authSystemOptionDomain}>{provider.authDomain}</span>
                  {provider.hintKey && !isDisabled && (
                    <span className={styles.authSystemOptionHint}>
                      {t(provider.hintKey)}
                    </span>
                  )}
                  {isDisabled && (
                    <span className={styles.authSystemOptionHint}>
                      {t("home.authSystemUnavailable")}
                    </span>
                  )}
                </div>
              </div>
            </button>
                );
              })
            ) : (
              <div className={styles.authSystemSelectorEmpty}>
                {t("home.loadingAuthProviders") || "Loading auth providers..."}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isGameModalOpen}
        title={t("home.newGameProfileTitle")}
        onClose={closeGameModal}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="ghost" onClick={closeGameModal}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={createGameProfile}>
              {t("common.create")}
            </Button>
          </div>
        }
      >
        <Input
          label={t("home.gameProfileNameLabel")}
          placeholder={t("home.gameProfileNamePlaceholder")}
          value={gameDraft}
          onChange={(event) => setGameDraft(event.target.value)}
        />
      </Modal>

      <Modal
        isOpen={errorModalOpen}
        title={
          isAgentError
            ? t("home.dualauthAgentErrorTitle")
            : isGameNotInstalled
              ? installCompleted
                ? t("home.installCompletedTitle")
                : t("home.installTitle")
              : t("home.errorTitle")
        }
        onClose={isInstalling ? () => {} : closeErrorModal}
        footer={
          <div className={styles.modalFooter}>
            {isAgentError ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => api.news.openUrl(DISCORD_INVITE_URL)}
                >
                  {t("home.dualauthAgentErrorDiscordButton")}
                </Button>
                <Button variant="primary" onClick={closeErrorModal}>
                  {t("common.close")}
                </Button>
              </>
            ) : isGameNotInstalled ? (
              <>
                {installCompleted ? (
                  <Button variant="primary" onClick={closeErrorModal}>
                    {t("common.close")}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      onClick={closeErrorModal}
                      disabled={isInstalling}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleInstallGame}
                      disabled={isInstalling || !selectedGameId}
                    >
                      {isInstalling
                        ? t("home.installing")
                        : t("home.installButton")}
                    </Button>
                  </>
                )}
              </>
            ) : (
              <Button variant="primary" onClick={closeErrorModal}>
                {t("common.close")}
              </Button>
            )}
          </div>
        }
      >
        {isAgentError ? (
          <p className={styles.errorMessage}>
            {t("home.dualauthAgentErrorBody", { details: agentErrorDetails || "" })}
          </p>
        ) : isGameNotInstalled ? (
          <div>
            <p className={styles.installMessage}>
              {installCompleted
                ? t("home.installCompletedMessage")
                : isInstalling
                  ? t("home.installInProgressMessage")
                  : t("home.installMessage")}
            </p>
            {!installCompleted && isInstalling && installProgress && (
              <div className={styles.installProgress}>
                <p className={styles.progressMessage}>
                  {installProgress.message}
                  {installProgress.percent !== undefined
                    ? ` (${Math.round(installProgress.percent)}%)`
                    : ""}
                </p>
                {installProgress.percent !== undefined && (
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${installProgress.percent}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className={styles.errorMessage}>
            {errorMessage || t("home.unknownError")}
          </p>
        )}
      </Modal>

      <Modal
        isOpen={deleteConfirmOpen}
        title={t("home.deleteConfirmTitle")}
        onClose={closeDeleteConfirm}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="ghost" onClick={closeDeleteConfirm}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={confirmDeletePlayer}>
              {t("home.deleteConfirmButton")}
            </Button>
          </div>
        }
      >
        <p className={styles.deleteConfirmMessage}>
          {t("home.deleteConfirmMessage", {
            nickname:
              playerProfiles.find((p) => p.id === deletingPlayerId)?.nickname ??
              ""
          })}
        </p>
      </Modal>
    </section>
  );
};

export default HomePage;
