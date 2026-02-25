import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { isThemeId, type ThemeId } from "./theme.types";
import type { ColorScheme } from "../../shared/theme";
import { getTheme, themeToCssVariables } from "./themes";

type ThemeContextValue = {
  themeId: ThemeId;
  theme: ReturnType<typeof getTheme>;
  colorScheme: ColorScheme;
  setTheme: (id: ThemeId) => Promise<void>;
  setColorScheme: (scheme: ColorScheme) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

function isColorScheme(value: unknown): value is ColorScheme {
  return value === "light" || value === "dark";
}

function applyTheme(themeId: ThemeId, colorScheme: ColorScheme): void {
  const theme = getTheme(themeId, colorScheme);
  const isLight = colorScheme === "light";
  const vars = themeToCssVariables(theme, isLight);
  const root = document.documentElement;
  root.setAttribute("data-color-scheme", colorScheme);
  root.style.colorScheme = colorScheme;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>("classic");
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("dark");
  const themeIdRef = useRef(themeId);
  const colorSchemeRef = useRef(colorScheme);
  themeIdRef.current = themeId;
  colorSchemeRef.current = colorScheme;

  useEffect(() => {
    let mounted = true;
    api.settings
      .get()
      .then((settings) => {
        if (!mounted) return;
        const id = isThemeId(settings.themeId) ? settings.themeId : "classic";
        const scheme = isColorScheme(settings.colorScheme) ? settings.colorScheme : "dark";
        setThemeId(id);
        setColorSchemeState(scheme);
        applyTheme(id, scheme);
      })
      .catch(() => {
        if (mounted) applyTheme("classic", "dark");
      });

    const unsubscribe = api.settings.onUpdated((patch) => {
      if (!mounted) return;
      const id = "themeId" in patch && patch.themeId !== undefined
        ? (isThemeId(patch.themeId) ? patch.themeId : themeIdRef.current)
        : themeIdRef.current;
      const scheme = "colorScheme" in patch && patch.colorScheme !== undefined
        ? (isColorScheme(patch.colorScheme) ? patch.colorScheme : colorSchemeRef.current)
        : colorSchemeRef.current;
      setThemeId(id);
      setColorSchemeState(scheme);
      applyTheme(id, scheme);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const setTheme = useCallback(async (id: ThemeId) => {
    setThemeId(id);
    applyTheme(id, colorScheme);
    await api.settings.update({ themeId: id });
  }, [colorScheme]);

  const setColorScheme = useCallback(async (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    applyTheme(themeId, scheme);
    await api.settings.update({ colorScheme: scheme });
  }, [themeId]);

  const theme = getTheme(themeId, colorScheme);

  const value: ThemeContextValue = {
    themeId,
    theme,
    colorScheme,
    setTheme,
    setColorScheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
