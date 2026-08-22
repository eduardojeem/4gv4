'use client'

import { useCallback, useEffect, useState } from 'react'
import { branchHeaders } from '@/lib/branches/client'
import type { CatalogItemKind, RepairCatalogItem } from './types'

type SearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error'

interface UseRepairCatalogSearchOptions {
  kind: CatalogItemKind
  branchId?: string | null
  open: boolean
  query: string
  debounceMs?: number
}

interface ProductSearchResponse {
  data?: { products?: RepairCatalogItem[] }
  error?: string
}

function isService(item: RepairCatalogItem) {
  return item.unit_measure?.toLowerCase() === 'servicio'
    || item.category?.name?.toLowerCase().includes('servicio') === true
}

export function useRepairCatalogSearch({
  kind,
  branchId,
  open,
  query,
  debounceMs = 250,
}: UseRepairCatalogSearchOptions) {
  const [items, setItems] = useState<RepairCatalogItem[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)

  const refresh = useCallback(() => setRefreshVersion((version) => version + 1), [])
  const retry = refresh

  useEffect(() => {
    if (!open) {
      setItems([])
      setStatus('idle')
      setError(null)
      return
    }

    const controller = new AbortController()
    setStatus('loading')
    setError(null)

    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ per_page: '50', query })
        if (kind === 'part') params.set('strict_branch_stock', 'true')

        const response = await fetch(`/api/products?${params.toString()}`, {
          cache: 'no-store',
          headers: branchHeaders(branchId),
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({})) as ProductSearchResponse
        if (!response.ok) throw new Error(payload.error || 'No se pudo consultar el catálogo.')

        const products = Array.isArray(payload.data?.products) ? payload.data.products : []
        const filtered = products.filter((item) => kind === 'service' ? isService(item) : !isService(item))
        setItems(filtered)
        setStatus(filtered.length > 0 ? 'success' : 'empty')
      } catch (caught) {
        if (controller.signal.aborted) return
        setError(caught instanceof Error ? caught.message : 'No se pudo consultar el catálogo.')
        setStatus('error')
      }
    }, debounceMs)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [branchId, debounceMs, kind, open, query, refreshVersion])

  return { items, status, error, retry, refresh }
}
