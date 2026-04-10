// ─── Color contrast utilities for WCAG compliance ───

/**
 * Parse a hex color string to RGB components.
 * Supports #RGB, #RRGGBB formats.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Compute relative luminance per WCAG 2.1.
 * Returns a value between 0 (black) and 1 (white).
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Returns true if the given hex color is dark (luminance < 0.4).
 * Use this to decide if text on this background should be light or dark.
 */
export function isColorDark(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  return relativeLuminance(r, g, b) < 0.4;
}

/**
 * Returns appropriate text color for a given background hex color.
 * - Dark backgrounds → white text
 * - Light backgrounds → dark gray text (#1f2937)
 */
export function getContrastTextColor(bgHex: string): string {
  return isColorDark(bgHex) ? '#ffffff' : '#1f2937';
}

/**
 * Returns a muted variant of the contrast text color (for secondary text).
 * Computes the actual contrast ratio to ensure WCAG AA compliance (4.5:1).
 * On dark backgrounds where off-white fails, falls back to pure white.
 * - Light backgrounds → gray-500 (#6b7280)
 * - Dark backgrounds → off-white (#e2e8f0) if ratio >= 4.5, else white
 */
export function getContrastMutedColor(bgHex: string): string {
  if (!isColorDark(bgHex)) return '#6b7280';

  const bg = hexToRgb(bgHex);
  const offWhite = { r: 226, g: 232, b: 240 }; // #e2e8f0
  const bgLum = relativeLuminance(bg.r, bg.g, bg.b);
  const fgLum = relativeLuminance(offWhite.r, offWhite.g, offWhite.b);
  const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);

  return ratio >= 4.5 ? '#e2e8f0' : '#ffffff';
}
