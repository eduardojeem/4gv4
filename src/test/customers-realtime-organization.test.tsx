import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const canal = vi.hoisted(() => ({
  nombres: [] as string[],
  suscripciones: [] as Array<{ event: string; filter?: string }>,
  handlers: {} as Record<string, (payload: unknown) => void>,
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: (nombre: string) => {
      canal.nombres.push(nombre)
      const builder = {
        on: (_tipo: string, config: { event: string; filter?: string }, handler: (payload: unknown) => void) => {
          canal.suscripciones.push({ event: config.event, filter: config.filter })
          canal.handlers[config.event] = handler
          return builder
        },
        subscribe: () => builder,
        unsubscribe: vi.fn(),
      }
      return builder
    },
  }),
}))

import { ActiveOrganizationProvider } from '@/contexts/ActiveOrganizationContext'
import { useCustomerState } from '@/hooks/use-customer-state'

const ORG = '11111111-1111-4111-8111-111111111111'
const CLIENTE = { id: '44444444-4444-4444-8444-444444444444', name: 'Ana', organization_id: ORG, created_at: '2026-01-01' }

function servidor(organizacion: unknown) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/organization-context')) {
      return { ok: Boolean(organizacion), status: organizacion ? 200 : 401, json: async () => ({ activeOrganization: organizacion }) }
    }
    if (url.startsWith('/api/customers/spend')) {
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) }
    }
    return { ok: true, status: 200, json: async () => ({ success: true, data: [CLIENTE], pagination: { totalPages: 1 } }) }
  }))
}

const wrapper = ({ children }: { children: ReactNode }) => <ActiveOrganizationProvider>{children}</ActiveOrganizationProvider>

beforeEach(() => {
  canal.nombres = []
  canal.suscripciones = []
  canal.handlers = {}
})

afterEach(() => { vi.unstubAllGlobals() })

/**
 * Se escuchaba toda la tabla `customers`: a quien pertenece a varias empresas le
 * aparecían en la lista clientes de otra.
 */
describe('la lista de clientes en tiempo real', () => {
  it('escucha solo la empresa activa', async () => {
    servidor({ id: ORG, name: 'DA', slug: 'dabasica', role: 'owner' })
    renderHook(() => useCustomerState(), { wrapper })

    await waitFor(() => expect(canal.nombres).toEqual([`customers_realtime:${ORG}`]))
    expect(canal.suscripciones).toContainEqual({ event: 'INSERT', filter: `organization_id=eq.${ORG}` })
    expect(canal.suscripciones).toContainEqual({ event: 'UPDATE', filter: `organization_id=eq.${ORG}` })
  })

  it('sin empresa conocida no escucha nada', async () => {
    servidor(null)
    const { result } = renderHook(() => useCustomerState(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(canal.nombres).toEqual([])
  })

  it('un alta que ya está en la lista no se agrega dos veces', async () => {
    servidor({ id: ORG, name: 'DA', slug: 'dabasica', role: 'owner' })
    const { result } = renderHook(() => useCustomerState(), { wrapper })
    await waitFor(() => expect(result.current.customers).toHaveLength(1))
    await waitFor(() => expect(canal.handlers.INSERT).toBeDefined())

    canal.handlers.INSERT({ new: CLIENTE })
    await waitFor(() => expect(result.current.customers).toHaveLength(1))
  })
})
