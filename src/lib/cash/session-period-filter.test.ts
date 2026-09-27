import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildSessionPeriodFilter } from './session-period-filter'

const AHORA = new Date('2026-09-06T12:00:00Z')

/**
 * `created_at` de un turno es CUANDO SE ABRIO. Con el filtro por defecto —los
 * ultimos 7 dias— una caja abierta hace diez dias quedaba fuera de la consulta:
 * «Cajas Abiertas en Vivo» mostraba 0 teniendo una abierta en ese momento, y la
 * pestaña En Vivo salia vacia.
 *
 * Justo la caja que mas hay que mirar —la que lleva mas tiempo abierta— era la
 * que desaparecia.
 */
describe('una caja abierta no depende del periodo', () => {
  it('el periodo por defecto la deja entrar igual', () => {
    const filtro = buildSessionPeriodFilter({}, AHORA)

    expect(filtro.keepOpen).toBe(true)
    expect(filtro.orExpression).toBe('date.is.null,created_at.gte.2026-08-30T12:00:00.000Z')
  })

  it('tambien con un rango explicito de fechas', () => {
    const filtro = buildSessionPeriodFilter(
      { dateFrom: '2026-09-01T00:00:00.000Z', dateTo: '2026-09-03T00:00:00.000Z' },
      AHORA
    )

    expect(filtro.orExpression).toBe(
      'date.is.null,and(created_at.gte.2026-09-01T00:00:00.000Z,created_at.lte.2026-09-03T00:00:00.000Z)'
    )
  })

  it('si se piden solo las cerradas, no se fuerza nada', () => {
    // Ahi la pregunta es explicitamente por el historial.
    const filtro = buildSessionPeriodFilter({ status: 'closed' }, AHORA)

    expect(filtro.keepOpen).toBe(false)
    expect(filtro.orExpression).toBeNull()
    expect(filtro.from).toBe('2026-08-30T12:00:00.000Z')
  })

  it('con el historial completo no hace falta ningun rango', () => {
    const filtro = buildSessionPeriodFilter({ period: 'all' }, AHORA)

    expect(filtro.from).toBeNull()
    expect(filtro.to).toBeNull()
    expect(filtro.orExpression).toBeNull()
  })
})

describe('los periodos se calculan desde ahora', () => {
  it('hoy arranca a la medianoche local', () => {
    const filtro = buildSessionPeriodFilter({ period: 'today' }, AHORA)
    const desde = new Date(filtro.from!)

    expect(desde.getHours()).toBe(0)
    expect(desde.getMinutes()).toBe(0)
    expect(desde.getDate()).toBe(AHORA.getDate())
  })

  it('mes y año retroceden lo que dicen', () => {
    expect(buildSessionPeriodFilter({ period: 'month' }, AHORA).from).toBe('2026-08-06T12:00:00.000Z')
    expect(buildSessionPeriodFilter({ period: 'year' }, AHORA).from).toBe('2025-09-06T12:00:00.000Z')
  })

  it('las fechas explicitas le ganan al periodo', () => {
    const filtro = buildSessionPeriodFilter(
      { period: 'year', dateFrom: '2026-09-05T00:00:00.000Z' },
      AHORA
    )

    expect(filtro.from).toBe('2026-09-05T00:00:00.000Z')
  })
})

describe('el monitor usa este filtro', () => {
  const HOOK = readFileSync(
    resolve(process.cwd(), 'src/app/admin/cash-monitor/hooks/useCashMonitor.ts'),
    'utf8'
  )

  it('ya no arma el rango a mano', () => {
    expect(HOOK).toContain('const rango = buildSessionPeriodFilter(filter)')
    expect(HOOK).not.toContain("let periodCutoff: Date | null = null")
  })

  it('aplica la expresion `or` cuando corresponde', () => {
    expect(HOOK).toContain('if (rango.orExpression) {')
    expect(HOOK).toContain('q = q.or(rango.orExpression)')
  })
})
