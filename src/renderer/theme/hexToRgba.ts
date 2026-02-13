/**
 * Returns CSS rgba() string with space-separated components: "rgba(r g b / alpha)".
 */
export function hexToRgba(hex: string, alpha: number): string {
  const parsed = parseHex(hex);
  if (!parsed) return `rgba(0 0 0 / ${alpha})`;
  const { r, g, b } = parsed;
  return `rgba(${r} ${g} ${b} / ${alpha})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace(/^#/, "").match(/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) {
    s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  }
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return { r, g, b };
}
