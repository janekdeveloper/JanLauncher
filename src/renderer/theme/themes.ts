import type { ColorScheme } from "../../shared/theme";
import type { Theme } from "./theme.types";
import { hexToRgba } from "./hexToRgba";

/** Classic: light blue primary, emerald secondary (current default). */
const classic: Theme = {
  id: "classic",
  name: "Classic",
  primary: "#86d4ff",
  primaryStrong: "#6ac6ff",
  secondary: "#46ddb0",
  secondaryStrong: "#36c89b",
  background: "#151c26",
  bgElevated: "#1b2533",
  bgPanel: "#202c3d",
  bgMuted: "#182130",
  text: "#eef3fb",
  textMuted: "#a8b6cc",
  border: "#2f3d55",
  onPrimary: "#08121c",
  onSecondary: "#062017"
};

/** Green: green primary, dark emerald secondary. */
const green: Theme = {
  id: "green",
  name: "Green",
  primary: "#6ee7b7",
  primaryStrong: "#34d399",
  secondary: "#059669",
  secondaryStrong: "#047857",
  background: "#0f1419",
  bgElevated: "#151d23",
  bgPanel: "#1a252e",
  bgMuted: "#131b22",
  text: "#ecfdf5",
  textMuted: "#a7f3d0",
  border: "#1e3a2f",
  onPrimary: "#052e16",
  onSecondary: "#ecfdf5"
};

/** Purple: violet primary, lavender secondary. */
const purple: Theme = {
  id: "purple",
  name: "Purple",
  primary: "#c4b5fd",
  primaryStrong: "#a78bfa",
  secondary: "#a78bfa",
  secondaryStrong: "#8b5cf6",
  background: "#1a1625",
  bgElevated: "#221c30",
  bgPanel: "#2a2340",
  bgMuted: "#15121f",
  text: "#f5f3ff",
  textMuted: "#ddd6fe",
  border: "#3b3561",
  onPrimary: "#2e1065",
  onSecondary: "#f5f3ff"
};

/** Red: red primary, dark red secondary. */
const red: Theme = {
  id: "red",
  name: "Red",
  primary: "#fca5a5",
  primaryStrong: "#f87171",
  secondary: "#dc2626",
  secondaryStrong: "#b91c1c",
  background: "#1c1515",
  bgElevated: "#261c1c",
  bgPanel: "#302424",
  bgMuted: "#161212",
  text: "#fef2f2",
  textMuted: "#fecaca",
  border: "#4a2c2c",
  onPrimary: "#450a0a",
  onSecondary: "#fef2f2"
};

/** Yellow: yellow primary, amber secondary. */
const yellow: Theme = {
  id: "yellow",
  name: "Yellow",
  primary: "#fde047",
  primaryStrong: "#facc15",
  secondary: "#eab308",
  secondaryStrong: "#ca8a04",
  background: "#1c1912",
  bgElevated: "#252018",
  bgPanel: "#2e281e",
  bgMuted: "#161410",
  text: "#fefce8",
  textMuted: "#fef08a",
  border: "#3d3520",
  onPrimary: "#422006",
  onSecondary: "#1c1912"
};

export const themes: Record<Theme["id"], Theme> = {
  classic,
  green,
  purple,
  red,
  yellow
};

/** Light variants: soft, muted backgrounds to avoid harsh white. */
const classicLight: Theme = {
  ...classic,
  background: "#c8d6e2",
  bgElevated: "#b8c9d8",
  bgPanel: "#a8bccf",
  bgMuted: "#d4dde6",
  text: "#1e293b",
  textMuted: "#475569",
  border: "#7a9bb5",
  onPrimary: "#e0f2fe",
  onSecondary: "#ecfdf5"
};

const greenLight: Theme = {
  ...green,
  background: "#b8d4c4",
  bgElevated: "#a5c7b4",
  bgPanel: "#92baa4",
  bgMuted: "#c8ddd0",
  text: "#14532d",
  textMuted: "#166534",
  border: "#5a9b76",
  onPrimary: "#ecfdf5",
  onSecondary: "#052e16"
};

const purpleLight: Theme = {
  ...purple,
  background: "#c9c4dc",
  bgElevated: "#b8b0ce",
  bgPanel: "#a79ec0",
  bgMuted: "#d6d2e4",
  text: "#3730a3",
  textMuted: "#5b21b6",
  border: "#8b7cb8",
  onPrimary: "#f5f3ff",
  onSecondary: "#2e1065"
};

const redLight: Theme = {
  ...red,
  background: "#dcc8c8",
  bgElevated: "#cfb8b8",
  bgPanel: "#c2a8a8",
  bgMuted: "#e2d6d6",
  text: "#7f1d1d",
  textMuted: "#991b1b",
  border: "#b87c7c",
  onPrimary: "#fef2f2",
  onSecondary: "#450a0a"
};

const yellowLight: Theme = {
  ...yellow,
  background: "#d4cfb8",
  bgElevated: "#c4bea0",
  bgPanel: "#b4ad88",
  bgMuted: "#e0dcc8",
  text: "#422006",
  textMuted: "#713f12",
  border: "#a89b4e",
  onPrimary: "#fefce8",
  onSecondary: "#422006"
};

const themesLight: Record<Theme["id"], Theme> = {
  classic: classicLight,
  green: greenLight,
  purple: purpleLight,
  red: redLight,
  yellow: yellowLight
};

export function getTheme(id: Theme["id"], colorScheme: ColorScheme = "dark"): Theme {
  return colorScheme === "light" ? themesLight[id] : themes[id];
}

/**
 * Converts a theme to the full set of CSS custom properties.
 * Derives glow and glass tokens from primary/secondary.
 * For light scheme uses dark overlays and dark toggle thumb.
 */
export function themeToCssVariables(theme: Theme, isLight: boolean = false): Record<string, string> {
  const primaryGlow = hexToRgba(theme.primary, 0.25);
  const secondaryGlow = hexToRgba(theme.secondary, 0.25);
  const glassBorder = hexToRgba(theme.primary, isLight ? 0.35 : 0.28);
  const glassHighlight = hexToRgba(theme.primary, isLight ? 0.22 : 0.18);
  const glassPanel = hexToRgba(theme.background, 0.88);
  const glassGradientPrimary = hexToRgba(theme.primary, isLight ? 0.22 : 0.18);
  const glassGradientSecondary = hexToRgba(theme.secondary, isLight ? 0.15 : 0.12);
  const shadowGlassBorder = hexToRgba(theme.primary, 0.15);
  const appOverlay = hexToRgba(theme.background, 0.55);

  return {
    "--color-bg": theme.background,
    "--color-bg-elevated": theme.bgElevated,
    "--color-bg-panel": theme.bgPanel,
    "--color-bg-muted": theme.bgMuted,
    "--color-text": theme.text,
    "--color-text-muted": theme.textMuted,
    "--color-border": theme.border,
    "--color-primary": theme.primary,
    "--color-primary-strong": theme.primaryStrong,
    "--color-primary-glow": primaryGlow,
    "--color-secondary": theme.secondary,
    "--color-secondary-strong": theme.secondaryStrong,
    "--color-secondary-glow": secondaryGlow,
    "--color-danger": "#ff7a86",
    "--color-danger-strong": "#ee6271",
    "--color-danger-glow": "rgba(255 122 134 / 0.25)",
    "--color-danger-subtle": "rgba(255 122 134 / 0.1)",
    "--color-on-danger": "#1a0b0e",
    "--color-warning": "#f3c78a",
    "--color-success": theme.secondary,
    "--color-on-primary": theme.onPrimary,
    "--color-on-secondary": theme.onSecondary,
    "--color-overlay": isLight ? "rgba(0 0 0 / 0.5)" : "rgba(8 12 18 / 0.7)",
    "--color-log-info": theme.primary,
    "--color-log-warn": "#f3c78a",
    "--color-log-error": "#ff7a86",
    "--color-log-debug": "#8aa4ff",
    "--color-app-overlay": appOverlay,
    "--color-glass-panel": glassPanel,
    "--color-glass-border": glassBorder,
    "--color-glass-highlight": glassHighlight,
    "--color-glass-gradient": `linear-gradient(135deg, ${glassGradientPrimary}, ${glassGradientSecondary})`,
    "--shadow-soft": isLight ? "0 20px 50px rgba(0 0 0 / 0.12)" : "0 20px 50px rgba(5 10 20 / 0.4)",
    "--shadow-elevated": isLight ? "0 12px 30px rgba(0 0 0 / 0.1)" : "0 12px 30px rgba(5 10 20 / 0.28)",
    "--shadow-subtle": isLight ? "0 4px 12px rgba(0 0 0 / 0.08)" : "0 4px 12px rgba(5 10 20 / 0.25)",
    "--shadow-inset": "inset 0 1px 3px rgba(0 0 0 / 0.2)",
    "--shadow-glass": `0 18px 40px rgba(5 10 20 / 0.38), 0 0 0 1px ${shadowGlassBorder}`,
    "--color-bg-gradient-start": hexToRgba(theme.background, 0.8),
    "--color-bg-gradient-mid": hexToRgba(theme.background, 0.72),
    "--color-bg-gradient-end": hexToRgba(theme.background, 0.9),
    "--color-surface-overlay": isLight ? "rgba(0 0 0 / 0.04)" : "rgba(255 255 255 / 0.06)",
    "--color-border-overlay": isLight ? "rgba(0 0 0 / 0.08)" : "rgba(255 255 255 / 0.08)",
    "--color-border-overlay-strong": isLight ? "rgba(0 0 0 / 0.14)" : "rgba(255 255 255 / 0.16)",
    "--color-surface-highlight": isLight ? "rgba(0 0 0 / 0.06)" : "rgba(255 255 255 / 0.15)",
    "--color-surface-highlight-strong": isLight ? "rgba(0 0 0 / 0.1)" : "rgba(255 255 255 / 0.2)",
    "--color-toggle-thumb": isLight ? "#1e293b" : "#ffffff"
  };
}
