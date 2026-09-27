import { ean13CheckDigit, isValidEan13 } from './barcode-format'

/**
 * Códigos EAN-13 propios, para los productos que no traen uno del fabricante.
 *
 * El prefijo va en el rango 200–299, que GS1 reserva para códigos de
 * circulación restringida: son de uso interno del negocio y no chocan con el
 * código real de ningún fabricante. El generador que ya existía usaba 750, que
 * es el prefijo de México: un código así dice ser de un fabricante mexicano.
 */

export const INTERNAL_EAN_PREFIX = '200'

/** Un EAN-13 interno con su dígito verificador, o `null` si no se pudo. */
export function buildInternalEan13(body9: string, prefix = INTERNAL_EAN_PREFIX): string | null {
  const first12 = `${prefix}${body9}`
  if (first12.length !== 12 || !/^\d{12}$/.test(first12)) return null
  const check = ean13CheckDigit(first12)
  return check === null ? null : `${first12}${check}`
}

/**
 * Un código que no esté usado todavía. `taken` tiene que traer los códigos de
 * la organización: dos productos con el mismo código hacen que el lector del
 * POS cobre el equivocado.
 */
export function generateInternalEan13(
  taken: ReadonlySet<string>,
  random: () => number = Math.random,
  prefix = INTERNAL_EAN_PREFIX,
): string | null {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const body = Math.floor(random() * 1_000_000_000).toString().padStart(9, '0')
    const code = buildInternalEan13(body, prefix)
    if (code && isValidEan13(code) && !taken.has(code)) return code
  }
  return null
}

/**
 * Genera los códigos que faltan, en orden y sin repetir entre ellos.
 * Los productos que ya tienen código se devuelven sin tocar.
 */
export function assignInternalBarcodes<T extends { id: string; barcode?: string | null }>(
  products: readonly T[],
  taken: ReadonlySet<string>,
  random: () => number = Math.random,
): { assignments: { id: string; barcode: string }[]; failed: string[] } {
  const used = new Set(taken)
  const assignments: { id: string; barcode: string }[] = []
  const failed: string[] = []

  for (const product of products) {
    if ((product.barcode ?? '').trim()) continue
    const code = generateInternalEan13(used, random)
    if (!code) {
      failed.push(product.id)
      continue
    }
    used.add(code)
    assignments.push({ id: product.id, barcode: code })
  }

  return { assignments, failed }
}
