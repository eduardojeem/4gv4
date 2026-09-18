import { detectBarcodeFormat, type BarcodeFormat } from './barcode-format'

/**
 * Dibuja el código como SVG para pegarlo en la hoja de etiquetas.
 *
 * La librería se carga sólo cuando alguien va a imprimir: no tiene sentido que
 * el listado de productos arrastre el dibujante de códigos de barras.
 */

export type BarcodeSvgOptions = {
  /** Si no se pasa, se deduce del propio código. */
  format?: BarcodeFormat
  /** Alto de las barras en píxeles del SVG; la hoja lo escala con CSS. */
  heightPx?: number
  /** Ancho del módulo más angosto. Menos de 1 px y el lector empieza a fallar. */
  modulePx?: number
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const cache = new Map<string, string | null>()

type JsBarcodeFn = (element: unknown, text: string, options: Record<string, unknown>) => void

let loader: Promise<JsBarcodeFn | null> | null = null

async function loadJsBarcode(): Promise<JsBarcodeFn | null> {
  if (!loader) {
    loader = import('jsbarcode')
      .then((mod) => ((mod as { default?: unknown }).default ?? mod) as JsBarcodeFn)
      .catch(() => null)
  }
  return loader
}

/**
 * El SVG del código, o `null` si no se puede dibujar. Un EAN-13 con dígito
 * verificador equivocado entra por acá y sale como Code 128 en lugar de
 * romper la impresión: la etiqueta se lee igual y no se pierde el pliego.
 */
export async function barcodeSvgMarkup(
  value: string,
  options: BarcodeSvgOptions = {},
): Promise<string | null> {
  const code = (value ?? '').trim()
  if (!code || typeof document === 'undefined') return null

  const format = options.format ?? detectBarcodeFormat(code)
  if (!format) return null

  const heightPx = options.heightPx ?? 48
  const modulePx = options.modulePx ?? 1.6
  const key = `${format}|${heightPx}|${modulePx}|${code}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const JsBarcode = await loadJsBarcode()
  if (!JsBarcode) {
    cache.set(key, null)
    return null
  }

  const render = (withFormat: BarcodeFormat): string | null => {
    const svg = document.createElementNS(SVG_NS, 'svg')
    try {
      JsBarcode(svg, code, {
        format: withFormat,
        height: heightPx,
        width: modulePx,
        margin: 0,
        // El número se escribe en la etiqueta con la tipografía de la hoja:
        // así se controla el tamaño y no queda cortado en las chicas.
        displayValue: false,
        background: '#ffffff',
        lineColor: '#000000',
      })
      // El SVG sale con un tamaño fijo en píxeles, así que en una etiqueta
      // angosta quedaba chico y centrado: sin `width`/`height` propios y con
      // `preserveAspectRatio="none"` ocupa todo el ancho, que es lo que hace
      // que el lector lo tome de la primera. El `viewBox` mantiene las
      // proporciones entre barras, que es lo único que no se puede tocar.
      svg.removeAttribute('width')
      svg.removeAttribute('height')
      svg.removeAttribute('x')
      svg.removeAttribute('y')
      svg.setAttribute('preserveAspectRatio', 'none')
      // JsBarcode escribe su propio xmlns y el serializador agrega otro.
      svg.removeAttribute('xmlns')
      return new XMLSerializer().serializeToString(svg)
    } catch {
      return null
    }
  }

  const markup = render(format) ?? (format === 'CODE128' ? null : render('CODE128'))
  cache.set(key, markup)
  return markup
}

/** Para los tests y para cuando cambia la configuración de la etiqueta. */
export function clearBarcodeSvgCache(): void {
  cache.clear()
}
