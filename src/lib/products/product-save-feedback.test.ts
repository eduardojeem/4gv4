import { describe, expect, it } from 'vitest'
import { getProductSaveFeedback } from './product-save-feedback'

describe('getProductSaveFeedback', () => {
  it('explains a duplicated SKU without exposing a technical database error', () => {
    expect(getProductSaveFeedback(new Error('Product with this SKU already exists'), 'create')).toEqual({
      title: 'El SKU ya está en uso',
      description: 'Cambia el SKU e intenta crear el producto nuevamente.',
    })
  })

  it('preserves useful validation details returned by the API', () => {
    expect(getProductSaveFeedback(
      new Error('Validation failed: sale_price: El precio de venta debe ser mayor a 0'),
      'create',
    )).toEqual({
      title: 'Revisa los datos del producto',
      description: 'El precio de venta debe ser mayor a 0',
    })
  })

  it('explains permission failures', () => {
    expect(getProductSaveFeedback(new Error('Forbidden'), 'create')).toEqual({
      title: 'No tienes permiso para crear productos',
      description: 'Solicita a un administrador acceso para crear productos en esta organización.',
    })
  })

  it('explains when inventory is unavailable in the current plan', () => {
    expect(getProductSaveFeedback(
      new Error('This module is not enabled for the current plan.'),
      'create',
    )).toEqual({
      title: 'Inventario no disponible en tu plan',
      description: 'Activa el módulo de inventario o cambia de plan para crear productos.',
    })
  })

  it('explains connection failures while preserving form data', () => {
    expect(getProductSaveFeedback(new Error('Failed to fetch'), 'create')).toEqual({
      title: 'No se pudo conectar con el servidor',
      description: 'Revisa tu conexión. Tus datos siguen en el formulario para que puedas intentar nuevamente.',
    })
  })

  it('explains branch stock synchronization failures', () => {
    expect(getProductSaveFeedback(
      new Error('No se pudo sincronizar el stock inicial de la sucursal.'),
      'create',
    )).toEqual({
      title: 'No se pudo registrar el stock inicial',
      description: 'El producto no fue creado. Revisa la sucursal seleccionada e intenta nuevamente.',
    })
  })

  it('uses a clear fallback for unexpected failures', () => {
    expect(getProductSaveFeedback(new Error('Internal server error'), 'create')).toEqual({
      title: 'No se pudo crear el producto',
      description: 'Ocurrió un problema inesperado. Tus datos siguen en el formulario para que puedas intentar nuevamente.',
    })
  })
})
