import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { customerDirectoryParams, useCustomerDirectoryState } from './use-customer-directory-state'
import type { CustomerFilters } from './use-customer-state'

const organizationState = vi.hoisted(() => ({ id: null as string | null }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({
  useOptionalActiveOrganization: () => ({
    organization: organizationState.id ? { id: organizationState.id } : null,
    isLoading: !organizationState.id,
    error: null,
  }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({ on() { return this }, subscribe() { return this } }),
    removeChannel: vi.fn(),
  }),
}))

afterEach(() => {
  organizationState.id = null
  vi.unstubAllGlobals()
})

const filters: CustomerFilters = {
  search: ' Ana ', status: 'active', customer_type: 'empresa', segment: 'all',
  city: 'Asunción', assigned_salesperson: 'all',
  date_range: { from: new Date('2026-01-01T00:00:00.000Z'), to: null },
  credit_score_range: [2, 9], lifetime_value_range: [100000, Number.MAX_SAFE_INTEGER],
  tags: ['VIP', 'Mayorista'], purchases_min: 3, spent_min: 500000,
  loyalty_points_min: 10, has_credit_limit: true, has_debt: false,
}

describe('customerDirectoryParams', () => {
  it('sends page and all active filters to the server', () => {
    const params = customerDirectoryParams(filters, 2, 25)
    expect(params.get('page')).toBe('2')
    expect(params.get('limit')).toBe('25')
    expect(params.get('search')).toBe('Ana')
    expect(params.get('city')).toBe('Asunción')
    expect(params.get('purchases_min')).toBe('3')
    expect(params.get('spent_min')).toBe('500000')
    expect(params.get('lifetime_value_min')).toBe('100000')
    expect(params.getAll('tag')).toEqual(['VIP', 'Mayorista'])
    expect(params.get('registered_from')).toBe('2026-01-01T00:00:00.000Z')
    expect(params.has('has_debt')).toBe(false)
  })
})

describe('useCustomerDirectoryState', () => {
  it('espera la organización antes de consultar clientes y carga una vez cuando está lista', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { total: 0 }, summary: { total: 0, active: 0 } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = renderHook(() => useCustomerDirectoryState())
    await act(async () => { await Promise.resolve() })
    expect(fetchMock).not.toHaveBeenCalled()

    act(() => { organizationState.id = 'org-1'; rerender() })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/customers?')
  })
})
