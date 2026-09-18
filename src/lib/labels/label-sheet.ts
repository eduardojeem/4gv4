import { formatCurrency } from '@/lib/currency'
import { barcodeSvgMarkup } from './barcode-svg'
import { resolveLabelCode } from './barcode-format'
import { paginateLabels, type LabelLayout } from './label-layouts'

/**
 * Arma la hoja de etiquetas: un documento imprimible y nada más.
 *
 * El HTML se construye como texto para que se pueda probar sin abrir una
 * ventana, que es lo único que no se puede verificar de una impresión.
 */

export type LabelProduct = {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
  price?: number | null
  /** Cuántas etiquetas de este producto. Una, si no se dice otra cosa. */
  quantity?: number
}

export type LabelFields = {
  showName: boolean
  showPrice: boolean
  /** El número debajo de las barras: sirve para tipearlo cuando el lector falla. */
  showCode: boolean
  showSku: boolean
  /** Nombre del negocio arriba de la etiqueta. */
  storeName?: string | null
  /** Borde punteado para probar la alineación en papel común antes de gastar el pliego. */
  showGuides?: boolean
}

export type PreparedLabel = {
  productId: string
  name: string
  priceLabel: string | null
  code: string | null
  sku: string | null
  barcodeSvg: string | null
}

/** Tope de seguridad: nadie quiso imprimir mil etiquetas de una sola vez. */
export const MAX_LABELS = 500

export type PreparedSheet = {
  labels: PreparedLabel[]
  /** Productos sin código de barras ni SKU: no se les puede hacer etiqueta. */
  withoutCode: string[]
  /** Se cortó en `MAX_LABELS`. */
  truncated: boolean
}

const clampQuantity = (quantity: number | undefined): number => {
  if (!Number.isFinite(quantity ?? 1)) return 1
  return Math.min(Math.max(Math.trunc(quantity ?? 1), 0), MAX_LABELS)
}

/**
 * Convierte los productos elegidos en etiquetas concretas, repitiendo cada una
 * tantas veces como se pidió. El dibujo del código se hace una vez por producto
 * aunque se impriman veinte etiquetas iguales.
 */
export async function prepareLabels(
  products: readonly LabelProduct[],
  layout: LabelLayout,
): Promise<PreparedSheet> {
  const labels: PreparedLabel[] = []
  const withoutCode: string[] = []
  let truncated = false

  // El alto en mm se convierte a píxeles del SVG; la hoja lo reescala igual,
  // pero con un alto parecido al final las barras salen nítidas.
  const heightPx = Math.round(layout.barcodeHeightMm * 3.78)

  for (const product of products) {
    const requested = Number.isFinite(product.quantity ?? 1) ? Math.trunc(product.quantity ?? 1) : 1
    const quantity = clampQuantity(product.quantity)
    // Pedir 600 etiquetas de un producto también es quedarse corto: se avisa
    // igual que cuando el tope se alcanza sumando varios productos.
    if (quantity < requested) truncated = true
    if (quantity === 0) continue

    const resolved = resolveLabelCode(product)
    if (!resolved) {
      withoutCode.push(product.name)
      continue
    }

    const barcodeSvg = await barcodeSvgMarkup(resolved.value, {
      format: resolved.format,
      heightPx,
    })

    const label: PreparedLabel = {
      productId: product.id,
      name: product.name,
      priceLabel: typeof product.price === 'number' && product.price > 0 ? formatCurrency(product.price) : null,
      code: resolved.value,
      sku: product.sku?.trim() || null,
      barcodeSvg,
    }

    for (let copy = 0; copy < quantity; copy += 1) {
      if (labels.length >= MAX_LABELS) {
        truncated = true
        break
      }
      labels.push(label)
    }

    if (truncated) break
  }

  return { labels, withoutCode, truncated }
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const mm = (value: number): string => `${Number(value.toFixed(2))}mm`

function labelHtml(label: PreparedLabel, layout: LabelLayout, fields: LabelFields): string {
  const parts: string[] = []

  if (fields.storeName?.trim() && !layout.compact) {
    parts.push(`<div class="store">${escapeHtml(fields.storeName.trim())}</div>`)
  }
  if (fields.showName) {
    parts.push(`<div class="name">${escapeHtml(label.name)}</div>`)
  }
  parts.push(
    label.barcodeSvg
      ? `<div class="barcode">${label.barcodeSvg}</div>`
      // Sin dibujo queda el número: es peor imprimir un hueco que un código a mano.
      : `<div class="barcode barcode--missing">${escapeHtml(label.code ?? '')}</div>`,
  )
  if (fields.showCode && label.code) {
    parts.push(`<div class="code">${escapeHtml(label.code)}</div>`)
  }
  if (fields.showPrice && label.priceLabel) {
    parts.push(`<div class="price">${escapeHtml(label.priceLabel)}</div>`)
  }
  if (fields.showSku && label.sku && label.sku !== label.code) {
    parts.push(`<div class="sku">${escapeHtml(label.sku)}</div>`)
  }

  return `<div class="label">${parts.join('')}</div>`
}

function sheetCss(layout: LabelLayout, fields: LabelFields): string {
  const pageSize = layout.pageHeightMm === null
    ? `${mm(layout.pageWidthMm)} auto`
    : `${mm(layout.pageWidthMm)} ${mm(layout.pageHeightMm)}`

  // En la etiqueta chica el nombre entra en una línea y el precio manda.
  const nameSize = layout.compact ? '6.5pt' : '8pt'
  const priceSize = layout.compact ? '9pt' : '12pt'
  const codeSize = layout.compact ? '6pt' : '7.5pt'
  const nameLines = layout.compact ? 1 : 2

  return `
    @page { size: ${pageSize}; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: ${mm(layout.pageWidthMm)};
      ${layout.pageHeightMm === null ? '' : `height: ${mm(layout.pageHeightMm)};`}
      padding: ${mm(layout.marginYMm)} ${mm(layout.marginXMm)};
      display: grid;
      grid-template-columns: repeat(${layout.columns}, ${mm(layout.labelWidthMm)});
      ${layout.rows === null ? '' : `grid-template-rows: repeat(${layout.rows}, ${mm(layout.labelHeightMm)});`}
      column-gap: ${mm(layout.gapXMm)};
      row-gap: ${mm(layout.gapYMm)};
      justify-content: center;
      align-content: start;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .label {
      width: ${mm(layout.labelWidthMm)};
      height: ${mm(layout.labelHeightMm)};
      padding: 0.6mm 1mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.4mm;
      text-align: center;
      ${fields.showGuides ? 'border: 0.2mm dashed #999;' : ''}
    }
    .store { font-size: ${codeSize}; text-transform: uppercase; letter-spacing: 0.02em; }
    .name {
      font-size: ${nameSize};
      font-weight: 600;
      line-height: 1.15;
      display: -webkit-box;
      -webkit-line-clamp: ${nameLines};
      -webkit-box-orient: vertical;
      overflow: hidden;
      width: 100%;
    }
    .barcode { width: 100%; height: ${mm(layout.barcodeHeightMm)}; display: flex; align-items: center; justify-content: center; }
    .barcode svg { width: 100%; height: 100%; }
    .barcode--missing { font-family: 'Courier New', monospace; font-size: ${codeSize}; letter-spacing: 0.08em; }
    .code { font-family: 'Courier New', monospace; font-size: ${codeSize}; letter-spacing: 0.06em; }
    .price { font-size: ${priceSize}; font-weight: 700; line-height: 1.1; }
    .sku { font-size: ${codeSize}; color: #333; }
    @media screen {
      body { background: #f1f5f9; padding: 8mm 0; }
      .page { margin: 0 auto 6mm; background: #fff; box-shadow: 0 1px 6px rgba(15, 23, 42, 0.2); }
    }
  `
}

/** El documento completo, listo para escribirlo en la ventana de impresión. */
export function buildLabelSheetHtml(
  labels: readonly PreparedLabel[],
  layout: LabelLayout,
  fields: LabelFields,
): string {
  const pages = paginateLabels(labels, layout)
  const body = pages
    .map((page) => `<div class="page">${page.map((label) => labelHtml(label, layout, fields)).join('')}</div>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Etiquetas de productos</title>
<style>${sheetCss(layout, fields)}</style>
</head>
<body>${body}</body>
</html>`
}
