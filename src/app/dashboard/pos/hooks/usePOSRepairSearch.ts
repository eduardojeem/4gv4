'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { branchHeaders } from '@/lib/branches/client'

export type RepairSearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

export type POSRepairSearchItem = {
  id: string
  ticket_number?: string | number | null
  customer_id?: string | null
  [key: string]: unknown
}

export type RepairSearchPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type POSRepairSearchResult = {
  repairs: POSRepairSearchItem[]
  pagination: RepairSearchPagination
  status: RepairSearchStatus
  error: string | null
  retry: () => void
  nextPage: () => void
  previousPage: () => void
}

type UsePOSRepairSearchInput = {
  open: boolean
  branchId: string | null
  search: string
  debounceMs?: number
}

const EMPTY_PAGINATION: RepairSearchPagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
}

export function usePOSRepairSearch({
  open,
  branchId,
  search,
  debounceMs = 250,
}: UsePOSRepairSearchInput): POSRepairSearchResult {
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim())
  const [page, setPage] = useState(1)
  const [refreshToken, setRefreshToken] = useState(0)
  const [repairs, setRepairs] = useState<POSRepairSearchItem[]>([])
  const [pagination, setPagination] = useState(EMPTY_PAGINATION)
  const [status, setStatus] = useState<RepairSearchStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), debounceMs)
    return () => window.clearTimeout(timeout)
  }, [debounceMs, search])

  useEffect(() => {
    setPage(1)
  }, [branchId, debouncedSearch])

  useEffect(() => {
    if (!open || !branchId) {
      setStatus('idle')
      setError(null)
      return
    }

    const controller = new AbortController()
    const load = async () => {
      setStatus('loading')
      setError(null)
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        chargeable: 'true',
      })
      if (debouncedSearch) params.set('search', debouncedSearch)

      try {
        const response = await fetch(`/api/repairs?${params.toString()}`, {
          cache: 'no-store',
          headers: branchHeaders(branchId),
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null) as {
          repairs?: POSRepairSearchItem[]
          pagination?: RepairSearchPagination
          error?: string
        } | null
        if (!response.ok || !Array.isArray(payload?.repairs)) {
          throw new Error(payload?.error || 'No se pudieron cargar las reparaciones')
        }
        if (controller.signal.aborted) return
        setRepairs(payload.repairs)
        setPagination(payload.pagination ?? { ...EMPTY_PAGINATION, page })
        setStatus(payload.repairs.length > 0 ? 'success' : 'empty')
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las reparaciones')
        setStatus('error')
      }
    }

    void load()
    return () => controller.abort()
  }, [branchId, debouncedSearch, open, page, refreshToken])

  const retry = useCallback(() => setRefreshToken((value) => value + 1), [])
  const nextPage = useCallback(() => {
    setPage((current) => Math.min(Math.max(1, pagination.totalPages), current + 1))
  }, [pagination.totalPages])
  const previousPage = useCallback(() => setPage((current) => Math.max(1, current - 1)), [])

  return useMemo(() => ({
    repairs,
    pagination,
    status,
    error,
    retry,
    nextPage,
    previousPage,
  }), [error, nextPage, pagination, previousPage, repairs, retry, status])
}
