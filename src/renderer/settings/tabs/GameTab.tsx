import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { useSettingsContext } from "../SettingsContext";
import { api } from "../../services/api";
import { FolderIcon } from "../../components/icons";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import styles from "../settingsContent.module.css";

const MIN_MEMORY_MB = 2048;
const DEFAULT_MAX_MEMORY_MB = 16384;

const GameTab = () => {
  const { t } = useI18n();
  const { gameProfiles } = useSettingsContext();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [memoryLimit, setMemoryLimit] = useState(DEFAULT_MAX_MEMORY_MB);
  const [memory, setMemory] = useState(MIN_MEMORY_MB);

  const selectedProfile = selectedProfileId
    ? gameProfiles.find((p) => p.id === selectedProfileId)
    : gameProfiles[0];
  const effectiveProfileId = selectedProfile?.id ?? null;

  useEffect(() => {
    if (gameProfiles.length > 0 && selectedProfileId === null) {
      setSelectedProfileId(gameProfiles[0].id);
    }
  }, [gameProfiles, selectedProfileId]);

  useEffect(() => {
    let isMounted = true;
    api.system.getTotalMemoryMB().then((totalMb) => {
      if (!isMounted) return;
      const clamped = Number.isFinite(totalMb) && totalMb > 0 ? totalMb : DEFAULT_MAX_MEMORY_MB;
      const maxFromSystem = Math.max(MIN_MEMORY_MB, Math.floor(clamped / 512) * 512);
      setMemoryLimit(maxFromSystem);
      setMemory((prev) => Math.min(Math.max(prev || MIN_MEMORY_MB, MIN_MEMORY_MB), maxFromSystem));
    }).catch(() => {
      if (!isMounted) return;
      setMemoryLimit(DEFAULT_MAX_MEMORY_MB);
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (selectedProfile?.gameOptions?.maxMemory != null) {
      setMemory(selectedProfile.gameOptions.maxMemory);
    }
  }, [selectedProfile?.id, selectedProfile?.gameOptions?.maxMemory]);

  const updateMemory = (nextMb: number) => {
    const clamped = Math.min(Math.max(nextMb, MIN_MEMORY_MB), memoryLimit);
    setMemory(clamped);
    if (selectedProfile) {
      void api.gameProfiles.update(selectedProfile.id, {
        gameOptions: { ...selectedProfile.gameOptions, maxMemory: clamped }
      });
    }
  };

  const profileOptions = gameProfiles.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className={styles.page}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderTitle}>
          <h2 className={styles.title}>{t("settings.tabs.game")}</h2>
          <p className={styles.subtitle}>{t("settings.gameTabHint")}</p>
        </div>
        <Select<string>
          label={t("home.gameProfileLabel")}
          value={effectiveProfileId}
          onChange={(id) => setSelectedProfileId(id)}
          options={profileOptions}
          placeholder={t("home.gameProfilePlaceholder")}
          className={styles.profileSelect}
        />
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <p className={styles.label}>{t("settings.openGameDir")}</p>
          <button
            type="button"
            className={styles.folderButton}
            onClick={() => api.paths.openGameDir()}
          >
            <FolderIcon className={styles.folderIcon} />
            <span className={styles.folderButtonText}>{t("settings.openGameDir")}</span>
          </button>
        </div>

        <div className={styles.card}>
          <p className={styles.label}>{t("settings.openUserDataDir")}</p>
          <button
            type="button"
            className={styles.folderButton}
            onClick={() => effectiveProfileId && api.paths.openUserDataDir(effectiveProfileId)}
            disabled={!effectiveProfileId}
          >
            <FolderIcon className={styles.folderIcon} />
            <span className={styles.folderButtonText}>{t("settings.openUserDataDir")}</span>
          </button>
        </div>

        <div className={styles.card}>
          <div className={styles.memoryHeader}>
            <div className={styles.memoryInfo}>
              <p className={styles.label}>{t("settings.memoryLabel")}</p>
              <p className={styles.memoryValue}>
                {Math.round(memory / 1024)}
                <span className={styles.memoryUnit}>GB</span>
              </p>
            </div>
            <Input
              type="number"
              min={MIN_MEMORY_MB}
              max={memoryLimit}
              step={512}
              value={memory}
              onChange={(e) => updateMemory(Number(e.target.value) || MIN_MEMORY_MB)}
              className={styles.memoryInput}
            />
          </div>
          <div className={styles.memorySliderWrapper}>
            <input
              className={styles.range}
              type="range"
              min={MIN_MEMORY_MB}
              max={memoryLimit}
              step={512}
              value={memory}
              onChange={(e) => updateMemory(Number(e.target.value))}
            />
            <div className={styles.memoryLabels}>
              <span>2 GB</span>
              <span>{Math.round(memoryLimit / 1024)} GB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameTab;
