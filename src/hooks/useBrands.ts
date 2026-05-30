'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Database } from '@/lib/supabase/types'

type BrandRow = Database['public']['Tables']['brands']['Row']
type BrandInsert = Database['public']['Tables']['brands']['Insert']
type BrandUpdate = Database['public']['Tables']['brands']['Update']

export type Brand = BrandRow & {
  stats?: {
    product_count: number
  }
}

interface BrandFilters {
  search?: string
  isActive?: boolean
  page?: number
  limit?: number
  orderBy?: keyof BrandRow
  orderDir?: 'asc' | 'desc'
}

export function validateBrandInput(input: Pick<BrandInsert, 'name' | 'description'>) {
  const errors: Record<string, string> = {}
  const name = (input.name || '').trim()
  
  if (!name) errors.name = 'El nombre es requerido'
  else if (name.length < 2) errors.name = 'El nombre debe tener al menos 2 caracteres'
  
  return { valid: Object.keys(errors).length === 0, errors }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Error desconocido')
}

export function useBrands() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Default filters
  const [filters, setFilters] = useState<BrandFilters>({ 
    isActive: undefined, 
    search: '',
    page: 1,
    limit: 12,
    orderBy: 'name',
    orderDir: 'asc'
  })

  // Keep track of the abort controller to cancel pending requests
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchBrands = useCallback(async (override?: Partial<BrandFilters>) => {
    // Merge current filters with override
    const active = { ...filters, ...override }
    
    // Update state if override was provided (to keep UI in sync)
    if (override) {
      setFilters(prev => ({ ...prev, ...override }))
    }

    setLoading(true)
    setError(null)

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const requestController = new AbortController()
    abortControllerRef.current = requestController

    try {
      const params = new URLSearchParams()
      
      if (active.isActive !== undefined) {
        params.set('is_active', String(active.isActive))
      }
      
      if (active.search) {
        params.set('search', active.search.trim())
      }

      const page = active.page || 1
      const limit = active.limit || 12
      params.set('page', String(page))
      params.set('limit', String(limit))

      const response = await fetch(`/api/brands?${params.toString()}`, {
        cache: 'no-store',
        signal: requestController.signal,
      })
      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudieron cargar las marcas')
      }

      const brandsWithStats = ((result.data || []) as BrandRow[]).map(brand => ({
        ...brand,
        stats: { product_count: 0 }
      }))

      setBrands(brandsWithStats)
      setTotalCount(Number(result.count || 0))
      
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      console.error('Error fetching brands:', err)
      setError(getErrorMessage(err))
    } finally {
      // Only set loading false if this is the latest request (not aborted)
      if (abortControllerRef.current === requestController) {
        setLoading(false)
      }
    }
  }, [filters])

  const createBrand = useCallback(async (payload: BrandInsert) => {
    const { valid, errors } = validateBrandInput({ name: payload.name, description: payload.description })
    
    if (!valid) {
      const errorMsg = Object.values(errors).join('. ')
      return { success: false as const, error: errorMsg || 'Validación fallida' }
    }
    
    try {
      const normalizedName = payload.name.trim()
      
      // Check for duplicates
      const response = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, name: normalizedName }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo crear la marca')
      
      await fetchBrands() // Refresh list
      return { success: true as const, data: result.data }
    } catch (err: unknown) {
      console.error('Error creating brand:', err)
      return { success: false as const, error: getErrorMessage(err) }
    }
  }, [fetchBrands])

  const updateBrand = useCallback(async (id: string, updates: BrandUpdate) => {
    try {
      if (updates.name) {
        const { valid, errors } = validateBrandInput({ name: updates.name })
        if (!valid) return { success: false as const, error: Object.values(errors).join('. ') }

        const normalizedName = updates.name.trim()
        
        updates.name = normalizedName
      }

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const response = await fetch('/api/brands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updateData, id }),
      })
      const result = await response.json()

      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo actualizar la marca')
      
      await fetchBrands() // Refresh list
      return { success: true as const, data: result.data }
    } catch (err: unknown) {
      console.error('Error updating brand:', err)
      return { success: false as const, error: getErrorMessage(err) }
    }
  }, [fetchBrands])

  const deleteBrand = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/brands?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const result = await response.json()

      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo eliminar la marca')
      
      await fetchBrands() // Refresh list
      return { success: true as const }
    } catch (err: unknown) {
      console.error('Error deleting brand:', err)
      return { success: false as const, error: getErrorMessage(err) }
    }
  }, [fetchBrands])

  // Initial fetch
  useEffect(() => {
    fetchBrands()
    return () => {
      abortControllerRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) 

  return {
    brands,
    totalCount,
    loading,
    error,
    filters,
    setFilters,
    fetchBrands,
    createBrand,
    updateBrand,
    deleteBrand
  }
}


