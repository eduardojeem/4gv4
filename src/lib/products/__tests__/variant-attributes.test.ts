import { describe, expect, it } from 'vitest'
import { normalizeVariantAttributeValues } from '@/lib/products/variant-attributes'

describe('normalizeVariantAttributeValues', () => {
  it('convierte atributos JSON del producto al contrato que usa el selector POS', () => {
    expect(normalizeVariantAttributeValues({
      color: 'Azul Marino',
      size: 'L',
      image_url: '/images/products/remera.jpg',
    })).toEqual([
      expect.objectContaining({ attribute_id: 'color', option_id: 'Azul Marino', value: 'Azul Marino' }),
      expect.objectContaining({ attribute_id: 'size', option_id: 'L', value: 'L' }),
    ])
  })

  it('conserva el formato relacional cuando ya viene como arreglo', () => {
    const attributes = [{
      attribute_id: 'attr-color',
      attribute_name: 'Color',
      option_id: 'blue',
      value: 'Azul',
    }]
    expect(normalizeVariantAttributeValues(attributes)).toEqual(attributes)
  })
})
