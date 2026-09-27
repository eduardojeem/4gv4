import { describe, expect, it } from 'vitest'
import { productSchema, productUpdateSchema } from '@/lib/validation/schemas'

/**
 * Ocultar un producto del catálogo le vaciaba el inventario.
 *
 * El esquema de actualización se armaba con `partial()`, que vuelve opcional
 * cada campo pero **no** desactiva su `default()`. Al mandar solo la
 * visibilidad, el esquema devolvía además `stock_quantity: 0`, `min_stock: 0`,
 * `is_active: true`, `unit_measure: 'unidad'` y `variants: []`, y la API
 * escribía todo eso. Lo mismo pasaba con activar o desactivar en lote.
 */

const ID = '11111111-1111-4111-8111-111111111111'

const datos = (entrada: Record<string, unknown>) => {
  const resultado = productUpdateSchema.safeParse({ id: ID, ...entrada })
  if (!resultado.success) throw new Error(resultado.error.issues[0].message)
  return resultado.data as Record<string, unknown>
}

describe('actualizar un producto sin tocar lo que no se mandó', () => {
  it('ocultar del catálogo no trae stock ni nada más', () => {
    const salida = datos({ visibility: 'hidden' })
    expect(salida).toEqual({ id: ID, visibility: 'hidden' })
    expect(salida.stock_quantity).toBeUndefined()
    expect(salida.min_stock).toBeUndefined()
    expect(salida.is_active).toBeUndefined()
    expect(salida.unit_measure).toBeUndefined()
  })

  /** Activar y desactivar en lote mandan solo ese campo. */
  it('activar o desactivar no trae stock', () => {
    expect(datos({ is_active: false })).toEqual({ id: ID, is_active: false })
    expect(datos({ is_active: true })).toEqual({ id: ID, is_active: true })
  })

  /**
   * Con `variants: []` por defecto, una actualización de un solo campo entraba
   * al camino de variantes de la API y podía dejar al producto sin ninguna.
   */
  it('no inventa variantes en una actualización de un solo campo', () => {
    const salida = datos({ visibility: 'public' })
    expect(salida.has_variants).toBeUndefined()
    expect(salida.variants).toBeUndefined()
    expect(salida.variant_attribute_config).toBeUndefined()
  })

  it('lo que sí se manda llega tal cual, incluido un stock en cero', () => {
    expect(datos({ stock_quantity: 7 })).toEqual({ id: ID, stock_quantity: 7 })
    // Poner el stock en cero a propósito tiene que seguir funcionando.
    expect(datos({ stock_quantity: 0 })).toEqual({ id: ID, stock_quantity: 0 })
    expect(datos({ min_stock: 3, unit_measure: 'kg' })).toEqual({ id: ID, min_stock: 3, unit_measure: 'kg' })
  })

  it('sigue exigiendo un id válido', () => {
    expect(productUpdateSchema.safeParse({ id: 'no-es-uuid', visibility: 'hidden' }).success).toBe(false)
  })

  it('y sigue validando lo que sí llega', () => {
    expect(productUpdateSchema.safeParse({ id: ID, stock_quantity: -5 }).success).toBe(false)
    expect(productUpdateSchema.safeParse({ id: ID, visibility: 'otra-cosa' }).success).toBe(false)
  })

  /** Si la actualización sí declara variantes, la validación sigue corriendo. */
  it('pedir variantes sin cargarlas sigue siendo un error', () => {
    const resultado = productUpdateSchema.safeParse({ id: ID, has_variants: true })
    expect(resultado.success).toBe(false)
  })
})

describe('crear un producto no cambió', () => {
  const nuevo = { name: 'Cargador USB-C 25W', sku: 'CAR-25W', sale_price: 85000, purchase_price: 50000 }

  it('los valores por defecto se siguen aplicando al alta', () => {
    const resultado = productSchema.safeParse(nuevo)
    expect(resultado.success).toBe(true)
    if (!resultado.success) return
    const data = resultado.data as Record<string, unknown>
    expect(data.stock_quantity).toBe(0)
    expect(data.min_stock).toBe(0)
    expect(data.is_active).toBe(true)
    expect(data.unit_measure).toBe('unidad')
  })

  it('un producto con variantes sigue necesitando sus variantes', () => {
    expect(productSchema.safeParse({ ...nuevo, has_variants: true }).success).toBe(false)
  })
})
