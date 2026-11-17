import JsBarcode from 'jsbarcode'
import type { BarcodeFormat } from './barcode-format'
/** Codificación de JsBarcode sin DOM: mismas barras que las etiquetas web. */
export function serverBarcodeSvg(value: string, format: BarcodeFormat): string {
  const encoded: { encodings?: { data: string }[] } = {}
  ;(JsBarcode as unknown as (target: object, value: string, options: object) => void)(
    encoded,
    value,
    { format, displayValue: false, margin: 0 },
  )
  const bits = encoded.encodings?.map((item) => item.data).join('')
  if (!bits || !/^[01]+$/.test(bits)) throw new Error('No se pudo dibujar el código de barras.')
  const bars = [...bits]
    .flatMap((bit, i) => (bit === '1' ? [`<rect x="${i + 10}" y="0" width="1" height="60"/>`] : []))
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bits.length + 20} 60" width="${bits.length + 20}" height="60" preserveAspectRatio="none"><rect width="100%" height="100%" fill="white"/><g fill="black">${bars}</g></svg>`
}
