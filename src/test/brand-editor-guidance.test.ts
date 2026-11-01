import { describe, expect, it } from 'vitest'
import { getBrandEditorGuidance, matchesBrandSearch } from '@/lib/website/brand-editor-guidance'
describe('orientación de marcas', () => {
 it('recomienda presets de moda solo para indumentaria', () => expect(getBrandEditorGuidance('clothing').categories).toEqual(['sports', 'fashion']))
 it.each(['electronics','cosmetics','beauty_services','barbershop','food','hardware'])('no inventa presets para %s', vertical => expect(getBrandEditorGuidance(vertical).categories).toEqual([]))
 it('usa fallback para rubros desconocidos', () => expect(getBrandEditorGuidance('unknown')).toEqual(getBrandEditorGuidance('general')))
 it('busca sin tildes ni espacios exteriores', () => {
 expect(matchesBrandSearch('Óptica Central',' optica ')).toBe(true)
 expect(matchesBrandSearch('Marca','')).toBe(true)
 expect(matchesBrandSearch('Marca','otra')).toBe(false)
 })
})
