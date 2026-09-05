import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeReportPeriod } from './section-pdf-exporter'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const EXPORTADOR = leer('src/lib/reports/section-pdf-exporter.ts')

/**
 * Un PDF de ventas decia solo "Emisión: <ahora>". No el período que cubre, ni
 * la sucursal filtrada, ni quién lo pidió. Dos reportes del mismo local, uno de
 * enero y otro de marzo, salían indistinguibles una vez descargados.
 */
describe('el período que cubre el reporte', () => {
  it('describe el rango con la cantidad de días', () => {
    expect(describeReportPeriod({
      periodFrom: new Date(2026, 2, 1),
      periodTo: new Date(2026, 2, 31),
    })).toBe('01/03/2026 al 31/03/2026 (31 días)')
  })

  it('cuenta un solo día en singular', () => {
    const dia = new Date(2026, 2, 15)
    expect(describeReportPeriod({ periodFrom: dia, periodTo: dia })).toBe('15/03/2026 al 15/03/2026 (1 día)')
  })

  it('acepta fechas en texto', () => {
    expect(describeReportPeriod({ periodFrom: '2026-03-01T00:00:00', periodTo: '2026-03-02T23:59:59' }))
      .toContain('01/03/2026 al 02/03/2026')
  })

  it('no inventa nada si no le pasan el rango', () => {
    expect(describeReportPeriod()).toBe('')
    expect(describeReportPeriod({})).toBe('')
    expect(describeReportPeriod({ periodFrom: null, periodTo: null })).toBe('')
  })

  it('no rompe con una fecha inválida', () => {
    expect(describeReportPeriod({ periodFrom: 'no es fecha', periodTo: 'tampoco' })).toBe('')
  })
})

describe('el contexto llega a las cinco exportaciones', () => {
  it('todas aceptan el contexto', () => {
    expect([...EXPORTADOR.matchAll(/context\?: ReportContext/g)].length).toBeGreaterThanOrEqual(5)
  })

  it('la portada y el pie lo reciben', () => {
    expect([...EXPORTADOR.matchAll(/renderExecutiveCoverHeader\([^)]*params\.context\)/g)]).toHaveLength(5)
    expect([...EXPORTADOR.matchAll(/setupDocPageHeadersAndFooters\([^)]*params\.context\)/g)]).toHaveLength(5)
  })

  it('el pie lleva el período en todas las páginas', () => {
    // Si alguien imprime solo la hoja 3, ahí tiene que decir de qué período habla.
    const pie = EXPORTADOR.slice(EXPORTADOR.indexOf('const pie = ['))
    expect(pie.slice(0, 300)).toContain('`Período ${periodo}`')
    expect(pie.slice(0, 300)).toContain('`por ${context.generatedBy.trim()}`')
  })

  it('dice la sucursal incluso cuando son todas', () => {
    // Un reporte de una sucursal que no lo aclara se lee como el del negocio entero.
    expect(EXPORTADOR).toContain("`Sucursal: ${context?.branchName?.trim() || 'Todas'}`")
  })

  it('el contenido baja cuando la portada crece', () => {
    // Sin esto el primer bloque de KPIs quedaba encima de la franja del período.
    expect([...EXPORTADOR.matchAll(/let y = coverBottom\(params\.context\)/g)]).toHaveLength(5)
    expect(EXPORTADOR).not.toContain('let y = 104')
  })
})

/**
 * Las tablas de tendencia hacían `slice(0, 31)` mientras el pie seguía
 * anunciando el total del período entero: con 60 días las filas no sumaban lo
 * que decía el pie, y nada lo explicaba.
 */
describe('no se recortan filas en silencio', () => {
  it('ya no queda el tope de 31', () => {
    expect(EXPORTADOR).not.toMatch(/\.slice\(0,\s*31\)/)
  })

  it('avisa cuando el tope aplica', () => {
    expect([...EXPORTADOR.matchAll(/renderOmittedNote\(doc,/g)]).toHaveLength(2)
    expect(EXPORTADOR).toContain('Los totales del pie sí incluyen todo el período')
  })
})

describe('los cinco PDF llevan el nombre del negocio', () => {
  const pagina = leer('src/app/dashboard/reports/page.tsx')
  const productos = leer('src/components/reports/ReportsProductsTab.tsx')
  const creditos = leer('src/components/reports/ReportsCreditsTab.tsx')

  it('las tres de la página ya lo llevaban', () => {
    expect([...pagina.matchAll(/- \$\{reportBrand\}`/g)].length).toBeGreaterThanOrEqual(3)
  })

  it('las dos de las pestañas ahora también', () => {
    // Estas dos tenían el título fijo, sin el negocio.
    expect(productos).toContain("${brand ? ` - ${brand}` : ''}")
    expect(creditos).toContain("${brand ? ` - ${brand}` : ''}")
    expect(productos).not.toContain("title: 'Reporte de Productos Más Vendidos'")
    expect(creditos).not.toContain("title: 'Reporte de Créditos y Cartera'")
  })

  it('la página les pasa el contexto', () => {
    expect([...pagina.matchAll(/context=\{reportContext\}/g)]).toHaveLength(2)
    expect([...pagina.matchAll(/context: reportContext,/g)]).toHaveLength(3)
  })

  it('el contexto sale del filtro real de la pantalla', () => {
    // Si el período del PDF no fuera el mismo que filtra los datos, el
    // encabezado mentiría, que es peor que no decir nada.
    const bloque = pagina.slice(pagina.indexOf('const reportContext = useMemo'))
    expect(bloque.slice(0, 400)).toContain('periodFrom: dateRange.from')
    expect(bloque.slice(0, 400)).toContain('periodTo: dateRange.to')
    expect(bloque.slice(0, 400)).toContain('branchName: selectedBranch?.name')
  })
})
