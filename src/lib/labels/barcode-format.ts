/**
 * Qué simbología le corresponde a un código antes de dibujarlo.
 *
 * El sistema ya generaba números EAN-13 y leía códigos con la pistola, pero no
 * había forma de imprimir la etiqueta. Un EAN-13 con dígito verificador mal
 * calculado imprime una hoja entera de etiquetas que ningún lector acepta, así
 * que acá se comprueba antes de mandar a la impresora.
 */

export type BarcodeFormat = 'EAN13' | 'EAN8' | 'UPC' | 'CODE128'

const DIGITS = /^\d+$/
/** Code 128 dibuja ASCII imprimible; una ñ o un acento no tienen símbolo. */
const PRINTABLE_ASCII = /^[\x20-\x7E]+$/

/** Suma ponderada de los códigos GS1: 1 y 3 alternados desde la derecha. */
function gs1CheckDigit(digitsWithoutCheck: string): number {
  const digits = digitsWithoutCheck.split('').map(Number)
  let sum = 0
  // Se pesa desde la derecha: el último dígito antes del verificador va por 3.
  for (let index = digits.length - 1, weight = 3; index >= 0; index -= 1, weight = weight === 3 ? 1 : 3) {
    sum += digits[index] * weight
  }
  return (10 - (sum % 10)) % 10
}

/** El dígito verificador que le corresponde a los primeros 12 de un EAN-13. */
export function ean13CheckDigit(first12: string): number | null {
  const value = first12.trim()
  if (value.length !== 12 || !DIGITS.test(value)) return null
  return gs1CheckDigit(value)
}

function hasValidGs1Check(value: string): boolean {
  const body = value.slice(0, -1)
  const check = Number(value.slice(-1))
  return gs1CheckDigit(body) === check
}

export function isValidEan13(value: string): boolean {
  const code = value.trim()
  return code.length === 13 && DIGITS.test(code) && hasValidGs1Check(code)
}

/**
 * La simbología con la que el código se puede dibujar, o `null` si no hay nada
 * imprimible. Un número de 13 dígitos con verificador correcto sale como
 * EAN-13, que es lo que entienden todas las cajas; el resto —SKU con letras,
 * códigos internos— sale como Code 128, que acepta cualquier texto.
 */
export function detectBarcodeFormat(value: string | null | undefined): BarcodeFormat | null {
  const code = (value ?? '').trim()
  if (!code) return null

  if (DIGITS.test(code) && hasValidGs1Check(code)) {
    if (code.length === 13) return 'EAN13'
    if (code.length === 12) return 'UPC'
    if (code.length === 8) return 'EAN8'
  }

  if (!PRINTABLE_ASCII.test(code)) return null
  return 'CODE128'
}

/**
 * El código que va en la etiqueta del producto: el de barras si lo tiene, y si
 * no el SKU, que es lo que el negocio usa como código interno. Sin ninguno de
 * los dos no hay etiqueta posible y conviene decirlo antes de imprimir.
 */
export function resolveLabelCode(product: { barcode?: string | null; sku?: string | null }): {
  value: string
  format: BarcodeFormat
} | null {
  for (const candidate of [product.barcode, product.sku]) {
    const value = (candidate ?? '').trim()
    if (!value) continue
    const format = detectBarcodeFormat(value)
    if (format) return { value, format }
  }
  return null
}
