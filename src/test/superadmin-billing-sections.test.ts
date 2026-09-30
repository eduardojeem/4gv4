import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const SECCIONES = {
  resumen: leer('src/components/superadmin/FinancialDashboard.tsx'),
  suscripciones: leer('src/components/superadmin/subscriptions/subscriptions-dashboard.tsx'),
  pagos: leer('src/components/superadmin/InvoicesDashboard.tsx'),
  planes: leer('src/components/superadmin/plans-page.tsx'),
  promociones: leer('src/components/superadmin/promo-codes-dashboard.tsx'),
  gastos: leer('src/components/superadmin/finance/PlatformFinanceCenter.tsx'),
}
const MENU = leer('src/components/superadmin/superadmin-shell.tsx')

/**
 * El grupo Facturación tenía cuatro estilos de encabezado, el MRR calculado en
 * cinco lugares con reglas distintas y los mismos contadores repetidos entre
 * secciones. Cada número vive ahora en una sola sección.
 */
describe('secciones de facturación del superadmin', () => {
  it('todas usan el mismo encabezado', () => {
    for (const [nombre, fuente] of Object.entries(SECCIONES)) {
      expect(fuente, nombre).toContain('<PageHeader')
      expect(fuente, nombre).not.toMatch(/<h1\b/)
    }
  })

  it('el MRR se muestra solo en Resumen', () => {
    expect(SECCIONES.resumen).toContain('label="MRR"')
    for (const nombre of ['suscripciones', 'planes', 'pagos', 'gastos'] as const) {
      expect(SECCIONES[nombre], nombre).not.toMatch(/label[=:]\s*['"]MRR/)
    }
  })

  it('Resumen no repite lo que ya tienen otras secciones', () => {
    expect(SECCIONES.resumen).not.toContain('Estado de suscripciones')
    expect(SECCIONES.resumen).not.toContain('Revenue total')
    expect(SECCIONES.resumen).not.toContain('/superadmin/saas-metrics')
  })

  it('el menú usa nombres cortos, en orden de uso', () => {
    const orden = ['Resumen', 'Suscripciones', 'Pagos', 'Planes', 'Promociones', 'Gastos']
    const posiciones = orden.map((titulo) => MENU.indexOf(`title: '${titulo}'`))
    expect(posiciones.every((p) => p > 0)).toBe(true)
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones)
    expect(MENU).not.toContain("title: 'Resumen financiero'")
    expect(MENU).not.toContain("title: 'Historial de pagos'")
  })
})
