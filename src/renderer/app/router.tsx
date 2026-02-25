import { createHashRouter } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import HomePage from "../pages/HomePage";
import AboutPage from "../pages/AboutPage";
import ModsPage from "../pages/ModsPage";
import NewsPage from "../pages/NewsPage";
import CatalogPage from "../pages/CatalogPage";
import LogsPage from "../pages/LogsPage";
import ProfilesPage from "../pages/ProfilesPage";
import GameProfilesPage from "../pages/GameProfilesPage";

const router = createHashRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: <AboutPage /> },
      { path: "mods", element: <ModsPage /> },
      { path: "news", element: <NewsPage /> },
      { path: "catalog", element: <CatalogPage /> },
      { path: "logs", element: <LogsPage /> },
      { path: "profiles", element: <ProfilesPage /> },
      { path: "game-profiles", element: <GameProfilesPage /> }
    ]
  }
]);

export default router;
