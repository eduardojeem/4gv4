import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = readFileSync(resolve(process.cwd(), 'src/components/dashboard/products/stats/ProductAnalyticsDashboard.tsx'), 'utf8')

describe('ProductAnalyticsDashboard contract', () => {
  it('consulta el hook analítico con rango e inventario', () => {
    expect(SOURCE).toContain('useProductAnalytics([], {')
    expect(SOURCE).toContain('includeAlerts: true')
    expect(SOURCE).toContain('includeMovements: true')
  })

  it('tolera una colección de alertas todavía no cargada', () => {
    expect(SOURCE).toContain('alerts = [],')
    expect(SOURCE).toContain('if (alerts.length === 0)')
  })

  it('conserva resumen, categorías, proveedores y alertas como vistas separadas', () => {
    for (const tab of ['overview', 'categories', 'suppliers', 'alerts']) {
      expect(SOURCE).toContain(`value="${tab}"`)
    }
  })

  it('permite actualizar el análisis desde la interfaz', () => {
    expect(SOURCE).toContain('refreshAnalytics')
    expect(SOURCE).toContain('onClick={refreshAnalytics}')
  })
})
