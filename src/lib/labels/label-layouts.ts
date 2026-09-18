/**
 * Los formatos de etiqueta que se pueden imprimir.
 *
 * Son dos mundos distintos y conviene no mezclarlos: la impresora térmica saca
 * una etiqueta por vez de un rollo continuo (el alto del papel es el alto de la
 * etiqueta), y la hoja A4 trae una grilla de etiquetas autoadhesivas donde lo
 * que importa es que cada celda caiga exactamente sobre su adhesivo.
 */

export type LabelMedia = 'thermal' | 'sheet'

export type LabelLayout = {
  id: string
  label: string
  media: LabelMedia
  /** Cuándo conviene este formato, en una frase. */
  hint: string
  pageWidthMm: number
  /** `null` en un rollo continuo: el papel no tiene largo fijo. */
  pageHeightMm: number | null
  marginXMm: number
  marginYMm: number
  columns: number
  /** `null` en un rollo: no hay filas por hoja. */
  rows: number | null
  labelWidthMm: number
  labelHeightMm: number
  gapXMm: number
  gapYMm: number
  /** Alto de las barras. Menos de 10 mm ya cuesta que el lector lo tome. */
  barcodeHeightMm: number
  /**
   * Etiqueta chica: entra el código y el precio, no una descripción larga.
   * La pantalla usa esto para avisar antes de imprimir 200 etiquetas cortadas.
   */
  compact?: boolean
}

export const LABEL_LAYOUTS: LabelLayout[] = [
  {
    id: 'termica-50x25',
    label: 'Rollo térmico 50 × 25 mm',
    media: 'thermal',
    hint: 'El más común para góndola y estante. Una etiqueta por vez.',
    pageWidthMm: 50,
    pageHeightMm: 25,
    marginXMm: 2,
    marginYMm: 1.5,
    columns: 1,
    rows: null,
    labelWidthMm: 46,
    labelHeightMm: 22,
    gapXMm: 0,
    gapYMm: 0,
    barcodeHeightMm: 10,
    compact: true,
  },
  {
    id: 'termica-40x30',
    label: 'Rollo térmico 40 × 30 mm',
    media: 'thermal',
    hint: 'Etiqueta angosta y alta: entra el nombre en dos líneas.',
    pageWidthMm: 40,
    pageHeightMm: 30,
    marginXMm: 2,
    marginYMm: 2,
    columns: 1,
    rows: null,
    labelWidthMm: 36,
    labelHeightMm: 26,
    gapXMm: 0,
    gapYMm: 0,
    barcodeHeightMm: 11,
    compact: true,
  },
  {
    id: 'termica-60x40',
    label: 'Rollo térmico 60 × 40 mm',
    media: 'thermal',
    hint: 'La más cómoda de leer: nombre completo, precio grande y código.',
    pageWidthMm: 60,
    pageHeightMm: 40,
    marginXMm: 3,
    marginYMm: 2.5,
    columns: 1,
    rows: null,
    labelWidthMm: 54,
    labelHeightMm: 35,
    gapXMm: 0,
    gapYMm: 0,
    barcodeHeightMm: 14,
  },
  {
    id: 'termica-80mm',
    label: 'Impresora de tickets 80 mm',
    media: 'thermal',
    hint: 'Para quien solo tiene la impresora del POS: sale una tira de etiquetas para cortar.',
    pageWidthMm: 80,
    pageHeightMm: null,
    marginXMm: 4,
    marginYMm: 3,
    columns: 1,
    rows: null,
    labelWidthMm: 72,
    labelHeightMm: 32,
    gapXMm: 0,
    gapYMm: 3,
    barcodeHeightMm: 13,
  },
  {
    id: 'a4-24',
    label: 'Hoja A4 — 24 etiquetas (70 × 37 mm)',
    media: 'sheet',
    hint: '3 columnas × 8 filas. El pliego autoadhesivo más vendido.',
    pageWidthMm: 210,
    pageHeightMm: 297,
    marginXMm: 0,
    marginYMm: 0.5,
    columns: 3,
    rows: 8,
    labelWidthMm: 70,
    labelHeightMm: 37,
    gapXMm: 0,
    gapYMm: 0,
    barcodeHeightMm: 13,
  },
  {
    id: 'a4-40',
    label: 'Hoja A4 — 40 etiquetas (52,5 × 29,7 mm)',
    media: 'sheet',
    hint: '4 columnas × 10 filas. Rinde más por hoja, con menos lugar para el nombre.',
    pageWidthMm: 210,
    pageHeightMm: 297,
    marginXMm: 0,
    marginYMm: 0,
    columns: 4,
    rows: 10,
    labelWidthMm: 52.5,
    labelHeightMm: 29.7,
    gapXMm: 0,
    gapYMm: 0,
    barcodeHeightMm: 11,
    compact: true,
  },
  {
    id: 'a4-14',
    label: 'Hoja A4 — 14 etiquetas (99,1 × 38,1 mm)',
    media: 'sheet',
    hint: '2 columnas × 7 filas. Etiqueta grande, para productos con nombre largo.',
    pageWidthMm: 210,
    pageHeightMm: 297,
    marginXMm: 5.9,
    marginYMm: 15.1,
    columns: 2,
    rows: 7,
    labelWidthMm: 99.1,
    labelHeightMm: 38.1,
    gapXMm: 0,
    gapYMm: 0,
    barcodeHeightMm: 14,
  },
]

export const DEFAULT_LABEL_LAYOUT_ID = 'termica-50x25'

export function layoutById(id: string | null | undefined): LabelLayout | undefined {
  return LABEL_LAYOUTS.find((layout) => layout.id === id)
}

export function layoutOrDefault(id: string | null | undefined): LabelLayout {
  return layoutById(id) ?? layoutById(DEFAULT_LABEL_LAYOUT_ID)!
}

/** Cuántas etiquetas entran en una hoja. `null` en un rollo continuo. */
export function labelsPerPage(layout: LabelLayout): number | null {
  if (layout.rows === null) return null
  return layout.columns * layout.rows
}

/** Cuántas hojas se van a gastar, para avisarlo antes de imprimir. */
export function sheetsNeeded(layout: LabelLayout, labelCount: number): number {
  const perPage = labelsPerPage(layout)
  if (!perPage || labelCount <= 0) return 0
  return Math.ceil(labelCount / perPage)
}

/** Parte las etiquetas en hojas, para meter el salto de página entre una y otra. */
export function paginateLabels<T>(items: readonly T[], layout: LabelLayout): T[][] {
  const perPage = labelsPerPage(layout)
  if (!perPage) return [[...items]]

  const pages: T[][] = []
  for (let index = 0; index < items.length; index += perPage) {
    pages.push(items.slice(index, index + perPage))
  }
  return pages
}
