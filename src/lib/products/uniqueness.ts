/**
 * Dos productos de la misma tienda no pueden compartir el SKU ni el código de
 * barras.
 *
 * Nada lo impedía: en el catálogo ya hay dos productos con el SKU
 * `store_babyliss`, y como el SKU es lo que se imprime en la etiqueta cuando no
 * hay código de barras, los dos llevan el mismo código. En el mostrador, el
 * lector no puede distinguirlos y se cobra el equivocado.
 */

export type ConflictField = 'sku' | 'barcode'

export type ProductConflict = {
  field: ConflictField
  value: string
  /** El producto que ya usa ese código. */
  name: string
  id: string
}

type ConflictRow = { id: string; name: string | null; sku: string | null; barcode: string | null }

/** Lo mínimo que hace falta de Supabase para esta consulta. */
export type ConflictClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        or: (filter: string) => {
          limit: (count: number) => Promise<{ data: ConflictRow[] | null; error: { message: string } | null }>
        }
      }
    }
  }
}

const limpio = (valor: string | null | undefined): string => (valor ?? '').trim()

/** Escapa lo que rompe el filtro `or` de PostgREST: comas, comillas y paréntesis. */
function seguro(valor: string): string {
  return valor.replace(/[,()"']/g, '')
}

export function conflictMessage(conflict: ProductConflict): string {
  return conflict.field === 'sku'
    ? `El SKU «${conflict.value}» ya lo usa «${conflict.name}»`
    : `El código de barras «${conflict.value}» ya lo usa «${conflict.name}»`
}

/**
 * Busca un producto de la organización que ya use ese SKU o código de barras.
 * `excludeId` deja fuera al que se está editando.
 */
export async function findProductConflict(
  client: ConflictClient,
  {
    organizationId,
    sku,
    barcode,
    excludeId,
  }: { organizationId: string; sku?: string | null; barcode?: string | null; excludeId?: string },
): Promise<ProductConflict | null> {
  const skuLimpio = limpio(sku)
  const barcodeLimpio = limpio(barcode)

  const filtros: string[] = []
  if (skuLimpio) filtros.push(`sku.eq.${seguro(skuLimpio)}`)
  if (barcodeLimpio) filtros.push(`barcode.eq.${seguro(barcodeLimpio)}`)
  if (filtros.length === 0) return null

  const { data, error } = await client
    .from('products')
    .select('id, name, sku, barcode')
    .eq('organization_id', organizationId)
    .or(filtros.join(','))
    .limit(5)

  if (error) throw new Error(error.message)

  for (const fila of data ?? []) {
    if (excludeId && fila.id === excludeId) continue
    if (skuLimpio && limpio(fila.sku).toLowerCase() === skuLimpio.toLowerCase()) {
      return { field: 'sku', value: skuLimpio, name: fila.name ?? 'otro producto', id: fila.id }
    }
    if (barcodeLimpio && limpio(fila.barcode) === barcodeLimpio) {
      return { field: 'barcode', value: barcodeLimpio, name: fila.name ?? 'otro producto', id: fila.id }
    }
  }

  return null
}
