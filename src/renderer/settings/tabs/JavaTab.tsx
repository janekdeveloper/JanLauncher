import { useEffect, useState } from "react";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import { useI18n } from "../../i18n";
import { useSettingsContext } from "../SettingsContext";
import { api } from "../../services/api";
import styles from "../settingsContent.module.css";

const JavaTab = () => {
  const { t } = useI18n();
  const { gameProfiles, refreshGameProfiles } = useSettingsContext();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (gameProfiles.length > 0 && selectedProfileId === null) {
      setSelectedProfileId(gameProfiles[0].id);
    }
  }, [gameProfiles, selectedProfileId]);

  const selectedProfile = selectedProfileId
    ? gameProfiles.find((p) => p.id === selectedProfileId)
    : gameProfiles[0];
  const profileOptions = gameProfiles.map((p) => ({ value: p.id, label: p.name }));

  const javaPath = selectedProfile?.javaPath ?? "";
  const jvmArgsString = selectedProfile?.gameOptions?.args?.join(" ") ?? "";

  const handleJavaPathChange = (value: string) => {
    if (!selectedProfile) return;
    const next = value.trim() || null;
    void api.gameProfiles.update(selectedProfile.id, { javaPath: next }).then(refreshGameProfiles);
  };

  const handleJvmArgsChange = (value: string) => {
    if (!selectedProfile) return;
    const args = value.trim() ? value.trim().split(/\s+/) : [];
    void api.gameProfiles.update(selectedProfile.id, {
      gameOptions: { ...selectedProfile.gameOptions, args }
    }).then(refreshGameProfiles);
  };

  return (
    <div className={styles.page}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderTitle}>
          <h2 className={styles.title}>{t("settings.tabs.java")}</h2>
          <p className={styles.subtitle}>{t("settings.javaTabHint")}</p>
          <p className={styles.labelHint}>{t("settings.javaPerProfileHint")}</p>
        </div>
        <Select<string>
          label={t("home.gameProfileLabel")}
          value={selectedProfileId}
          onChange={setSelectedProfileId}
          options={profileOptions}
          placeholder={t("home.gameProfilePlaceholder")}
          className={styles.profileSelect}
        />
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <Input
            label={t("settings.javaPathLabel")}
            value={javaPath}
            onChange={(e) => handleJavaPathChange(e.target.value)}
            placeholder={t("settings.javaPathPlaceholder")}
            disabled={!selectedProfile}
          />
        </div>

        <div className={styles.card}>
          <Input
            label={t("settings.jvmArgsLabel")}
            multiline
            rows={4}
            value={jvmArgsString}
            onChange={(e) => handleJvmArgsChange(e.target.value)}
            placeholder="-Xmx4G -Dfile.encoding=UTF-8"
            disabled={!selectedProfile}
          />
        </div>
      </div>
    </div>
  );
};

export default JavaTab;
