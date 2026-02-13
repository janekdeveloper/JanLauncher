import { useEffect, useState } from "react";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import { useProfilesStore } from "../store/profilesStore";
import { useI18n } from "../i18n";
import { api } from "../services/api";
import type { AuthProviderId } from "../../main/core/auth/auth.types";
import type { AuthProviderInfo } from "../../main/core/auth/auth.types";
import { AccountState } from "../../main/core/auth/auth.types";
import styles from "./StepAccount.module.css";

type StepAccountProps = {
  onReady: () => void;
};

const StepAccount = ({ onReady }: StepAccountProps) => {
  const { t } = useI18n();
  const {
    playerProfiles,
    playerProfilesLoading,
    loadPlayerProfiles,
    createPlayerProfile
  } = useProfilesStore();
  const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([]);
  const [nickname, setNickname] = useState("");
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<AuthProviderId | null>(null);
  const [loginState, setLoginState] = useState<"idle" | "waiting" | "success" | "error">("idle");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const hasProfile = playerProfiles.length > 0;
  const profileToUse = createdProfileId
    ? playerProfiles.find((p) => p.id === createdProfileId) ?? playerProfiles[0]
    : playerProfiles[0];
  const hasAuth = Boolean(
    profileToUse?.authTokens?.identityToken && profileToUse?.authTokens?.sessionToken
  );

  useEffect(() => {
    loadPlayerProfiles();
    api.auth.getProviders().then(setAuthProviders).catch(() => setAuthProviders([]));
  }, [loadPlayerProfiles]);

  useEffect(() => {
    if (playerProfilesLoading || playerProfiles.length === 0) return;
    const hasValidAccount = playerProfiles.some(
      (p) => p.authTokens?.identityToken && p.authTokens?.sessionToken
    );
    if (hasValidAccount) {
      onReady();
      return;
    }
    api.auth
      .validateAccount(playerProfiles[0].id)
      .then((result) => {
        if (result.state === AccountState.VALID && result.canLaunch) {
          loadPlayerProfiles();
          onReady();
        }
      })
      .catch(() => {});
  }, [playerProfiles, playerProfilesLoading, onReady, loadPlayerProfiles]);

  useEffect(() => {
    if (
      hasProfile &&
      !hasAuth &&
      authProviders.length > 0 &&
      !selectedProviderId
    ) {
      const first = authProviders.find((p) => p.isAvailable);
      if (first) setSelectedProviderId(first.id as AuthProviderId);
    }
  }, [hasProfile, hasAuth, authProviders, selectedProviderId]);

  const handleCreateProfile = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setCreateError(t("onboarding.nicknamePlaceholder"));
      return;
    }
    setCreateError(null);
    try {
      const created = await createPlayerProfile(
        trimmed,
        selectedProviderId ?? undefined
      );
      setCreatedProfileId(created.id);
      if (!selectedProviderId) {
        const firstAvailable = authProviders.find((p) => p.isAvailable);
        if (firstAvailable) setSelectedProviderId(firstAvailable.id as AuthProviderId);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create profile");
    }
  };

  const handleLogin = async () => {
    const profileId = createdProfileId ?? playerProfiles[0]?.id;
    const providerId = selectedProviderId;
    if (!profileId || !providerId) return;
    const profile = playerProfiles.find((p) => p.id === profileId) ?? { id: profileId, nickname: "" };
    setLoginError(null);
    setLoginState("waiting");
    try {
      await api.auth.login(profileId, providerId, {
        uuid: profile.id,
        username: profile.nickname || "Player"
      });
      setLoginState("success");
      await loadPlayerProfiles();
      onReady();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
      setLoginState("error");
    }
  };

  const needsLogin = hasProfile && !hasAuth;

  if (playerProfilesLoading) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.loading}>{t("onboarding.loading")}</p>
      </div>
    );
  }

  if (hasProfile && hasAuth) {
    return (
      <div className={styles.wrapper}>
        <h2 className={styles.title}>{t("onboarding.accountTitle")}</h2>
        <p className={styles.message}>{t("onboarding.accountReady")}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>{t("onboarding.accountTitle")}</h2>
      <p className={styles.intro}>{t("onboarding.accountSubtitle")}</p>

      {!hasProfile && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>{t("onboarding.chooseAuthSystem")}</p>
          <div className={styles.providerList}>
            {authProviders
              .filter((p) => p.isAvailable)
              .map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={`${styles.providerButton} ${selectedProviderId === provider.id ? styles.providerButtonActive : ""}`}
                  onClick={() => setSelectedProviderId(provider.id as AuthProviderId)}
                >
                  <span className={styles.providerName}>{provider.displayName}</span>
                  <span className={styles.providerDomain}>{provider.authDomain}</span>
                </button>
              ))}
            {authProviders.filter((p) => p.isAvailable).length === 0 && (
              <p className={styles.noProviders}>{t("onboarding.noAuthProviders")}</p>
            )}
          </div>
          <Input
            label={t("onboarding.nicknameLabel")}
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setCreateError(null);
            }}
            placeholder={t("onboarding.nicknamePlaceholder")}
            error={createError || undefined}
          />
          <Button
            variant="primary"
            onClick={handleCreateProfile}
            disabled={!nickname.trim()}
            className={styles.createButton}
          >
            {t("onboarding.createProfile")}
          </Button>
        </div>
      )}

      {needsLogin && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>{t("onboarding.signInWith")}</p>
          <div className={styles.providerList}>
            {authProviders
              .filter((p) => p.isAvailable)
              .map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={`${styles.providerButton} ${selectedProviderId === provider.id ? styles.providerButtonActive : ""}`}
                  onClick={() => setSelectedProviderId(provider.id as AuthProviderId)}
                >
                  <span className={styles.providerName}>{provider.displayName}</span>
                  <span className={styles.providerDomain}>{provider.authDomain}</span>
                </button>
              ))}
            {authProviders.filter((p) => p.isAvailable).length === 0 && (
              <p className={styles.noProviders}>{t("onboarding.noAuthProviders")}</p>
            )}
          </div>
          {loginState === "error" && loginError && (
            <p className={styles.loginError}>{loginError}</p>
          )}
          <Button
            variant="primary"
            onClick={handleLogin}
            disabled={!selectedProviderId || loginState === "waiting"}
            className={styles.loginButton}
          >
            {loginState === "waiting"
              ? t("onboarding.signingIn")
              : loginState === "success"
                ? t("onboarding.signedIn")
                : t("onboarding.signIn")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default StepAccount;
