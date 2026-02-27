/**
 * Theme system types.
 * ThemeId is defined in shared for Settings/ConfigStore; re-exported here for convenience.
 */
import type { ThemeId } from "../../shared/theme";
export type { ThemeId } from "../../shared/theme";
export { THEME_IDS, isThemeId } from "../../shared/theme";

/** Semantic theme tokens used to generate full CSS variables. */
export interface Theme {
  id: ThemeId;
  name: string;
  primary: string;
  primaryStrong: string;
  secondary: string;
  secondaryStrong: string;
  background: string;
  bgElevated: string;
  bgPanel: string;
  bgMuted: string;
  text: string;
  textMuted: string;
  border: string;
  onPrimary: string;
  onSecondary: string;
}
