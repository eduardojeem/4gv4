import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { calculateSessionFigures, openDurationHours, storedNumber } from './session-figures'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const HOOK = leer('src/app/admin/cash-monitor/hooks/useCashMonitor.ts')

const SIN_MOVIMIENTOS = {
  total: 0,
  totalSales: 0,
  salesCash: 0,
  salesCard: 0,
  salesTransfer: 0,
  salesMixed: 0,
  cashIn: 0,
  cashOut: 0,
}

/**
 * El monitor preguntaba `columnaDb > 0 ? columnaDb : calculadoDeMovimientos`.
 * Un turno sin ventas vale cero, y cero es un dato: se lo trataba como columna
 * vacia. Si la base decia 0 y los movimientos sumaban 500.000, la pantalla
 * mostraba 500.000 y tapaba justo la contradiccion que un arqueo debe exponer.
 */
describe('un cero guardado no es una columna vacia', () => {
  it('respeta un cero de la base en vez de reemplazarlo', () => {
    const figures = calculateSessionFigures(
      { total_sales: 0 },
      { ...SIN_MOVIMIENTOS, total: 4, totalSales: 500_000 }
    )

    expect(figures.totalSales).toBe(0)
  })

  it('y avisa que la base y los movimientos no dicen lo mismo', () => {
    const figures = calculateSessionFigures(
      { total_sales: 0 },
      { ...SIN_MOVIMIENTOS, total: 4, totalSales: 500_000 }
    )

    expect(figures.salesMismatch).toBe(500_000)
  })

  it('sin la columna cargada si usa los movimientos', () => {
    const figures = calculateSessionFigures(
      { total_sales: null },
      { ...SIN_MOVIMIENTOS, total: 2, totalSales: 300_000 }
    )

    expect(figures.totalSales).toBe(300_000)
    // No hay contra que comparar: no es un hallazgo.
    expect(figures.salesMismatch).toBeNull()
  })

  it('cuando coinciden no hay nada que avisar', () => {
    const figures = calculateSessionFigures(
      { total_sales: 300_000 },
      { ...SIN_MOVIMIENTOS, total: 2, totalSales: 300_000 }
    )

    expect(figures.salesMismatch).toBeNull()
  })

  it('una caja que se espera en cero no cae en el balance calculado', () => {
    // Con `Number(...) || balance`, un esperado de 0 —todo retirado— se
    // reemplazaba y el arqueo comparaba contra otra cosa.
    const figures = calculateSessionFigures(
      { expected_balance: 0, opening_balance: 200_000, total_sales: 100_000 },
      SIN_MOVIMIENTOS
    )

    expect(figures.expectedBalance).toBe(0)
    expect(figures.currentBalance).toBe(300_000)
  })

  it('el cierre guardado manda sobre el calculo', () => {
    const figures = calculateSessionFigures(
      { closing_balance: 0, opening_balance: 200_000, total_sales: 100_000 },
      SIN_MOVIMIENTOS
    )

    expect(figures.currentBalance).toBe(0)
  })

  it('lo que no es un numero se ignora', () => {
    expect(storedNumber('')).toBeNull()
    expect(storedNumber(null)).toBeNull()
    expect(storedNumber(undefined)).toBeNull()
    expect(storedNumber('no es plata')).toBeNull()
    expect(storedNumber(0)).toBe(0)
    expect(storedNumber('150000')).toBe(150_000)
  })

  it('acepta el nombre viejo de la columna de ventas', () => {
    expect(calculateSessionFigures({ sales_total: 90_000 }, SIN_MOVIMIENTOS).totalSales).toBe(90_000)
    // `total_sales` gana si estan las dos.
    expect(
      calculateSessionFigures({ total_sales: 10, sales_total: 90_000 }, SIN_MOVIMIENTOS).totalSales
    ).toBe(10)
  })
})

/**
 * `duration_hours` se calculaba con `s.status === 'open'` —el estado CRUDO de la
 * fila— mientras que tres lineas mas arriba el estado mostrado se derivaba de
 * `date`. La RPC que abre la caja inserta sin tocar `status`, asi que ninguna
 * caja abierta mostraba cuanto llevaba abierta: lo primero que un monitor de
 * cajas tiene que decir.
 */
describe('cuanto lleva abierta una caja', () => {
  const ahora = new Date('2026-09-06T18:00:00Z')

  it('se mide mientras no tenga fecha de cierre', () => {
    expect(
      openDurationHours({ date: null, created_at: '2026-09-06T09:30:00Z' }, ahora)
    ).toBe(8.5)
  })

  it('no depende del status crudo, que la apertura no escribe', () => {
    // Sin `status`, con `status` null, o con cualquier otra cosa: si no tiene
    // fecha de cierre, sigue abierta.
    expect(openDurationHours({ created_at: '2026-09-06T17:00:00Z' }, ahora)).toBe(1)
    expect(
      openDurationHours({ date: null, created_at: '2026-09-06T17:00:00Z' }, ahora)
    ).toBe(1)
  })

  it('una cerrada no tiene duracion abierta', () => {
    expect(
      openDurationHours({ date: '2026-09-06', created_at: '2026-09-06T09:00:00Z' }, ahora)
    ).toBeUndefined()
  })

  it('una fecha de apertura invalida no devuelve NaN', () => {
    expect(openDurationHours({ date: null, created_at: 'cualquier cosa' }, ahora)).toBeUndefined()
    expect(openDurationHours({ date: null }, ahora)).toBeUndefined()
  })

  it('un reloj corrido no produce horas negativas', () => {
    expect(
      openDurationHours({ date: null, created_at: '2026-09-06T19:00:00Z' }, ahora)
    ).toBe(0)
  })
})

/**
 * Las metricas —ventas, sobrantes, faltantes— se calculaban sobre las 200
 * sesiones mas recientes y sobre lo que quedaba despues del filtro de
 * diferencia. Un mes con varias cajas pasa ese corte, y nada lo decia.
 */
describe('los totales cubren el periodo, no un recorte', () => {
  it('la consulta de sesiones ya no tiene tope fijo', () => {
    // El `.limit(200)` que queda es el de la lista de alertas, que es otra
    // cosa: ahi el tope es de la lista, no de los contadores.
    const consultaSesiones = HOOK.slice(
      HOOK.indexOf('const buildQuery = () => {'),
      HOOK.indexOf('return q')
    )
    expect(consultaSesiones).not.toContain('.limit(')
    expect(HOOK).toContain('const PAGE_SIZE = 500')
    expect(HOOK).toContain('const SAFETY_CAP = 3000')
  })

  it('cada pagina arma su propia consulta', () => {
    // Reutilizar el mismo builder despues de esperarlo es un camino conocido a
    // resultados raros.
    expect(HOOK).toContain('const buildQuery = () => {')
    expect(HOOK).toContain('await buildQuery()')
  })

  it('si el tope se alcanza, se puede avisar', () => {
    expect(HOOK).toContain('setTruncatedSessions(Math.max(0, totalAvailable - collected.length))')
    const PAGINA = leer('src/app/admin/cash-monitor/page.tsx')
    expect(PAGINA).toContain('turnos más de los que se cargaron')
  })

  it('el filtro de diferencia recorta la tabla, no las metricas', () => {
    expect(HOOK).toContain('setPeriodSessions(mapped)')
    expect(HOOK).toContain('const open = periodSessions.filter')
    expect(HOOK).toContain('}, [periodSessions, alertCounts])')
  })

  it('las alertas sin resolver se cuentan en la base', () => {
    // Con `.limit(50)` en la lista, 60 sin resolver se mostraban como menos.
    expect(HOOK).toContain("select('id', { count: 'exact', head: true })")
    expect(HOOK).toContain('const unresolvedAlerts = alertCounts.unresolved')
    expect(HOOK).toContain('const criticalAlerts = alertCounts.critical')
  })

  it('una alerta que llega en vivo mueve el contador', () => {
    expect(HOOK).toContain('unresolved: counts.unresolved + 1,')
  })
})
