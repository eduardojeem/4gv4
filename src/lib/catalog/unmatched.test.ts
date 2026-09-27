import { describe, expect, it } from 'vitest'
import { groupUnmatched } from './unmatched'
import { normalizeBrandName } from '@/lib/brands/global-catalog'

/**
 * El panel decía «0 pendientes» mientras 99 de 105 marcas de empresas seguían
 * sueltas: no coincidían con el catálogo porque el catálogo no las tenía.
 */
describe('lo que falta en el catálogo', () => {
  const rows = [
    { id: '1', name: 'Xiaomi', organizationName: '4G celulares' },
    { id: '2', name: 'xiaomi', organizationName: 'HCA Celular' },
    { id: '3', name: 'XIAOMI', organizationName: '4G celulares' },
    { id: '4', name: 'JBL', organizationName: 'Store Center' },
  ]

  it('agrupa el mismo nombre escrito distinto y cuenta cuántas fichas lo usan', () => {
    const [primero] = groupUnmatched(rows, normalizeBrandName)
    expect(primero.count).toBe(3)
    expect(primero.ids).toEqual(['1', '2', '3'])
  })

  it('primero lo más usado: crear eso es lo que más ordena', () => {
    expect(groupUnmatched(rows, normalizeBrandName).map((entry) => entry.name)).toEqual(['Xiaomi', 'JBL'])
  })

  it('no repite la empresa aunque tenga dos fichas con ese nombre', () => {
    expect(groupUnmatched(rows, normalizeBrandName)[0].organizations).toEqual(['4G celulares', 'HCA Celular'])
  })

  /** Un nombre a los gritos se lee peor y quedaría así en todo el marketplace. */
  it('propone la escritura más legible cuando hay empate', () => {
    const empate = [
      { id: '1', name: 'SPEED', organizationName: 'MA' },
      { id: '2', name: 'Speed', organizationName: 'Tecno' },
    ]
    expect(groupUnmatched(empate, normalizeBrandName)[0].name).toBe('Speed')
  })

  it('ignora los nombres vacíos y corta la lista larga', () => {
    const muchos = Array.from({ length: 30 }, (_, index) => ({ id: String(index), name: `Marca ${index}` }))
    expect(groupUnmatched([...muchos, { id: 'x', name: '  ' }], normalizeBrandName, 10)).toHaveLength(10)
  })
})
