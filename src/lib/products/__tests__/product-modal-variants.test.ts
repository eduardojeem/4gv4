import { describe, it, expect } from 'vitest'
import { normalizeProductVariantsForForm } from '@/components/dashboard/product-modal'
import { productSchema } from '@/lib/validations/product-schema'

describe('normalizeProductVariantsForForm', () => {
  it('returns false and empty arrays when product is null', () => {
    const result = normalizeProductVariantsForForm(null)
    expect(result).toEqual({
      has_variants: false,
      variant_attribute_config: [],
      variants: [],
    })
  })

  it('handles example/seed products with has_variants: true but empty attributes/variants by setting has_variants: false', () => {
    const seedProduct = {
      id: 'prod-123',
      name: 'Remera de Ejemplo',
      sku: 'REM-EJEMPLO',
      has_variants: true,
      variant_attribute_config: [],
      variants: [],
    }

    const result = normalizeProductVariantsForForm(seedProduct)
    expect(result.has_variants).toBe(false)
    expect(result.variant_attribute_config).toEqual([])
    expect(result.variants).toEqual([])
  })

  it('normalizes snake_case variant fields from database/API into camelCase schema fields', () => {
    const dbProduct = {
      id: 'prod-456',
      name: 'Pantalon Jean',
      sku: 'JEAN-01',
      purchase_price: 30000,
      sale_price: 60000,
      has_variants: true,
      variant_attribute_config: [
        {
          key: 'talle',
          label: 'Talle',
          control: 'select',
          options: ['38', '40', '42'],
        },
      ],
      variants: [
        {
          id: 'var-1',
          variant_name: 'Pantalon Jean - 38',
          sku: 'JEAN-01-38',
          barcode: '7891234567890',
          attributes: { talle: '38' },
          purchase_price: 30000,
          sale_price: 60000,
          wholesale_price: 50000,
          stock_quantity: 15,
          min_stock: 2,
          is_active: true,
        },
      ],
    }

    const result = normalizeProductVariantsForForm(dbProduct)
    expect(result.has_variants).toBe(true)
    expect(result.variant_attribute_config).toHaveLength(1)
    expect(result.variants).toHaveLength(1)

    const normalizedVariant = result.variants[0]
    expect(normalizedVariant.clientKey).toBeTruthy()
    expect(normalizedVariant.name).toBe('Pantalon Jean - 38')
    expect(normalizedVariant.sku).toBe('JEAN-01-38')
    expect(normalizedVariant.purchasePrice).toBe(30000)
    expect(normalizedVariant.salePrice).toBe(60000)
    expect(normalizedVariant.wholesalePrice).toBe(50000)
    expect(normalizedVariant.stockQuantity).toBe(15)
    expect(normalizedVariant.minStock).toBe(2)
    expect(normalizedVariant.isActive).toBe(true)

    // Verify it parses against productSchema cleanly
    const formValues = {
      name: dbProduct.name,
      sku: dbProduct.sku,
      category_id: 'cat-1',
      purchase_price: dbProduct.purchase_price,
      sale_price: dbProduct.sale_price,
      stock_quantity: 15,
      min_stock: 2,
      has_variants: result.has_variants,
      variant_attribute_config: result.variant_attribute_config,
      variants: result.variants,
    }

    const parsed = productSchema.safeParse(formValues)
    expect(parsed.success).toBe(true)
  })

  it('allows seed products with has_variants: false to pass validation without variant errors', () => {
    const seedProduct = {
      id: 'prod-789',
      name: 'Accesorio Simple',
      sku: 'ACC-001',
      has_variants: true,
      variant_attribute_config: [],
      variants: [],
    }

    const result = normalizeProductVariantsForForm(seedProduct)

    const formValues = {
      name: seedProduct.name,
      sku: seedProduct.sku,
      category_id: 'cat-1',
      purchase_price: 10000,
      sale_price: 20000,
      stock_quantity: 5,
      min_stock: 1,
      has_variants: result.has_variants,
      variant_attribute_config: result.variant_attribute_config,
      variants: result.variants,
    }

    const parsed = productSchema.safeParse(formValues)
    expect(parsed.success).toBe(true)
  })
})
