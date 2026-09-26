import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = readFileSync(resolve(process.cwd(), 'src/hooks/products/useProductAnalytics.ts'), 'utf8')

describe('useProductAnalytics contract', () => {
  it('aplica la sucursal seleccionada a las consultas analíticas', () => {
    expect(SOURCE).toContain('const { selectedBranchId } = useBranch()')
    expect(SOURCE).toContain('selectedBranchId')
  })

  it('estabiliza la configuración para evitar recargas infinitas', () => {
    expect(SOURCE).toContain('const stableConfig = useMemo')
    expect(SOURCE).toContain('config.dateRange?.start?.getTime()')
    expect(SOURCE).toContain('config.dateRange?.end?.getTime()')
  })

  it('valida rangos de fechas antes de consultar', () => {
    expect(SOURCE).toContain('validateAnalyticsConfig')
    expect(SOURCE).toContain('config.dateRange.start > config.dateRange.end')
  })

  it('expone actualización, exportación y recuperación', () => {
    expect(SOURCE).toContain('refreshAnalytics: loadAnalyticsData')
    expect(SOURCE).toContain('exportAnalyticsData,')
    expect(SOURCE).toContain('retryLastOperation,')
  })
})
