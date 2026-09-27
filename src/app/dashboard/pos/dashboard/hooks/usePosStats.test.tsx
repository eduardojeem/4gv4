import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const control = vi.hoisted(() => ({
  organizacion: { id: 'org-1' } as { id: string } | null,
  organizacionCargando: false,
  sucursal: { organization_id: 'org-1' } as { organization_id: string } | null,
  /** Consultas de ventas del periodo que esperan a que la prueba las resuelva. */
  ventasPendientes: [] as Array<{ desde: string; resolver: (v: unknown) => void }>,
  llamadas: [] as Array<{ tabla: string; filtros: unknown[][] }>,
  recientes: [] as unknown[],
}))

function consulta(tabla: string) {
  const filtros: unknown[][] = []
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'in', 'not', 'or']) {
    q[m] = vi.fn((...args: unknown[]) => {
      filtros.push([m, ...args])
      return q
    })
  }
  q.then = (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) => {
    control.llamadas.push({ tabla, filtros })
    const esVentasDelPeriodo = tabla === 'sales' && !filtros.some((f) => f[0] === 'limit')
    if (esVentasDelPeriodo) {
      const desde = String(filtros.find((f) => f[0] === 'gte')?.[2])
      return new Promise((resolver) => control.ventasPendientes.push({ desde, resolver })).then(ok, mal)
    }
    if (tabla === 'sales') return Promise.resolve({ data: control.recientes, error: null }).then(ok, mal)
    return Promise.resolve({ data: [], error: null, count: 0 }).then(ok, mal)
  }
  return q
}

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: (t: string) => consulta(t) }) }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranch: control.sucursal }) }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({
  useActiveOrganization: () => ({ organization: control.organizacion, isLoading: control.organizacionCargando }),
}))

import { usePosStats } from './usePosStats'

const venta = (id: string, total: number) => ({
  id,
  code: id,
  created_at: new Date(2026, 8, 10, 12).toISOString(),
  total,
  net: total,
  payment_method: 'efectivo',
  customer: null,
})

/** Estable entre renders, como el rango que la página guarda en useState. */
const UN_DIA = { from: new Date(2026, 8, 10) }

beforeEach(() => {
  control.organizacion = { id: 'org-1' }
  control.organizacionCargando = false
  control.sucursal = { organization_id: 'org-1' }
  control.ventasPendientes = []
  control.llamadas = []
  control.recientes = []
})

/**
 * Cambiar de «30 días» a «Hoy» dispara dos consultas a la vez. Si la de 30
 * días terminaba última, pisaba a la de hoy: el dashboard mostraba 30 días con
 * la etiqueta «Hoy».
 */
describe('cambiar el rango rápido dos veces seguidas', () => {
  it('la respuesta del rango viejo no pisa a la del nuevo', async () => {
    const treintaDias = { from: new Date(2026, 7, 12), to: new Date(2026, 8, 10) }
    const hoy = { from: new Date(2026, 8, 10), to: new Date(2026, 8, 10) }

    const { result, rerender } = renderHook(({ rango }) => usePosStats(rango), {
      initialProps: { rango: treintaDias },
    })
    await waitFor(() => expect(control.ventasPendientes).toHaveLength(1))

    rerender({ rango: hoy })
    await waitFor(() => expect(control.ventasPendientes).toHaveLength(2))

    const [viejo, nuevo] = control.ventasPendientes
    // Termina primero la de hoy, después la de 30 días.
    await act(async () => {
      nuevo.resolver({ data: [venta('hoy-1', 50_000)], error: null })
    })
    await waitFor(() => expect(result.current.stats.totalTransactions).toBe(1))

    await act(async () => {
      viejo.resolver({ data: [venta('mes-1', 10), venta('mes-2', 20), venta('mes-3', 30)], error: null })
    })

    // La de 30 días llegó tarde y se descarta.
    expect(result.current.stats.totalTransactions).toBe(1)
    expect(result.current.stats.totalSales).toBe(50_000)
    expect(result.current.loading).toBe(false)
  })
})

describe('las ventas que cuentan', () => {
  it('no suma las anuladas ni las pendientes', async () => {
    renderHook(() => usePosStats(UN_DIA))
    await waitFor(() => expect(control.llamadas.some((l) => l.tabla === 'sales')).toBe(true))

    const consultasDeVentas = control.llamadas.filter((l) => l.tabla === 'sales')
    for (const c of consultasDeVentas) {
      expect(c.filtros).toContainEqual(['or', 'status.is.null,status.in.(completed,completada)'])
    }
  })
})

describe('las transacciones recientes', () => {
  it('traen el nombre del cliente y la cantidad de artículos', async () => {
    // La lista leía campos que no existían: todas las ventas figuraban como
    // «Consumidor Final» con «undefined artículos».
    control.recientes = [
      {
        id: 'r-1',
        created_at: new Date(2026, 8, 10, 11).toISOString(),
        total: 30_000,
        payment_method: 'tarjeta',
        customer: { name: 'Ana Villalba' },
        sale_items: [{ quantity: 2 }, { quantity: 1 }],
      },
    ]
    const { result } = renderHook(() => usePosStats(UN_DIA))
    await waitFor(() => expect(control.ventasPendientes).toHaveLength(1))
    await act(async () => {
      control.ventasPendientes[0].resolver({ data: [], error: null })
    })

    await waitFor(() => expect(result.current.stats.recentSales).toHaveLength(1))
    expect(result.current.stats.recentSales[0]).toMatchObject({ customer_name: 'Ana Villalba', items_count: 3 })
  })
})

describe('sin organización', () => {
  it('termina de cargar y lo dice, en vez de quedarse cargando para siempre', async () => {
    control.organizacion = null
    control.sucursal = null
    const { result } = renderHook(() => usePosStats(UN_DIA))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error?.message).toMatch(/No hay una organización activa/)
  })

  it('mientras la organización todavía carga, espera sin mostrar error', async () => {
    control.organizacion = null
    control.sucursal = null
    control.organizacionCargando = true
    const { result } = renderHook(() => usePosStats(UN_DIA))
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.error).toBeNull()
  })

  it('usa la organización activa aunque no haya sucursal seleccionada', async () => {
    control.sucursal = null
    renderHook(() => usePosStats(UN_DIA))
    await waitFor(() => expect(control.ventasPendientes).toHaveLength(1))
    const ventas = control.llamadas.find((l) => l.tabla === 'sales')!
    expect(ventas.filtros).toContainEqual(['eq', 'organization_id', 'org-1'])
  })
})
