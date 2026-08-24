import { describe, expect, it } from 'vitest'
import { getFirstProductErrorTab, shouldConfirmProductModalClose, getProductRequirementsProgress } from './product-modal-behavior'

describe('getFirstProductErrorTab', () => {
  it('opens the first section that contains a validation error after submit', () => {
    expect(getFirstProductErrorTab(['sale_price', 'stock_quantity'])).toBe('pricing')
    expect(getFirstProductErrorTab(['exchange_window_days'])).toBe('post-sale')
  })

  it('does not force navigation when no known field has an error', () => {
    expect(getFirstProductErrorTab([])).toBeNull()
  })
})

describe('shouldConfirmProductModalClose', () => {
  it('blocks closing while a product is being saved', () => {
    expect(shouldConfirmProductModalClose({ isDirty: false, isSubmitting: true })).toBe('blocked')
  })

  it('blocks closing while product images are being uploaded', () => {
    expect(shouldConfirmProductModalClose({
      isDirty: false,
      isSubmitting: false,
      isUploadingImages: true,
    })).toBe('blocked')
  })

  it('asks for confirmation when the form has unsaved changes', () => {
    expect(shouldConfirmProductModalClose({ isDirty: true, isSubmitting: false })).toBe('confirm')
  })

  it('closes directly when there are no unsaved changes', () => {
    expect(shouldConfirmProductModalClose({ isDirty: false, isSubmitting: false })).toBe('close')
  })
})

describe('getProductRequirementsProgress', () => {
  const complete = {
    name: 'Cargador rapido',
    sku: 'CRG-01',
    category_id: 'cat-1',
    sale_price: 150000,
  }

  it('marca todo listo cuando estan los 4 obligatorios', () => {
    const progress = getProductRequirementsProgress(complete)

    expect(progress.isComplete).toBe(true)
    expect(progress.completed).toBe(4)
    expect(progress.missing).toEqual([])
  })

  it('un formulario vacio no tiene nada completo', () => {
    const progress = getProductRequirementsProgress({})

    expect(progress.completed).toBe(0)
    expect(progress.isComplete).toBe(false)
    expect(progress.missing).toHaveLength(4)
  })

  it('dice en que pestaña esta cada faltante', () => {
    const progress = getProductRequirementsProgress({ ...complete, sale_price: 0 })

    expect(progress.missing).toHaveLength(1)
    expect(progress.missing[0].key).toBe('sale_price')
    // El precio vive en otra pestaña: es el que el usuario no encontraba.
    expect(progress.missing[0].tab).toBe('pricing')
  })

  it('aplica los mismos minimos que el esquema', () => {
    // name y sku piden 3 caracteres; sale_price pide 0.01.
    expect(getProductRequirementsProgress({ ...complete, name: 'ab' }).isComplete).toBe(false)
    expect(getProductRequirementsProgress({ ...complete, sku: 'ab' }).isComplete).toBe(false)
    expect(getProductRequirementsProgress({ ...complete, sale_price: 0.009 }).isComplete).toBe(false)
    expect(getProductRequirementsProgress({ ...complete, sale_price: 0.01 }).isComplete).toBe(true)
  })

  it('no cuenta espacios en blanco como completo', () => {
    expect(getProductRequirementsProgress({ ...complete, name: '   ' }).isComplete).toBe(false)
  })

  it('acepta el precio como texto, que es lo que da el input', () => {
    expect(getProductRequirementsProgress({ ...complete, sale_price: '150000' }).isComplete).toBe(true)
    expect(getProductRequirementsProgress({ ...complete, sale_price: '' }).isComplete).toBe(false)
    expect(getProductRequirementsProgress({ ...complete, sale_price: 'abc' }).isComplete).toBe(false)
  })
})
