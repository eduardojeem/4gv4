'use client'

import { useCallback, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import useSWR from 'swr'

import { useBranch } from '@/contexts/branch-context'
import type { FinanceSummaryReport } from '@/lib/finance/server'
import type { FinanceFilters } from '@/lib/finance/types'

export type AdminFinanceFilters = FinanceFilters

export function getAdminFinancesKey(filters: AdminFinanceFilters) {
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
  })
  if (filters.branchId) params.set('branchId', filters.branchId)
  return `/api/admin/finances/summary?${params.toString()}`
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
  const { selectedBranchId } = useBranch()
  const [dateFilters, setDateFilters] = useState(buildInitialDateRange)
  const filters = useMemo<AdminFinanceFilters>(() => ({
    ...dateFilters,
    branchId: selectedBranchId,
  }), [dateFilters, selectedBranchId])
  const cacheKey = useMemo(() => getAdminFinancesKey(filters), [filters])
  const { data, error, isLoading, isValidating, mutate } = useSWR<FinanceSummaryReport>(
    cacheKey,
    fetchFinanceSummary,
    { revalidateOnFocus: false },
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
    summary: data ?? null,
    filters,
    setFilters,
    setDateRange,
    isLoading,
    isRefreshing: isValidating && !isLoading,
    error: error instanceof Error ? error : error ? new Error('No se pudo cargar el resumen financiero.') : null,
    refresh: () => mutate(),
    mutateSummary: mutate,
  }
}
