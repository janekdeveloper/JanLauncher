import { useEffect, useState } from "react";
import { RouterProvider } from "react-router-dom";
import router from "./router";
import { ThemeProvider } from "../theme";
import { LauncherStoreProvider } from "../store/launcherStore";
import { ProfilesStoreProvider } from "../store/profilesStore";
import { I18nProvider } from "../i18n";
import UpdateBanner from "../components/UpdateBanner";
import CommunityModal from "../components/modals/CommunityModal";
import OnboardingLayout from "../onboarding/OnboardingLayout";
import { api } from "../services/api";
import { useI18n } from "../i18n";
import styles from "./App.module.css";

type OnboardingStatus = "loading" | "required" | "completed";

const LoadingScreen = () => {
  const { t } = useI18n();
  return (
    <div className={styles.loadingScreen} aria-busy="true">
      <div className={styles.loadingSpinner} />
      <span className={styles.loadingText}>{t("onboarding.loading")}</span>
    </div>
  );
};

const App = () => {
  const [onboardingStatus, setOnboardingStatus] =
    useState<OnboardingStatus>("loading");
  const [showCommunityModal, setShowCommunityModal] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.settings
      .get()
      .then(async (settings) => {
        if (cancelled) return;
        if (settings.hasCompletedOnboarding === true) {
          setOnboardingStatus("completed");
          return;
        }
        const [players, games] = await Promise.all([
          api.playerProfiles.list(),
          api.gameProfiles.list()
        ]).catch(() => [[], []] as const);
        if (cancelled) return;
        if (players.length > 0 && games.length > 0) {
          await api.settings.update({ hasCompletedOnboarding: true });
          if (cancelled) return;
          setOnboardingStatus("completed");
          return;
        }
        setOnboardingStatus("required");
      })
      .catch(() => {
        if (cancelled) return;
        setOnboardingStatus("required");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOnboardingComplete = () => {
    api.settings
      .update({ hasCompletedOnboarding: true })
      .then(() => setOnboardingStatus("completed"))
      .catch(() => {});
  };

  return (
    <ThemeProvider>
      <I18nProvider>
        {onboardingStatus === "loading" && (
          <LoadingScreen />
        )}
        {onboardingStatus === "required" && (
          <ProfilesStoreProvider>
            <OnboardingLayout onComplete={handleOnboardingComplete} />
          </ProfilesStoreProvider>
        )}
        {onboardingStatus === "completed" && (
          <ProfilesStoreProvider>
            <LauncherStoreProvider>
              <UpdateBanner />
              {showCommunityModal && (
                <CommunityModal
                  isOpen={showCommunityModal}
                  onClose={() => setShowCommunityModal(false)}
                />
              )}
              <RouterProvider router={router} />
            </LauncherStoreProvider>
          </ProfilesStoreProvider>
        )}
      </I18nProvider>
    </ThemeProvider>
  );
};

export default App;
