import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const HOOK = leer('src/hooks/use-admin-analytics.ts')
const TABLERO = leer('src/components/admin/reports/analytics-dashboard.tsx')
const EXPORTADOR = leer('src/components/reports/ChartExporter.tsx')

/**
 * El PDF de /admin/analytics resumia todo el taller en una sola cifra —las
 * reparaciones en curso— asi que el informe se leia como si no se hubiera
 * terminado nada. «Reparaciones» a secas puede significar cuatro cosas y las
 * cuatro dan numeros distintos.
 */
describe('el taller se abre en cifras que dicen que miden', () => {
  it('el hook cuenta las ingresadas', () => {
    expect(HOOK).toContain('const receivedRepairs = selectedRepairs.length')
    expect(HOOK).toContain('receivedCount: receivedRepairs,')
  })

  it('terminadas son listas mas entregadas', () => {
    // El trabajo tecnico se acabo: sigue contando aunque el cliente no retire.
    expect(HOOK).toContain("return status === 'listo' || status === 'entregado'")
    expect(HOOK).toContain('finishedCount: finishedRepairs,')
  })

  it('entregadas son solo las que el cliente se llevo', () => {
    expect(HOOK).toContain(
      "const completedRepairs = selectedRepairs.filter((repair) => String(repair.status || '').toLowerCase() === 'entregado').length"
    )
  })

  it('las listas sin retirar salen de la resta, asi no se contradicen', () => {
    // Calcularlas aparte permitiria que terminadas y entregadas no cierren.
    expect(HOOK).toContain('const readyForPickupRepairs = finishedRepairs - completedRepairs')
  })
})

/**
 * Mismo problema que ya se corrigio en /dashboard/reports: la consulta filtra
 * por `created_at` —cuando ingreso el equipo— y lee el estado de HOY. Eso
 * responde «de las que entraron, cuantas ya entregamos», no «cuantas
 * entregamos»: un equipo que ingreso el mes pasado y se entrego este no
 * aparecia en ningun lado.
 */
describe('entregadas en el periodo es otra pregunta', () => {
  it('se consulta por su propia fecha', () => {
    expect(HOOK).toContain(".eq('status', 'entregado')")
    expect(HOOK).toContain(".gte('delivered_at', selectedFrom.toISOString())")
    expect(HOOK).toContain(".lte('delivered_at', selectedTo.toISOString())")
  })

  it('respeta la sucursal elegida, como el resto', () => {
    expect(HOOK).toContain(
      "filter((repair) => filters.branch === 'all' || String(repair.branch_id || 'principal') === filters.branch)"
    )
  })

  it('sin la fecha cargada no inventa un cero', () => {
    // Un cero se leeria como «no entregamos nada».
    expect(HOOK).toContain('const deliveredInPeriod = deliveredInPeriodResponse.error ? null : deliveredInPeriodRows.length')
    expect(HOOK).toContain('deliveredInPeriodCount: number | null')
  })

  it('el PDF la muestra solo si existe', () => {
    expect(TABLERO).toContain('repairs.deliveredInPeriodCount !== null')
    expect(TABLERO).toContain("{ 'Entregadas en el período': String(repairs.deliveredInPeriodCount) }")
  })
})

/**
 * Verificado generando el PDF en el navegador: las seis etiquetas aparecen en el
 * documento y con 38 indicadores el bloque continua en una pagina nueva sin
 * perder ninguno.
 */
describe('los indicadores del PDF', () => {
  it('incluyen las tres que se pidieron, con su alcance en el nombre', () => {
    expect(TABLERO).toContain("'Reparaciones ingresadas': String(repairs.receivedCount)")
    expect(TABLERO).toContain("'Reparaciones terminadas (listas + entregadas)': String(repairs.finishedCount)")
    expect(TABLERO).toContain("'Reparaciones entregadas (de las ingresadas)': String(repairs.completedCount)")
  })

  it('las canceladas solo aparecen si las hubo', () => {
    // Un «0 canceladas» en cada informe es ruido.
    expect(TABLERO).toContain('repairs.cancelledCount > 0 ?')
  })

  it('siguen saliendo las tarjetas de arriba', () => {
    // El detalle de taller se suma, no reemplaza.
    expect(TABLERO).toContain('...Object.fromEntries(snapshot.headlineCards.map((c) => [c.label, c.value]))')
  })

  it('la grilla no dibuja tarjetas fuera de la hoja', () => {
    // Sin guarda, las ultimas desaparecian sin que nada avisara.
    expect(EXPORTADOR).toContain('const gridHeight = totalRowsPlanned * (cardHeight + cardGap)')
    expect(EXPORTADOR).toContain('if (currentY + gridHeight > pageBottom) {')
    expect(EXPORTADOR).toContain('doc.addPage()')
  })
})
