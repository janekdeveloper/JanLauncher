import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/theme.css";
import "./styles/global.css";
import launcherBgUrl from "./assets/launcher-bg.jpg";

document.documentElement.style.setProperty(
  "--app-bg-image",
  `url("${launcherBgUrl}")`
);

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found");
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
