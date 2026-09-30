import { describe, expect, it } from 'vitest'
import { barcodeSpellings, classifyBarcode, groupGlobalProductCandidates, gtinKey } from './barcode-catalog'

describe('códigos de barras', () => {
  it('distingue código de fabricante, interno de la tienda e inválido', () => {
    expect(classifyBarcode('7 891000 315507').kind).toBe('manufacturer')
    expect(classifyBarcode('2001234567893').kind).toBe('internal')
    expect(classifyBarcode('7891000315508').kind).toBe('invalid')
    expect(classifyBarcode('').kind).toBe('empty')
  })

  it('un UPC-A y su EAN-13 con cero adelante son el mismo producto', () => {
    expect(gtinKey('036000291452')).toBe('0036000291452')
    expect(gtinKey('0036000291452')).toBe('0036000291452')
    expect(barcodeSpellings('036000291452').sort()).toEqual(['0036000291452', '036000291452'])
    // Los códigos internos nunca van al catálogo global.
    expect(gtinKey('2001234567893')).toBeNull()
  })

  it('agrupa por código y propone lo que más repiten las tiendas', () => {
    const row = (organization_id: string, barcode: string, name: string, extra: Partial<Parameters<typeof groupGlobalProductCandidates>[0][number]> = {}) => ({
      organization_id, barcode, name, brand: null, global_brand_id: null, global_category_id: null, image_url: null, description: null, ...extra,
    })
    const candidates = groupGlobalProductCandidates([
      row('o1', '7891000315507', 'Nescafé Tradición 170 g', { brand: 'Nescafé', image_url: 'https://cdn/a.webp' }),
      row('o2', '7891000315507', 'Nescafé Tradición 170 g', { brand: 'Nescafé' }),
      row('o3', '7891000315507', 'Cafe nescafe 170g'),
      row('o1', '2001234567893', 'Producto propio'),
      row('o2', '7790895000997', 'Coca Cola 2L'),
      row('o4', '7790895000997', 'Ya en catálogo'),
    ], new Set(['7790895000997']))

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      gtin: '7891000315507',
      name: 'Nescafé Tradición 170 g',
      otherNames: ['Cafe nescafe 170g'],
      brandName: 'Nescafé',
      imageUrl: 'https://cdn/a.webp',
      stores: 3,
    })
  })
})
