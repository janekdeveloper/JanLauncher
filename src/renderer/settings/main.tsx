import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../theme";
import { I18nProvider } from "../i18n";
import SettingsLayout from "./SettingsLayout";
import "../styles/theme.css";
import "../styles/global.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Settings root container not found");
}

createRoot(container).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <SettingsLayout />
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);
