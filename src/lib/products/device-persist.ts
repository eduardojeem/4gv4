/**
 * Guarda para qué celular es un producto, después del alta o la edición.
 *
 * Va aparte del guardado principal a propósito. Los productos con variantes se
 * graban con la función `save_product_with_variants`, que arma la fila campo
 * por campo y no conoce estas columnas; y antes de aplicar la migración, meter
 * `device_brand` en el insert haría fallar el alta de cualquier producto. Un
 * update al final sirve para los cuatro caminos (alta y edición, con y sin
 * variantes) y se salta solo si la base todavía no tiene las columnas.
 */

import { logger } from '@/lib/logger'
import { productsHaveDeviceColumns } from '@/lib/products/device-columns'

export type DeviceFieldsInput = {
  device_brand?: string | null
  device_models?: string[]
}

export type DeviceFieldsResult = {
  /** Lo que quedó escrito, para devolverlo en la respuesta. */
  campos: Record<string, unknown> | null
  /** Se mandaron datos del celular pero no se pudieron guardar. */
  skipped: boolean
}

/** Sólo lo que vino en el pedido: una edición que no los manda no los toca. */
export function deviceFieldsFrom(validated: DeviceFieldsInput): Record<string, unknown> | null {
  const campos: Record<string, unknown> = {}
  if (validated.device_brand !== undefined) campos.device_brand = validated.device_brand
  if (validated.device_models !== undefined) campos.device_models = validated.device_models
  return Object.keys(campos).length > 0 ? campos : null
}

/** Si hay algo cargado de verdad: una marca o al menos un modelo. */
export function hasDeviceContent(campos: Record<string, unknown> | null): boolean {
  if (!campos) return false
  const marca = campos.device_brand
  const modelos = campos.device_models
  return Boolean(marca) || (Array.isArray(modelos) && modelos.length > 0)
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

export async function persistDeviceFields(
  supabase: ClienteQueActualiza,
  { productId, organizationId, validated }: { productId: string; organizationId: string; validated: DeviceFieldsInput },
): Promise<DeviceFieldsResult> {
  const campos = deviceFieldsFrom(validated)
  if (!campos || !productId) return { campos: null, skipped: false }

  if (!(await productsHaveDeviceColumns(supabase))) {
    // El formulario manda los campos vacíos en cada guardado. Si no había nada
    // cargado no se perdió nada, y avisar en cada producto sería puro ruido.
    if (!hasDeviceContent(campos)) return { campos: null, skipped: false }
    logger.warn('Datos del celular sin guardar: falta la migración de compatibilidad', { productId })
    return { campos: null, skipped: true }
  }

  const { error } = await supabase
    .from('products')
    .update(campos)
    .eq('id', productId)
    .eq('organization_id', organizationId)

  if (error) {
    logger.error('No se pudieron guardar los datos del celular', { productId, error: error.message })
    return { campos: null, skipped: true }
  }

  return { campos, skipped: false }
}
