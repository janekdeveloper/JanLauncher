import { createHashRouter } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import HomePage from "../pages/HomePage";
import ModsPage from "../pages/ModsPage";
import NewsPage from "../pages/NewsPage";
import SettingsPage from "../pages/SettingsPage";
import LogsPage from "../pages/LogsPage";
import ProfilesPage from "../pages/ProfilesPage";
import GameProfilesPage from "../pages/GameProfilesPage";

const router = createHashRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "mods", element: <ModsPage /> },
      { path: "news", element: <NewsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "logs", element: <LogsPage /> },
      { path: "profiles", element: <ProfilesPage /> },
      { path: "game-profiles", element: <GameProfilesPage /> }
    ]
  }
]);

export default router;
