import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const llamadas = vi.hoisted(() => [] as Array<{ organizationId: string; ids: string[] }>)

vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_o: unknown, handler: (req: unknown, ctx: unknown) => unknown) =>
    (request: unknown) => handler(request, { organization: { id: 'org-1' }, user: { id: 'u1' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({}) }))
vi.mock('@/lib/customers/customer-spend-server', () => ({
  loadCustomerSpend: async (_c: unknown, organizationId: string, ids: string[]) => {
    llamadas.push({ organizationId, ids })
    return { [ids[0]]: { total: 1 } }
  },
}))

import { POST } from '@/app/api/customers/spend/route'

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8')
const ID = '44444444-4444-4444-8444-444444444444'

const pedir = (body: unknown) => (POST as unknown as (r: NextRequest) => Promise<Response>)(
  new NextRequest('http://localhost/api/customers/spend', { method: 'POST', body: JSON.stringify(body) }),
)

describe('/api/customers/spend', () => {
  it('calcula para la empresa activa', async () => {
    const response = await pedir({ ids: [ID] })
    expect(response.status).toBe(200)
    expect(llamadas.at(-1)).toEqual({ organizationId: 'org-1', ids: [ID] })
  })

  it('rechaza IDs que no son de cliente', async () => {
    expect((await pedir({ ids: ['1 or 1=1'] })).status).toBe(400)
    expect((await pedir({ ids: [] })).status).toBe(400)
  })
})

/**
 * Lista, detalle y analítica daban tres «gastados» distintos para el mismo
 * cliente: cada uno leía otra fuente con otra regla.
 */
describe('todas las pantallas de clientes usan la misma cuenta', () => {
  it('el mapa de la lista viene del servidor, no de consultas sueltas en el navegador', () => {
    const metricas = leer('src/hooks/use-customer-metrics.ts')
    const mapa = metricas.slice(metricas.indexOf('export function useCustomerSalesMetricsMap'), metricas.indexOf('export function useCustomerMetrics'))
    expect(mapa).toContain('fetchCustomerSpend(ids)')
    expect(mapa).not.toContain(".from('sales')")
  })

  it('la analítica suma lo gastado real y descarta ventas anuladas por mes', () => {
    const metricas = leer('src/hooks/use-customer-metrics.ts')
    expect(metricas).not.toContain('total_spent_this_year ?? c.lifetime_value')
    expect(metricas).toMatch(/if \(!isCountableSale\([\w.]+\.status\)\) continue/)
  })

  it('el detalle toma el mismo cálculo que la lista y no la última edición como visita', () => {
    const detalle = leer('src/components/dashboard/customers/CustomerDetail.tsx')
    expect(detalle).toContain('useCustomerSalesMetricsMap([currentCustomer.id])')
    expect(detalle).not.toMatch(/currentCustomer\.last_activity,/)
    expect(detalle).toContain('keepComputedSpend({ ...customer, ...freshData } as Customer, customer)')
  })

  it('la lista enriquece al cargar, al recargar y no duplica al crear', () => {
    const estado = leer('src/hooks/use-customer-state.ts')
    const acciones = leer('src/hooks/use-customer-actions.ts')
    expect(estado).toContain('void enrich(page1Customers)')
    expect(estado).toContain('if (prev.customers.some((customer) => customer.id === mappedCustomer.id)) return prev')
    expect(estado).toContain('keepComputedSpend(mappedCustomer, c)')
    expect(acciones).toContain('void syncCustomerSpend(setState, customers)')
    expect(acciones).toContain('if (prev.customers.some((item) => item.id === customer.id)) return prev')
  })
})
