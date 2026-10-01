import { describe, expect, it } from 'vitest'
import { planProductBrand } from './product-brand'

const catalog = [
  { id: 'g-apple', name: 'Apple', slug: 'apple', aliases: ['iPhone'], logo_url: 'https://cdn/apple.png', is_active: true },
  { id: 'g-samsung', name: 'Samsung', slug: 'samsung', aliases: [], logo_url: null, is_active: true },
]
const tenant = [
  { id: 't-apple', name: 'Apple', global_brand_id: 'g-apple' },
  { id: 't-fastrax', name: 'FASTRAX', global_brand_id: null },
]

describe('marca de un producto: texto y vínculo siempre de acuerdo', () => {
  it('el vínculo manda y el texto pasa a ser el nombre de la marca', () => {
    expect(planProductBrand({ brand: 'FTX', brand_id: 't-fastrax' }, tenant, catalog)).toEqual({ action: 'use', id: 't-fastrax', name: 'FASTRAX' })
  })

  it('un vínculo a una marca que no es de la tienda no se acepta', () => {
    expect(planProductBrand({ brand_id: 'de-otra-empresa' }, tenant, catalog)).toEqual({ action: 'invalid' })
  })

  it('solo texto: usa la marca de la tienda, aunque esté escrita distinto o por alias del catálogo', () => {
    expect(planProductBrand({ brand: 'fastrax' }, tenant, catalog)).toEqual({ action: 'use', id: 't-fastrax', name: 'FASTRAX' })
    expect(planProductBrand({ brand: 'Iphone' }, tenant, catalog)).toEqual({ action: 'use', id: 't-apple', name: 'Apple' })
  })

  it('si la tienda no la tiene, se crea; vinculada al catálogo cuando existe', () => {
    expect(planProductBrand({ brand: 'samsung' }, tenant, catalog))
      .toEqual({ action: 'create', name: 'Samsung', global_brand_id: 'g-samsung', logo_url: null })
    expect(planProductBrand({ brand: '  Arctic ' }, tenant, catalog))
      .toEqual({ action: 'create', name: 'Arctic', global_brand_id: null, logo_url: null })
  })

  it('sin texto ni vínculo, sin marca', () => {
    expect(planProductBrand({ brand: '  ', brand_id: null }, tenant, catalog)).toEqual({ action: 'clear' })
  })
})
