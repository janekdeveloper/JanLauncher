import { useEffect, useState } from "react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import { useProfilesStore } from "../store/profilesStore";
import { useI18n } from "../i18n";
import styles from "./StepGameProfile.module.css";

type StepGameProfileProps = {
  onReady: () => void;
};

const StepGameProfile = ({ onReady }: StepGameProfileProps) => {
  const { t } = useI18n();
  const {
    gameProfiles,
    gameProfilesLoading,
    loadGameProfiles,
    createGameProfile
  } = useProfilesStore();
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadGameProfiles();
  }, [loadGameProfiles]);

  useEffect(() => {
    if (!gameProfilesLoading && gameProfiles.length > 0) {
      onReady();
    }
  }, [gameProfiles, gameProfilesLoading, onReady]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setCreateError(t("onboarding.profileNamePlaceholder"));
      return;
    }
    setCreateError(null);
    setIsCreating(true);
    try {
      await createGameProfile(trimmed);
      setName("");
      onReady();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create profile");
    } finally {
      setIsCreating(false);
    }
  };

  if (gameProfilesLoading) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.loading}>{t("onboarding.loading")}</p>
      </div>
    );
  }

  if (gameProfiles.length > 0) {
    return (
      <div className={styles.wrapper}>
        <h2 className={styles.title}>{t("onboarding.gameProfileTitle")}</h2>
        <p className={styles.message}>{t("onboarding.gameProfileReady")}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>{t("onboarding.gameProfileTitle")}</h2>
      <p className={styles.intro}>{t("onboarding.gameProfileSubtitle")}</p>
      <div className={styles.section}>
        <Input
          label={t("home.gameProfileNameLabel")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setCreateError(null);
          }}
          placeholder={t("onboarding.profileNamePlaceholder")}
          error={createError || undefined}
        />
        <Button
          variant="primary"
          onClick={handleCreate}
          disabled={!name.trim() || isCreating}
          className={styles.createButton}
        >
          {isCreating ? t("onboarding.creating") : t("onboarding.createGameProfile")}
        </Button>
      </div>
    </div>
  );
};

export default StepGameProfile;
