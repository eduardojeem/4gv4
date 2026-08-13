'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import useSWR from 'swr'

import { useBranch } from '@/contexts/branch-context'
import type { FinanceSummaryReport } from '@/lib/finance/server'
import type { FinanceFilters } from '@/lib/finance/types'

export type AdminFinanceFilters = FinanceFilters

type ActiveOrganizationResponse = {
  activeOrganization?: { id?: string } | null
  error?: string
}

export const adminFinanceSummarySWRConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  refreshInterval: 0,
  dedupingInterval: 60_000,
  keepPreviousData: false,
} as const

export function getAdminFinancesKey(filters: AdminFinanceFilters, organizationId: string) {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    organizationId,
  })
  if (filters.branchId) params.set('branchId', filters.branchId)
  return `/api/admin/finances/summary?${params.toString()}`
}

async function fetchActiveOrganizationId(): Promise<string> {
  const response = await fetch('/api/organizations', { cache: 'no-store' })
  const payload = await response.json().catch(() => null) as ActiveOrganizationResponse | null
  const organizationId = payload?.activeOrganization?.id

  if (!response.ok || !organizationId) {
    throw new Error(payload?.error || 'No se pudo resolver la organización activa.')
  }

  return organizationId
}

function buildInitialDateRange(): Pick<AdminFinanceFilters, 'startDate' | 'endDate'> {
  const today = new Date()
  return {
    startDate: format(subDays(today, 29), 'yyyy-MM-dd'),
    endDate: format(today, 'yyyy-MM-dd'),
  }
}

async function fetchFinanceSummary(url: string): Promise<FinanceSummaryReport> {
  const response = await fetch(url, { cache: 'no-store' })
  const payload = await response.json().catch(() => null) as FinanceSummaryReport | { error?: string } | null

  if (!response.ok) {
    throw new Error((payload as { error?: string } | null)?.error || 'No se pudo cargar el resumen financiero.')
  }

  return payload as FinanceSummaryReport
}

export function useAdminFinances() {
  const { selectedBranchId, selectedBranch } = useBranch()
  const [dateFilters, setDateFilters] = useState(buildInitialDateRange)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [organizationLoading, setOrganizationLoading] = useState(true)
  const [organizationError, setOrganizationError] = useState<Error | null>(null)
  const organizationRequestRef = useRef(0)

  const loadActiveOrganization = useCallback(async () => {
    const requestId = organizationRequestRef.current + 1
    organizationRequestRef.current = requestId
    setOrganizationId(null)
    setOrganizationLoading(true)
    setOrganizationError(null)

    try {
      const nextOrganizationId = await fetchActiveOrganizationId()
      if (organizationRequestRef.current === requestId) {
        setOrganizationId(nextOrganizationId)
      }
    } catch (error) {
      if (organizationRequestRef.current === requestId) {
        setOrganizationError(error instanceof Error ? error : new Error('No se pudo resolver la organización activa.'))
      }
    } finally {
      if (organizationRequestRef.current === requestId) {
        setOrganizationLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadActiveOrganization()
    const handleOrganizationChange = () => void loadActiveOrganization()
    window.addEventListener('organization:changed', handleOrganizationChange)
    return () => window.removeEventListener('organization:changed', handleOrganizationChange)
  }, [loadActiveOrganization])

  const branchId = selectedBranch?.organization_id && organizationId && selectedBranch.organization_id !== organizationId
    ? null
    : selectedBranchId
  const filters = useMemo<AdminFinanceFilters>(() => ({
    ...dateFilters,
    branchId,
  }), [branchId, dateFilters])
  const cacheKey = useMemo(
    () => organizationId ? getAdminFinancesKey(filters, organizationId) : null,
    [filters, organizationId],
  )
  const { data, error, isLoading, isValidating, mutate } = useSWR<FinanceSummaryReport>(
    cacheKey,
    fetchFinanceSummary,
    adminFinanceSummarySWRConfig,
  )

  const setFilters = useCallback((next: Partial<Pick<AdminFinanceFilters, 'startDate' | 'endDate'>>) => {
    setDateFilters((current) => ({ ...current, ...next }))
  }, [])

  const setDateRange = useCallback((range: DateRange | undefined) => {
    if (!range?.from) return
    const startDate = format(range.from, 'yyyy-MM-dd')
    setDateFilters({
      startDate,
      endDate: format(range.to ?? range.from, 'yyyy-MM-dd'),
    })
  }, [])

  return {
    summary: organizationId ? data ?? null : null,
    filters,
    setFilters,
    setDateRange,
    isLoading: organizationLoading || isLoading,
    isRefreshing: isValidating && !isLoading,
    error: organizationError ?? (error instanceof Error ? error : error ? new Error('No se pudo cargar el resumen financiero.') : null),
    refresh: () => mutate(),
    mutateSummary: mutate,
    organizationId,
  }
}
