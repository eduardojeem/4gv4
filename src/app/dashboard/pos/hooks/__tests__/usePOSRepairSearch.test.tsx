import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/mocks/server'
import { usePOSRepairSearch } from '../usePOSRepairSearch'

describe('usePOSRepairSearch', () => {
  it('debounces search and sends the active branch header', async () => {
    let requestedUrl = ''
    let requestedBranch: string | null = null
    server.use(http.get('/api/repairs', ({ request }) => {
      requestedUrl = request.url
      requestedBranch = request.headers.get('x-branch-id')
      return HttpResponse.json({
        repairs: [{ id: 'repair-1', ticket_number: 'R-123' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      })
    }))

    const { result } = renderHook(() => usePOSRepairSearch({
      open: true,
      branchId: 'branch-1',
      search: 'R-123',
      debounceMs: 0,
    }))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(requestedBranch).toBe('branch-1')
    expect(requestedUrl).toContain('search=R-123')
    expect(requestedUrl).toContain('chargeable=true')
  })

  it('distinguishes empty results and paginates', async () => {
    let page = '1'
    server.use(http.get('/api/repairs', ({ request }) => {
      page = new URL(request.url).searchParams.get('page') || '1'
      return HttpResponse.json({
        repairs: page === '1' ? [{ id: 'repair-1' }] : [],
        pagination: { page: Number(page), pageSize: 20, total: 1, totalPages: 2 },
      })
    }))

    const { result } = renderHook(() => usePOSRepairSearch({
      open: true,
      branchId: 'branch-1',
      search: '',
      debounceMs: 0,
    }))

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.nextPage())
    await waitFor(() => expect(result.current.status).toBe('empty'))
    expect(page).toBe('2')
    expect(result.current.repairs).toEqual([])
  })

  it('keeps an actionable error and retries without reopening', async () => {
    let shouldFail = true
    let requests = 0
    server.use(http.get('/api/repairs', () => {
      requests += 1
      if (shouldFail) return HttpResponse.json({ error: 'Sin conexión' }, { status: 503 })
      return HttpResponse.json({
        repairs: [{ id: 'repair-1' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      })
    }))

    const { result } = renderHook(() => usePOSRepairSearch({
      open: true,
      branchId: 'branch-1',
      search: '',
      debounceMs: 0,
    }))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('Sin conexión')
    shouldFail = false
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(requests).toBe(2)
  })
})
