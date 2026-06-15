import { describe, expect, it } from 'vitest'
import { getProductSubmitState } from './product-modal-submit-state'
import { productSchema } from '@/lib/validations/product-schema'

describe('getProductSubmitState', () => {
  it('does not present creation as ready while required fields are invalid', () => {
    expect(getProductSubmitState({
      isEditing: false,
      isSubmitting: false,
      isValid: false,
    })).toMatchObject({
      label: 'Revisar datos obligatorios',
      ready: false,
    })
  })

  it('presents the final creation action only when the form is valid', () => {
    expect(getProductSubmitState({
      isEditing: false,
      isSubmitting: false,
      isValid: true,
    })).toMatchObject({
      label: 'Crear Producto',
      ready: true,
    })
  })
})

describe('product barcode validation', () => {
  const validProduct = {
    sku: 'PROD-001',
    name: 'Producto de prueba',
    category_id: 'category-1',
    purchase_price: 10,
    sale_price: 20,
    stock_quantity: 0,
    min_stock: 0,
    barcode: '7501234567893',
    images: [],
  }

  it('rejects a barcode with an invalid checksum', () => {
    const result = productSchema.safeParse({ ...validProduct, barcode: '7501234567890' })
    expect(result.success).toBe(false)
  })

  it('accepts an empty optional barcode', () => {
    const result = productSchema.safeParse({ ...validProduct, barcode: '' })
    expect(result.success).toBe(true)
  })

  it('accepts valid EAN-8 and UPC-A barcodes', () => {
    expect(productSchema.safeParse({ ...validProduct, barcode: '96385074' }).success).toBe(true)
    expect(productSchema.safeParse({ ...validProduct, barcode: '036000291452' }).success).toBe(true)
  })
})
