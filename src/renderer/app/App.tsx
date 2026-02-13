import { useState } from "react";
import { RouterProvider } from "react-router-dom";
import router from "./router";
import { ThemeProvider } from "../theme";
import { LauncherStoreProvider } from "../store/launcherStore";
import { ProfilesStoreProvider } from "../store/profilesStore";
import { I18nProvider } from "../i18n";
import UpdateBanner from "../components/UpdateBanner";
import CommunityModal from "../components/modals/CommunityModal";

const App = () => {
  const [showCommunityModal, setShowCommunityModal] = useState(true);

  return (
    <ThemeProvider>
      <I18nProvider>
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
    </I18nProvider>
    </ThemeProvider>
  );
};

export default App;
