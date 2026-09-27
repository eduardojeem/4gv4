/**
 * Si la base ya tiene las columnas de compatibilidad con celulares.
 *
 * El código se despliega antes de que alguien aplique la migración
 * `20260922120000_products_device_compatibility.sql`. Mandar `device_brand` a
 * una base que no lo conoce hace fallar el alta y la edición de **todos** los
 * productos, no sólo de los que tienen celular cargado. Así que se pregunta una
 * vez y, si todavía no están, se guarda el producto sin esos datos.
 *
 * El «sí» se recuerda para siempre (una columna no desaparece); el «no», un
 * minuto, para enterarse enseguida cuando se aplique la migración.
 */

type ClienteConProductos = {
  from: (tabla: string) => {
    select: (columnas: string) => {
      limit: (n: number) => PromiseLike<{ error: unknown }>
    }
  }
}

const REINTENTAR_EN_MS = 60_000

let recordado: { valor: boolean; hasta: number } | null = null

export async function productsHaveDeviceColumns(supabase: ClienteConProductos): Promise<boolean> {
  if (recordado && (recordado.valor || Date.now() < recordado.hasta)) return recordado.valor

  const { error } = await supabase.from('products').select('device_brand, device_models, device_sort_key').limit(0)
  const valor = !error
  recordado = { valor, hasta: Date.now() + REINTENTAR_EN_MS }
  return valor
}

/** Sólo para los tests. */
export function forgetDeviceColumnsCheck() {
  recordado = null
}

/** El aviso que se le muestra a quien cargó el celular antes de la migración. */
export const DEVICE_COLUMNS_MISSING_MESSAGE =
  'Se guardó el producto, pero no la marca ni el modelo del celular: falta aplicar la migración de compatibilidad.'
