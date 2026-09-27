import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCashRegister } from './useCashRegister'

const queriedTables: string[] = []

function makeQuery(table: string) {
  const result = table === 'cash_closures'
    ? { data: { id: 'session-1', register_id: 'reg-1', date: null }, error: null }
    : { data: [], error: null }
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'is', 'order', 'limit', 'in', 'gte', 'lte']) {
    query[method] = vi.fn(() => query)
  }
  query.maybeSingle = vi.fn(() => Promise.resolve(result))
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return query
}

const channel = {
  on: vi.fn(() => channel),
  subscribe: vi.fn(() => channel),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      queriedTables.push(table)
      return makeQuery(table)
    },
    channel: () => channel,
    removeChannel: vi.fn(),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  }),
}))

vi.mock('@/lib/config', () => ({
  config: { supabase: { isConfigured: true } },
}))

vi.mock('@/contexts/branch-context', () => ({
  useBranch: () => ({ selectedBranchId: null }),
}))

vi.mock('@/contexts/ActiveOrganizationContext', () => ({
  useActiveOrganization: () => ({ organization: { id: 'org-1' } }),
}))

describe('useCashRegister.checkOpenSession', () => {
  beforeEach(() => {
    queriedTables.length = 0
  })

  it('keeps a stable identity after loading the session', async () => {
    const { result } = renderHook(() => useCashRegister())
    const firstCheck = result.current.checkOpenSession

    await act(async () => {
      await result.current.checkOpenSession('reg-1')
    })

    expect(result.current.currentSession?.id).toBe('session-1')
    // Si cambiara de identidad, los efectos que dependen de ella volverían a
    // consultar la caja en bucle.
    expect(result.current.checkOpenSession).toBe(firstCheck)
  })
})
