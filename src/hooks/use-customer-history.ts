'use client'

import useSWR from 'swr'
import type { CustomerHistoryItem, CustomerHistorySummary } from '@/lib/customers/customer-history'

export type { CustomerHistoryItem, CustomerHistorySummary, HistoryPaymentState } from '@/lib/customers/customer-history'

export interface CustomerHistoryResponse {
  items: CustomerHistoryItem[]
  summary: CustomerHistorySummary
  truncated: boolean
}

export const customerHistoryKey = (customerId: string) => `/api/customers/${customerId}/history`

async function fetchHistory(url: string): Promise<CustomerHistoryResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'No se pudo cargar el historial del cliente.')
  }
  return { items: payload.items ?? [], summary: payload.summary, truncated: Boolean(payload.truncated) }
}

/**
 * Ventas y reparaciones del cliente con su estado de pago, calculado en el
 * servidor con la misma regla que el cobro. Varias partes de la ficha lo usan
 * a la vez y comparten una sola petición.
 */
export function useCustomerHistory(customerId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    customerId ? customerHistoryKey(customerId) : null,
    fetchHistory,
    { revalidateOnFocus: false, dedupingInterval: 5000 },
  )
  return {
    items: data?.items ?? [],
    summary: data?.summary ?? null,
    truncated: data?.truncated ?? false,
    error: error ? (error as Error).message : null,
    isLoading,
    refresh: mutate,
  }
}
