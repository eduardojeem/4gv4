import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/components/dashboard/customers/CustomerFilters.tsx'), 'utf8')

describe('panel compacto de filtros de clientes', () => {
  it('prioriza la búsqueda y después los filtros rápidos', () => {
    expect(source.indexOf('<ImprovedSearchBar')).toBeLessThan(source.indexOf('{quickFilters.map'))
  })

  it('presenta las acciones y el selector de vista una sola vez', () => {
    expect(source.match(/<ImprovedActionButtons/g)).toHaveLength(1)
    expect(source).not.toContain('aria-label="Vista de tabla"')
  })

  it('mantiene los filtros activos visibles y agrupa los controles secundarios', () => {
    expect(source.indexOf('{activeChips.map')).toBeLessThan(source.indexOf('{showMoreFilters &&'))
    expect(source).toContain('aria-expanded={showMoreFilters}')
    expect(source).toContain('aria-controls="customer-extra-filters"')
    expect(source).toContain('id="customer-extra-filters"')
    expect(source).toContain('Más filtros')
  })
})
