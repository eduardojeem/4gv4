import { buildLabelSheetHtml, prepareLabels, type LabelFields, type LabelProduct } from './label-sheet'
import { layoutOrDefault } from './label-layouts'

/**
 * Manda las etiquetas a la impresora.
 *
 * Sigue el camino que ya usan los tickets y los comprobantes: una ventana
 * nueva con su propio documento, y el `print()` recién cuando terminó de
 * cargar —si se dispara antes, las etiquetas salen sin los códigos.
 */

export type PrintLabelsOutcome =
  | { ok: true; printed: number; withoutCode: string[]; truncated: boolean }
  | { ok: false; reason: 'nothing-to-print' | 'popup-blocked'; withoutCode: string[] }

function printWhenReady(target: Window, fallbackDelay = 1200): void {
  let printed = false
  const run = () => {
    if (printed) return
    printed = true
    try {
      target.focus()
      target.print()
    } catch {
      target.close()
    }
  }

  try {
    if (target.document.readyState === 'complete') {
      setTimeout(run, 150)
    } else {
      target.addEventListener('load', () => setTimeout(run, 150))
    }
  } catch {
    // Si no se pudo escuchar el evento, queda el plazo de seguridad.
  }

  setTimeout(run, fallbackDelay)
}

export async function printProductLabels(
  products: readonly LabelProduct[],
  layoutId: string,
  fields: LabelFields,
): Promise<PrintLabelsOutcome> {
  const layout = layoutOrDefault(layoutId)
  const { labels, withoutCode, truncated } = await prepareLabels(products, layout)

  if (labels.length === 0) {
    return { ok: false, reason: 'nothing-to-print', withoutCode }
  }

  const html = buildLabelSheetHtml(labels, layout, fields)
  const target = window.open('', '_blank')
  if (!target) {
    return { ok: false, reason: 'popup-blocked', withoutCode }
  }

  target.document.write(html)
  target.document.close()
  printWhenReady(target)

  return { ok: true, printed: labels.length, withoutCode, truncated }
}

/** El mismo documento, para verlo dentro del diálogo antes de imprimir. */
export async function buildLabelPreview(
  products: readonly LabelProduct[],
  layoutId: string,
  fields: LabelFields,
): Promise<{ html: string; labels: number; withoutCode: string[]; truncated: boolean }> {
  const layout = layoutOrDefault(layoutId)
  const { labels, withoutCode, truncated } = await prepareLabels(products, layout)
  return {
    html: buildLabelSheetHtml(labels, layout, fields),
    labels: labels.length,
    withoutCode,
    truncated,
  }
}
