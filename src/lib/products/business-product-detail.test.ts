import { describe, expect, it } from 'vitest'
import { businessProductDetail } from './business-product-detail'

describe('detalle por rubro con datos guardados', () => {
  it('traduce atributos de cosmética sin completar datos faltantes', () => {
    const result = businessProductDetail({ unit_measure: 'unidad', variants: [{ attributes: { skin_type: 'Mixta', volume: '50 ml' } }] }, 'cosmetics')
    expect(result.rows).toEqual(expect.arrayContaining([{ label: 'Tipo de piel', value: 'Mixta' }, { label: 'Volumen', value: '50 ml' }]))
    expect(result.tracksExpiry).toBe(true)
    expect(result.rows.some(row => row.label === 'Tono')).toBe(false)
  })
  it('no mezcla opciones de otras variantes al elegir una', () => {
    const result = businessProductDetail({ variants: [{ attributes: { tone: 'Rojo' } }] }, 'cosmetics', [{ attribute_name: 'tone', value: 'Rosa' }])
    expect(result.rows).toContainEqual({ label: 'Tono', value: 'Rosa' })
    expect(result.rows.some(row => row.value.includes('Rojo'))).toBe(false)
  })
  it('conserva atributos personalizados y excluye variantes inactivas', () => {
    const result = businessProductDetail({ variant_attribute_config: [{ key: 'finish', label: 'Acabado' }], variants: [{ is_active: false, attributes: { finish: 'Mate' } }, { attributes: { finish: 'Brillante' } }] }, 'clothing')
    expect(result.rows).toContainEqual({ label: 'Acabado', value: 'Brillante' })
    expect(result.tracksExpiry).toBe(false)
  })
  it('no presenta servicios como productos perecederos', () => {
    expect(businessProductDetail({ unit_measure: 'servicio' }, 'cosmetics').tracksExpiry).toBe(false)
    expect(businessProductDetail({ unit_measure: 'servicio' }, 'beauty_services').isService).toBe(true)
  })
  it('muestra compatibilidad y garantía solo si existen y tolera rubros antiguos', () => {
    const result = businessProductDetail({ device_brand: 'Samsung', device_models: ['A54'], warranty_months: 6 }, 'electronics')
    expect(result.rows).toContainEqual({ label: 'Compatible con', value: 'Samsung · A54' })
    expect(result.rows).toContainEqual({ label: 'Garantía registrada', value: '6 meses' })
    expect(businessProductDetail({}, 'desconocido').rows).toEqual([])
  })
})
