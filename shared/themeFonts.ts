export type ThemeFontRole =
  | 'display'
  | 'reading'
  | 'ui'
  | 'technical'
  | 'cjk'
  | 'calligraphic'
  | 'brand';

export function themeFontFamily(role: ThemeFontRole): string {
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue(`--font-${role}`)
    .trim();

  if (!family) throw new Error(`Missing theme font role: --font-${role}`);
  return family;
}

export function themeCanvasFont(
  styleAndWeight: string,
  size: number,
  role: ThemeFontRole,
): string {
  return `${styleAndWeight} ${size}px ${themeFontFamily(role)}`;
}
