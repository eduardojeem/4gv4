/**
 * Publicar un producto sin mostrar el precio.
 *
 * La tienda de repuestos quiere el catálogo a la vista —foto, modelo, stock—
 * pero el precio lo negocia por WhatsApp. Antes la única salida era ocultar el
 * producto entero, así que el cliente no se enteraba de que existía.
 *
 * `hide_price` no toca la visibilidad: el producto sigue siendo público y se
 * filtra como cualquier otro; sólo cambia lo que se ve donde iba el precio.
 *
 * Igual que con las columnas del celular, el código se despliega antes de que
 * alguien aplique la migración: se pregunta una vez si la columna existe y, si
 * todavía no está, se guarda el producto sin este dato y la tienda muestra el
 * precio como siempre.
 */

import { logger } from '@/lib/logger'

type ClienteConProductos = {
  from: (tabla: string) => {
    select: (columnas: string) => {
      limit: (n: number) => PromiseLike<{ error: unknown }>
    }
  }
}

const REINTENTAR_EN_MS = 60_000

let recordado: { valor: boolean; hasta: number } | null = null

/** El «sí» se recuerda para siempre; el «no», un minuto. */
export async function productsHaveHidePriceColumn(supabase: ClienteConProductos): Promise<boolean> {
  if (recordado && (recordado.valor || Date.now() < recordado.hasta)) return recordado.valor

  const { error } = await supabase.from('products').select('hide_price').limit(0)
  const valor = !error
  recordado = { valor, hasta: Date.now() + REINTENTAR_EN_MS }
  return valor
}

/** Sólo para los tests. */
export function forgetHidePriceColumnCheck() {
  recordado = null
}

export const HIDE_PRICE_COLUMN_MISSING_MESSAGE =
  'Se guardó el producto, pero el precio se va a seguir mostrando en la tienda: falta aplicar la migración que permite ocultarlo.'

/** Lo que ve la tienda pública. Sin el dato cargado, el precio se muestra. */
export function hidesPublicPrice(producto: { hide_price?: boolean | null } | null | undefined): boolean {
  return producto?.hide_price === true
}

type ClienteQueActualiza = {
  from: (tabla: string) => {
    update: (valores: Record<string, unknown>) => {
      eq: (columna: string, valor: string) => {
        eq: (columna: string, valor: string) => PromiseLike<{ error: { message: string } | null }>
      }
    }
    select: (columnas: string) => { limit: (n: number) => PromiseLike<{ error: unknown }> }
  }
}

/**
 * Se guarda después del alta y de la edición, igual que los datos del celular:
 * los productos con variantes se graban con `save_product_with_variants`, que
 * arma la fila campo por campo y no conoce esta columna.
 */
export async function persistPriceVisibility(
  supabase: ClienteQueActualiza,
  {
    productId,
    organizationId,
    validated,
  }: { productId: string; organizationId: string; validated: { hide_price?: boolean } },
): Promise<{ campos: Record<string, unknown> | null; skipped: boolean }> {
  if (validated.hide_price === undefined || !productId) return { campos: null, skipped: false }

  const campos = { hide_price: validated.hide_price }

  if (!(await productsHaveHidePriceColumn(supabase))) {
    // Pedir que se oculte y que igual se vea es lo único que merece un aviso:
    // si se pidió mostrarlo, es lo que ya pasa.
    if (!validated.hide_price) return { campos: null, skipped: false }
    logger.warn('Precio sin ocultar: falta la migración hide_price', { productId })
    return { campos: null, skipped: true }
  }

  const { error } = await supabase
    .from('products')
    .update(campos)
    .eq('id', productId)
    .eq('organization_id', organizationId)

  if (error) {
    logger.error('No se pudo guardar la visibilidad del precio', { productId, error: error.message })
    return { campos: null, skipped: true }
  }

  return { campos, skipped: false }
}
