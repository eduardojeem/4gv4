import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
const channel = vi.hoisted(() => vi.fn(() => { throw new Error('WebSocket not available') }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ channel }) }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useOptionalActiveOrganization: () => ({ organization: { id: 'local-org' }, isLoading: false }) }))
vi.mock('@/hooks/use-customer-state', () => ({ mapRawToCustomer: (row: unknown) => row, syncCustomerSpend: async () => {} }))
import { useCustomerDirectoryState } from '../hooks/use-customer-directory-state'
beforeEach(() => {
 channel.mockClear()
 vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [{ id: 'synthetic-customer' }], pagination: { total: 1 } }) })))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('read-only fallback when realtime is unavailable', () => {
 it('loads the directory even when the browser has no WebSocket', async () => {
  vi.stubGlobal('WebSocket', undefined)
  const { result } = renderHook(() => useCustomerDirectoryState())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.customers).toHaveLength(1)
  expect(result.current.error).toBeNull()
  expect(channel).not.toHaveBeenCalled()
 })
 it('does not crash or lose HTTP data when realtime construction throws', async () => {
  vi.stubGlobal('WebSocket', class {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { result } = renderHook(() => useCustomerDirectoryState())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.customers).toHaveLength(1)
  expect(result.current.error).toBeNull()
  expect(channel).toHaveBeenCalledWith('customer_directory:local-org')
 })
})
