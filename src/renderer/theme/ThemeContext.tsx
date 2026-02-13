import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../services/api";
import { isThemeId, type ThemeId } from "./theme.types";
import { getTheme, themeToCssVariables } from "./themes";

type ThemeContextValue = {
  themeId: ThemeId;
  theme: ReturnType<typeof getTheme>;
  setTheme: (id: ThemeId) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

function applyTheme(themeId: ThemeId): void {
  const theme = getTheme(themeId);
  const vars = themeToCssVariables(theme);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>("classic");

  useEffect(() => {
    let mounted = true;
    api.settings
      .get()
      .then((settings) => {
        if (!mounted) return;
        const id = isThemeId(settings.themeId) ? settings.themeId : "classic";
        setThemeId(id);
        applyTheme(id);
      })
      .catch(() => {
        if (mounted) applyTheme("classic");
      });

    const unsubscribe = api.settings.onUpdated((patch) => {
      if (!mounted || !("themeId" in patch) || patch.themeId === undefined) return;
      const id = isThemeId(patch.themeId) ? patch.themeId : "classic";
      setThemeId(id);
      applyTheme(id);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const setTheme = useCallback(async (id: ThemeId) => {
    setThemeId(id);
    applyTheme(id);
    await api.settings.update({ themeId: id });
  }, []);

  const theme = getTheme(themeId);

  const value: ThemeContextValue = {
    themeId,
    theme,
    setTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
