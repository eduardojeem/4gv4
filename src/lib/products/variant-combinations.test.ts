import { describe, expect, it } from 'vitest'
import {
  generateVariantCombinations,
  mergeGeneratedVariants,
} from './variant-combinations'

describe('variant combinations', () => {
  it('generates a deterministic cartesian product', () => {
    const result = generateVariantCombinations([
      { key: 'color', options: ['Negro', 'Blanco'] },
      { key: 'size', options: ['M', 'L'] },
    ])

    expect(result.map((item) => item.key)).toEqual([
      'color=Negro|size=M',
      'color=Negro|size=L',
      'color=Blanco|size=M',
      'color=Blanco|size=L',
    ])
  })

  it('normalizes empty and duplicate options before generating', () => {
    const result = generateVariantCombinations([
      { key: ' color ', options: [' Negro ', 'negro', ''] },
    ])

    expect(result).toEqual([{ key: 'color=Negro', attributes: { color: 'Negro' }, name: 'Negro' }])
  })

  it('preserves edited values when combinations are regenerated', () => {
    const previous = [{
      clientKey: 'color=Negro|size=M',
      name: 'Negro / M',
      attributes: { color: 'Negro', size: 'M' },
      sku: 'REM-N-M',
      purchasePrice: 50000,
      salePrice: 95000,
      minStock: 1,
      stockQuantity: 4,
      isActive: true,
    }]
    const generated = generateVariantCombinations([
      { key: 'color', options: ['Negro'] },
      { key: 'size', options: ['M', 'L'] },
    ])

    const merged = mergeGeneratedVariants(generated, previous, {
      purchasePrice: 40000,
      salePrice: 90000,
      wholesalePrice: 80000,
    })

    expect(merged[0]).toMatchObject({ sku: 'REM-N-M', salePrice: 95000, stockQuantity: 4 })
    expect(merged[1]).toMatchObject({ clientKey: 'color=Negro|size=L', salePrice: 90000, stockQuantity: 0 })
  })
})
