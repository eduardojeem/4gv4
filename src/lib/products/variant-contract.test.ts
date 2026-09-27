import { describe, expect, it } from 'vitest'
import { ProductVariantsPayloadSchema } from './variant-contract'

const attribute = {
  key: 'color',
  label: 'Color',
  control: 'color' as const,
  options: ['Negro'],
}

const variant = {
  clientKey: 'color=Negro',
  name: 'Negro',
  attributes: { color: 'Negro' },
  sku: 'REM-N',
  purchasePrice: 50000,
  salePrice: 90000,
  wholesalePrice: 80000,
  minStock: 1,
  stockQuantity: 2,
  isActive: true,
}

describe('ProductVariantsPayloadSchema', () => {
  it('rejects duplicate combinations', () => {
    const parsed = ProductVariantsPayloadSchema.safeParse({
      hasVariants: true,
      attributes: [attribute],
      variants: [variant, { ...variant, clientKey: 'second', sku: 'REM-N2' }],
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.some((issue) => issue.message.includes('combinación'))).toBe(true)
  })

  it('rejects duplicate normalized SKUs and negative stock', () => {
    const parsed = ProductVariantsPayloadSchema.safeParse({
      hasVariants: true,
      attributes: [attribute],
      variants: [
        { ...variant, sku: ' rem-n ' },
        {
          ...variant,
          clientKey: 'color=Blanco',
          attributes: { color: 'Blanco' },
          sku: 'REM-N',
          stockQuantity: -1,
        },
      ],
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.some((issue) => issue.message.includes('SKU'))).toBe(true)
    expect(parsed.error?.issues.some((issue) => issue.path.includes('stockQuantity'))).toBe(true)
  })

  it('keeps a simple product compatible with no variant configuration', () => {
    expect(ProductVariantsPayloadSchema.parse({ hasVariants: false })).toEqual({
      hasVariants: false,
      attributes: [],
      variants: [],
    })
  })
})
