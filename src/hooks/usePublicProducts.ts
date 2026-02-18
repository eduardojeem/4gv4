import { useMemo, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { PublicProduct } from '@/types/public'
import { createSupabaseClient } from '@/lib/supabase/client'

export interface ProductFiltersState {
  category_id: string
  brand: string
  min_price: number
  max_price: number
  in_stock: boolean
}

export interface UsePublicProductsOptions {
  searchQuery: string
  sortBy: string
  filters: ProductFiltersState
  page: number
  perPage?: number
}

export function usePublicProducts(options: UsePublicProductsOptions) {
  const { searchQuery, sortBy, filters, page, perPage = 12 } = options

  const key = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      sort: sortBy || 'name',
    })
    if (searchQuery) params.set('query', searchQuery)
    if (filters.category_id) params.set('category_id', filters.category_id)
    if (filters.brand) params.set('brand', filters.brand)
    if (filters.min_price > 0) params.set('min_price', String(filters.min_price))
    if (filters.max_price < 999999) params.set('max_price', String(filters.max_price))
    if (filters.in_stock) params.set('in_stock', 'true')
    return `/api/public/products?${params.toString()}`
  }, [searchQuery, sortBy, filters.category_id, filters.brand, filters.min_price, filters.max_price, filters.in_stock, page, perPage])

  const fetcher = async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      const err = new Error(errBody?.error || res.statusText) as Error & { status?: number }
      err.status = res.status
      throw err
    }
    const body = await res.json()
    return body.data as {
      products: PublicProduct[]
      total: number
      page: number
      per_page: number
      total_pages: number
    }
  }

  const { data, error, isLoading } = useSWR(key, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })

  // Realtime revalidation - properly in useEffect with cleanup
  useEffect(() => {
    let supabase: ReturnType<typeof createSupabaseClient> | null = null
    try {
      supabase = createSupabaseClient()
    } catch {
      return
    }
    const channel = supabase
      .channel('realtime:public_products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        await mutate(key)
      })
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [key])

  return {
    products: data?.products ?? [],
    total: data?.total ?? 0,
    totalPages: data?.total_pages ?? 1,
    page: data?.page ?? page,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch: () => mutate(key),
  }
}
