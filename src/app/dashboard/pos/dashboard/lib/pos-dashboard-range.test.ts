import { describe, expect, it } from 'vitest'

import { QUICK_RANGES, activeQuickRange, buildDailySales, rangeBounds } from './pos-dashboard-range'

// Mediodía local: lejos de los bordes del día, en cualquier zona horaria.
const AHORA = new Date(2026, 8, 10, 12, 0, 0)
const rango = (key: string) => QUICK_RANGES.find((q) => q.key === key)!.getRange(AHORA)

describe('los rangos rápidos', () => {
  it('cubren los días que dicen, contando hoy', () => {
    const siete = rango('last7')
    expect(siete.from!.getDate()).toBe(4)
    expect(siete.to!.getDate()).toBe(10)

    const treinta = rango('last30')
    expect(treinta.from!.getMonth()).toBe(7) // 12 de agosto
    expect(treinta.from!.getDate()).toBe(12)

    const mes = rango('thisMonth')
    expect(mes.from!.getDate()).toBe(1)
    expect(mes.from!.getMonth()).toBe(8)
  })

  it('se reconoce cuál está aplicado, para poder resaltarlo', () => {
    // Antes ningún botón quedaba marcado después de tocarlo.
    for (const quick of QUICK_RANGES) {
      expect(activeQuickRange(quick.getRange(AHORA), AHORA)).toBe(quick.key)
    }
  })

  it('un rango elegido a mano no marca ningún botón', () => {
    expect(activeQuickRange({ from: new Date(2026, 7, 3), to: new Date(2026, 7, 9) }, AHORA)).toBeNull()
    expect(activeQuickRange(undefined, AHORA)).toBeNull()
  })

  it('el horario no cambia cuál está activo', () => {
    // El calendario devuelve medianoche; los botones, la hora actual.
    expect(activeQuickRange({ from: new Date(2026, 8, 10), to: new Date(2026, 8, 10) }, AHORA)).toBe('today')
  })
})

describe('los límites del día', () => {
  it('van del inicio del primer día al final del último', () => {
    const b = rangeBounds({ from: new Date(2026, 8, 4, 15), to: new Date(2026, 8, 10, 9) })!
    expect(new Date(b.from).getHours()).toBe(0)
    expect(new Date(b.to).getHours()).toBe(23)
    expect(new Date(b.to).getMinutes()).toBe(59)
  })

  it('con un solo día elegido usa ese día como fin', () => {
    const b = rangeBounds({ from: new Date(2026, 8, 10, 15) })!
    expect(new Date(b.to).getDate()).toBe(10)
  })

  it('sin rango no inventa uno', () => {
    expect(rangeBounds(undefined)).toBeNull()
    expect(rangeBounds({ from: undefined })).toBeNull()
  })
})

describe('las ventas por día', () => {
  it('rellena los días sin ventas con cero', () => {
    const puntos = buildDailySales({ from: new Date(2026, 8, 8), to: new Date(2026, 8, 10) }, [
      { created_at: new Date(2026, 8, 9, 14).toISOString(), total: 50_000 },
    ])
    expect(puntos.map((p) => [p.date, p.sales, p.transactions])).toEqual([
      ['08/09', 0, 0],
      ['09/09', 50_000, 1],
      ['10/09', 0, 0],
    ])
  })

  it('no mezcla el mismo día de dos años distintos', () => {
    // Agrupaba por «dd/MM»: el 10/09/2025 caía en la barra del 10/09/2026.
    const puntos = buildDailySales({ from: new Date(2025, 8, 10), to: new Date(2026, 8, 10) }, [
      { created_at: new Date(2025, 8, 10, 12).toISOString(), total: 10 },
      { created_at: new Date(2026, 8, 10, 12).toISOString(), total: 99 },
    ])
    expect(puntos[0]).toMatchObject({ date: '10/09/25', sales: 10 })
    expect(puntos[puntos.length - 1]).toMatchObject({ date: '10/09/26', sales: 99 })
  })

  it('un total nulo no rompe la suma', () => {
    const [punto] = buildDailySales({ from: new Date(2026, 8, 10) }, [
      { created_at: new Date(2026, 8, 10, 10).toISOString(), total: null },
    ])
    expect(punto.sales).toBe(0)
    expect(punto.transactions).toBe(1)
  })
})
