export const BRAND_HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function isValidBrandHexColor(value?: string): boolean {
  return Boolean(value && BRAND_HEX_COLOR_PATTERN.test(value))
}
