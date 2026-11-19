export const PANEL_STYLES = ['neutral', 'tinted', 'contrast'] as const
export type PanelStyle = typeof PANEL_STYLES[number]
export const DEFAULT_PANEL_STYLE: PanelStyle = 'neutral'
export function normalizePanelStyle(value: unknown): PanelStyle {
  return PANEL_STYLES.includes(value as PanelStyle) ? value as PanelStyle : DEFAULT_PANEL_STYLE
}
export function readAppearancePreference(key: string): string | null {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key) }
  catch { return null }
}
