import { describe, expect, it } from 'vitest'
import { mergeCatalogIntoOptions, sortDeviceModels, summarizeDeviceUsage, type GlobalDeviceModel } from './global-models'

const catalog: GlobalDeviceModel[] = [
  { id: 'a15', brand: 'Samsung', model: 'Galaxy A15', device_type: 'smartphone', aliases: ['A15'], release_year: 2023, is_active: true },
  { id: 'ip13', brand: 'Apple', model: 'iPhone 13', device_type: 'smartphone', aliases: [], release_year: 2021, is_active: true },
  { id: 'old', brand: 'Nokia', model: '1100', device_type: 'smartphone', aliases: [], release_year: null, is_active: false },
]

describe('catálogo global de modelos', () => {
  it('reconoce lo que escriben las tiendas por modelo o alias, y propone lo que falta', () => {
    const { storesByModel, candidates } = summarizeDeviceUsage({
      products: [
        { organization_id: 'o1', device_brand: 'samsung', device_models: ['a15', 'A25'] },
        { organization_id: 'o2', device_brand: 'Samsung', device_models: ['Galaxy A15'] },
      ],
      repairs: [
        { organization_id: 'o1', device_brand: 'iphone', device_model: 'iphone 13' },
        { organization_id: 'o3', device_brand: 'Samsung', device_model: 'a25' },
        { organization_id: 'o3', device_brand: null, device_model: 'sin marca' },
      ],
    }, catalog)

    expect(storesByModel.get('a15')).toBe(2)
    expect(storesByModel.get('ip13')).toBe(1)
    expect(candidates).toEqual([{ brand: 'Samsung', model: 'A25', uses: 2, stores: 2 }])
  })

  it('suma el catálogo a las sugerencias de la tienda sin duplicar ni traer los de baja', () => {
    const merged = mergeCatalogIntoOptions(
      { brands: ['Motorola', 'Samsung'], modelsByBrand: { Motorola: ['G54'], Samsung: ['Galaxy A15'] } },
      catalog,
    )
    // Lo de la tienda primero, lo del catálogo después.
    expect(merged.brands).toEqual(['Motorola', 'Samsung', 'Apple'])
    expect(merged.modelsByBrand.Samsung).toEqual(['Galaxy A15'])
    expect(merged.modelsByBrand.Apple).toEqual(['iPhone 13'])
    expect(merged.brands).not.toContain('Nokia')
  })

  it('ordena por marca y en orden de modelo', () => {
    const sorted = sortDeviceModels([
      { brand: 'Apple', model: 'iPhone 13' },
      { brand: 'Apple', model: 'iPhone 11' },
      { brand: 'Apple', model: 'iPhone 12 Pro' },
    ])
    expect(sorted.map((item) => item.model)).toEqual(['iPhone 11', 'iPhone 12 Pro', 'iPhone 13'])
  })
})
