import { describe, expect, it } from 'vitest'
import { BUSINESS_VERTICALS } from '@/lib/organization/business-profile'
import {
  exchangeTemplateFor,
  generateProductSku,
  postSaleDefaultsFor,
  productFormProfile,
  unitsFor,
} from '@/lib/products/vertical-product-form'

const units = (vertical: string, model?: string, current?: string) =>
  productFormProfile(vertical, model, current).units.map((unit) => unit.value)

describe('formulario de producto según el rubro', () => {
  it('cada rubro tiene su perfil, y uno desconocido cae en comercio general', () => {
    for (const vertical of BUSINESS_VERTICALS) {
      const profile = productFormProfile(vertical)
      expect(profile.vertical).toBe(vertical)
      expect(profile.units.length).toBeGreaterThan(0)
      expect(profile.namePlaceholder).not.toMatch(/iPhone/)
    }
    expect(productFormProfile('rubro-inventado').vertical).toBe('general')
    expect(productFormProfile(null).label).toBe('Comercio general')
  })

  it('los ejemplos son del rubro', () => {
    expect(productFormProfile('clothing').namePlaceholder).toMatch(/Remera/)
    expect(productFormProfile('food').namePlaceholder).toMatch(/Yerba/)
    expect(productFormProfile('barbershop').namePlaceholder).toMatch(/Corte/)
    expect(productFormProfile('hardware').skuPrefix).toBe('FER')
  })

  it('las unidades son las del rubro', () => {
    expect(units('clothing')).toContain('par')
    expect(units('clothing')).not.toContain('kg')
    expect(units('hardware')).toEqual(expect.arrayContaining(['m', 'm2', 'rollo']))
    expect(units('barbershop')[0]).toBe('servicio')
    expect(units('food')).not.toContain('servicio')
  })

  it('un negocio de servicios o taller puede cargar servicios aunque su rubro no los use', () => {
    expect(units('clothing', 'service')).toContain('servicio')
    expect(units('food', 'repair')).toContain('servicio')
    expect(units('clothing', 'retail')).not.toContain('servicio')
  })

  it('al editar no se pierde la unidad que ya tenía el producto', () => {
    expect(units('clothing', 'retail', 'kg')).toContain('kg')
    expect(unitsFor('clothing', null, 'bulto').at(-1)).toEqual({ value: 'bulto', label: 'bulto' })
  })

  it('la garantía es coherente con lo que se vende', () => {
    expect(productFormProfile('food').warranty.enabled).toBe(false)
    expect(productFormProfile('food').warranty.disabledNote).toMatch(/alimentos/i)
    expect(productFormProfile('electronics').warranty.monthOptions).toContain(24)
    expect(productFormProfile('clothing').warranty.monthOptions).not.toContain(24)
    expect(productFormProfile('clothing').warranty.templates.map((t) => t.label)).toEqual(['Ropa/Calzado'])
  })

  it('postventa de un producto nuevo según el rubro', () => {
    expect(postSaleDefaultsFor('electronics').warranty_months).toBe(3)
    expect(postSaleDefaultsFor('clothing')).toMatchObject({ warranty_months: 0, exchange_window_days: 15 })
    expect(postSaleDefaultsFor('food')).toMatchObject({ warranty_months: 0, return_window_days: 0 })
    expect(postSaleDefaultsFor('cosmetics').exchange_policy).toMatch(/higiene/i)
    expect(exchangeTemplateFor('general')).toMatch(/equivalente/)
  })

  it('el SKU automático lleva el prefijo del rubro', () => {
    expect(generateProductSku('ROP', 1_700_000_000_000, 0.5)).toMatch(/^ROP-[0-9A-Z]+-[0-9A-Z]{4}$/)
  })
})
