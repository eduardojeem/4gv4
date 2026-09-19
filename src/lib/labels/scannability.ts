import { detectBarcodeFormat, type BarcodeFormat } from './barcode-format'
import type { LabelLayout } from './label-layouts'

/**
 * Si las barras van a salir lo bastante anchas para que el lector las tome.
 *
 * Cuanto más largo el código, más módulos hay que meter en el mismo ancho de
 * etiqueta, y más finas salen las barras. Con los datos de hoy, 132 de 351
 * productos imprimen en el rollo de 50 × 25 con barras por debajo de 0,19 mm
 * —el SKU autogenerado tiene 18 caracteres o más— y así no los lee nadie.
 */

/** Ancho mínimo de la barra fina que recomienda GS1 para mostrador. */
export const RECOMMENDED_MODULE_MM = 0.25
/** Por debajo de esto, casi ningún lector lo toma. */
export const MIN_MODULE_MM = 0.19
/** Lo que se pierde en el borde de la etiqueta (el relleno de cada lado). */
const LABEL_PADDING_MM = 2

/**
 * Módulos que ocupa el código dibujado.
 *
 * Code 128: 11 por carácter, más 35 entre arranque, verificador y cierre.
 * EAN-13 y UPC son 95 fijos; EAN-8, 67.
 */
export function barcodeModules(value: string, format: BarcodeFormat): number {
  switch (format) {
    case 'EAN13':
    case 'UPC':
      return 95
    case 'EAN8':
      return 67
    case 'CODE128':
    default:
      return 11 * value.length + 35
  }
}

export type ScanLevel = 'ok' | 'tight' | 'risky'

export type ScanRating = {
  moduleMm: number
  level: ScanLevel
  modules: number
}

/** Cuánto mide la barra fina de este código en esta etiqueta. */
export function rateScannability(
  value: string,
  layout: LabelLayout,
  format?: BarcodeFormat,
): ScanRating | null {
  const code = (value ?? '').trim()
  const resolved = format ?? detectBarcodeFormat(code)
  if (!code || !resolved) return null

  const modules = barcodeModules(code, resolved)
  const usableMm = Math.max(1, layout.labelWidthMm - LABEL_PADDING_MM)
  const moduleMm = usableMm / modules

  return {
    modules,
    moduleMm,
    level: moduleMm < MIN_MODULE_MM ? 'risky' : moduleMm < RECOMMENDED_MODULE_MM ? 'tight' : 'ok',
  }
}

/**
 * El formato más chico de la lista donde este código sí se lee. Sirve para
 * ofrecer una salida cuando el elegido le queda corto.
 */
export function smallestLayoutThatFits(
  value: string,
  layouts: readonly LabelLayout[],
  format?: BarcodeFormat,
): LabelLayout | null {
  const candidates = layouts
    .map((layout) => ({ layout, rating: rateScannability(value, layout, format) }))
    .filter((item): item is { layout: LabelLayout; rating: ScanRating } => item.rating !== null)
    .filter((item) => item.rating.level === 'ok')
    .sort((a, b) => a.layout.labelWidthMm - b.layout.labelWidthMm)

  return candidates[0]?.layout ?? null
}

/** Cuántos caracteres entran en esta etiqueta sin bajar del mínimo legible. */
export function maxCode128Length(layout: LabelLayout, minModuleMm = MIN_MODULE_MM): number {
  const usableMm = Math.max(1, layout.labelWidthMm - LABEL_PADDING_MM)
  const modules = Math.floor(usableMm / minModuleMm)
  return Math.max(0, Math.floor((modules - 35) / 11))
}
