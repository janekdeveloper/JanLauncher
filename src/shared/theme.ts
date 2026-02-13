/** Theme identifier; must match renderer theme definitions and ConfigStore validation. */
export type ThemeId = "classic" | "green" | "purple" | "red" | "yellow";

export const THEME_IDS: readonly ThemeId[] = [
  "classic",
  "green",
  "purple",
  "red",
  "yellow"
] as const;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}
