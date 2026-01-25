import { RouterProvider } from "react-router-dom";
import router from "./router";
import { LauncherStoreProvider } from "../store/launcherStore";
import { ProfilesStoreProvider } from "../store/profilesStore";
import { I18nProvider } from "../i18n";
import UpdateBanner from "../components/UpdateBanner";

const App = () => (
  <I18nProvider>
    <ProfilesStoreProvider>
      <LauncherStoreProvider>
        <UpdateBanner />
        <RouterProvider router={router} />
      </LauncherStoreProvider>
    </ProfilesStoreProvider>
  </I18nProvider>
);

export default App;
