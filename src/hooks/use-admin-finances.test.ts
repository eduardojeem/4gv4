import { createElement, type PropsWithChildren } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { adminFinanceSummarySWRConfig, useAdminFinances } from './use-admin-finances'

vi.mock('@/contexts/branch-context', () => ({
  useBranch: () => ({ selectedBranchId: null, selectedBranch: null }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function wrapper({ children }: PropsWithChildren) {
  return createElement(SWRConfig, { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
}

function response(payload: unknown, ok = true) {
  return { ok, json: async () => payload } as Response
}

describe('admin finance scope transitions', () => {
  it('ignores an outdated organization resolution and waits for the new summary', async () => {
    let pendingOrganization!: (value: Response) => void
    let pendingSummary!: (value: Response) => void
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ activeOrganization: { id: 'org-a' } }))
      .mockResolvedValueOnce(response({ label: 'org-a' }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { pendingOrganization = resolve }))
      .mockResolvedValueOnce(response({ activeOrganization: { id: 'org-c' } }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { pendingSummary = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAdminFinances(), { wrapper })
    await waitFor(() => expect(result.current.summary).toEqual({ label: 'org-a' }))

    act(() => window.dispatchEvent(new Event('organization:changed')))
    await act(async () => { window.dispatchEvent(new Event('organization:changed')) })
    await waitFor(() => expect(result.current.organizationId).toBe('org-c'))
    expect(result.current.summary).toBeNull()
    await act(async () => pendingOrganization(response({ activeOrganization: { id: 'org-b' } })))
    expect(result.current.organizationId).toBe('org-c')
    expect(result.current.summary).toBeNull()
    await act(async () => pendingSummary(response({ label: 'org-c' })))
    expect(result.current.summary).toEqual({ label: 'org-c' })
  })

  it('hides the previous period while the next summary is pending', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/organizations') return Promise.resolve(response({ activeOrganization: { id: 'org-a' } }))
      if (url.includes('startDate=2026-01-01')) return new Promise(() => {})
      return Promise.resolve(response({ label: 'old-period' }))
    }))
    const { result } = renderHook(() => useAdminFinances(), { wrapper })
    await waitFor(() => expect(result.current.summary).toEqual({ label: 'old-period' }))

    act(() => result.current.setFilters({ startDate: '2026-01-01' }))

    expect(result.current.summary).toBeNull()
    expect(result.current.isLoading).toBe(true)
  })

  it('clears the old organization immediately and retries organization resolution after a failure', async () => {
    let nextOrganization: Promise<Response> | null = null
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/organizations') {
        return nextOrganization ?? Promise.resolve(response({ activeOrganization: { id: 'org-a' } }))
      }
      return Promise.resolve(response({ label: url.includes('organizationId=org-b') ? 'org-b' : 'org-a' }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAdminFinances(), { wrapper })
    await waitFor(() => expect(result.current.summary).toEqual({ label: 'org-a' }))
    let rejectOrganization!: (error: Error) => void
    nextOrganization = new Promise((_, reject) => { rejectOrganization = reject })

    act(() => window.dispatchEvent(new Event('organization:changed')))

    expect(result.current.organizationId).toBeNull()
    expect(result.current.summary).toBeNull()
    expect(result.current.isLoading).toBe(true)
    await act(async () => rejectOrganization(new Error('Organization unavailable')))
    expect(result.current.organizationId).toBeNull()
    expect(result.current.summary).toBeNull()
    expect(result.current.error?.message).toBe('Organization unavailable')

    nextOrganization = Promise.resolve(response({ activeOrganization: { id: 'org-b' } }))
    await act(async () => { await result.current.refresh() })
    await waitFor(() => expect(result.current.summary).toEqual({ label: 'org-b' }))
    expect(result.current.organizationId).toBe('org-b')
    expect(result.current.error).toBeNull()
  })
})

describe('admin finance summary refresh policy', () => {
  it('avoids automatic revalidations while an administrator is working', () => {
    expect(adminFinanceSummarySWRConfig).toMatchObject({
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      refreshInterval: 0,
      dedupingInterval: 60_000,
    })
  })
})
