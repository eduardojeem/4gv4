import { describe, expect, it } from 'vitest'
import {
  addDays,
  bucketOf,
  bucketsInRange,
  daysInRange,
  granularityFor,
  isValidDay,
  rangeQuery,
  resolveCommerceRange,
  selectableYears,
} from './commerce-range'

// 16 de septiembre de 2026, mediodía en Paraguay.
const NOW = new Date('2026-09-16T15:00:00Z').getTime()

describe('período de las métricas', () => {
  it('los últimos N días terminan hoy y se comparan con los N anteriores', () => {
    const r = resolveCommerceRange({ periodo: '30' }, NOW)
    expect(r).toMatchObject({ key: '30', from: '2026-08-18', to: '2026-09-16', days: 30, short: '30 días', label: 'en los últimos 30 días' })
    expect(r.previous).toEqual({ from: '2026-07-19', to: '2026-08-17' })
  })

  it('suma 6 y 12 meses', () => {
    expect(resolveCommerceRange({ periodo: '180' }, NOW)).toMatchObject({ days: 180, short: '6 meses', granularity: 'week' })
    expect(resolveCommerceRange({ periodo: '365' }, NOW)).toMatchObject({ from: '2025-09-17', days: 365, granularity: 'month' })
  })

  it('«este año» va del 1 de enero a hoy, contra el mismo tramo del año pasado', () => {
    const r = resolveCommerceRange({ periodo: 'anio' }, NOW)
    expect(r).toMatchObject({ from: '2026-01-01', to: '2026-09-16', label: 'en lo que va de 2026', short: 'Este año' })
    expect(r.previous).toEqual({ from: '2025-01-01', to: '2025-09-16' })
  })

  it('un año completo se compara con el año anterior completo', () => {
    const r = resolveCommerceRange({ periodo: '2025' }, NOW, 2024)
    expect(r).toMatchObject({ from: '2025-01-01', to: '2025-12-31', days: 365, label: 'en 2025', granularity: 'month' })
    expect(r.previous).toEqual({ from: '2024-01-01', to: '2024-12-31' })
    // El año actual llega hasta hoy.
    expect(resolveCommerceRange({ periodo: '2026' }, NOW, 2024).to).toBe('2026-09-16')
  })

  it('un rango a elección, recortado a hoy', () => {
    const r = resolveCommerceRange({ desde: '2026-07-01', hasta: '2026-12-31' }, NOW)
    expect(r).toMatchObject({ key: 'personalizado', from: '2026-07-01', to: '2026-09-16', days: 78 })
    expect(r.previous).toEqual({ from: '2026-04-14', to: '2026-06-30' })
    expect(rangeQuery(r)).toEqual({ desde: '2026-07-01', hasta: '2026-09-16' })
  })

  it('lo inválido vuelve a 30 días', () => {
    for (const params of [
      { periodo: '45' },
      { periodo: '1999' },
      { periodo: '2030' },
      { desde: '2026-09-10', hasta: '2026-09-01' },
      { desde: '2026-02-30', hasta: '2026-03-01' },
      { desde: '2020-01-01', hasta: '2026-01-01' },
    ]) {
      expect(resolveCommerceRange(params, NOW, 2020).key, JSON.stringify(params)).toBe('30')
    }
  })

  it('los años para elegir van del actual al primero', () => {
    expect(selectableYears(NOW, 2024)).toEqual([2026, 2025, 2024])
  })
})

describe('cómo se agrupa el gráfico', () => {
  it('por día hasta dos meses, por semana hasta medio año, y después por mes', () => {
    expect(granularityFor(62)).toBe('day')
    expect(granularityFor(90)).toBe('week')
    expect(granularityFor(365)).toBe('month')
  })

  it('una semana empieza el lunes y un mes el día 1', () => {
    expect(bucketOf('2026-09-16', 'week')).toBe('2026-09-14')
    expect(bucketOf('2026-09-13', 'week')).toBe('2026-09-07')
    expect(bucketOf('2026-09-16', 'month')).toBe('2026-09-01')
  })

  it('lista las barras del período, aunque crucen de año', () => {
    expect(bucketsInRange('2025-11-15', '2026-02-03', 'month')).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01'])
    expect(bucketsInRange('2026-09-10', '2026-09-16', 'day')).toHaveLength(7)
  })

  it('cuenta fechas sin correrse por el horario', () => {
    expect(addDays('2026-10-03', 2)).toBe('2026-10-05')
    expect(daysInRange('2024-01-01', '2024-12-31')).toBe(366)
    expect(isValidDay('2024-02-29')).toBe(true)
    expect(isValidDay('2025-02-29')).toBe(false)
  })
})
