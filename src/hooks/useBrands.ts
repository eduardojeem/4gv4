'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
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

export function useBrands() {
  const supabase = createClient()
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
      let query = supabase
        .from('brands')
        .select('*', { count: 'exact' })
      
      if (active.isActive !== undefined) {
        query = query.eq('is_active', active.isActive)
      }
      
      if (active.search) {
        const searchTerm = active.search.trim()
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      }
      
      // Sorting
      const orderBy = active.orderBy || 'name'
      const orderDir = active.orderDir || 'asc'
      query = query.order(orderBy, { ascending: orderDir === 'asc' })

      // Pagination
      const page = active.page || 1
      const limit = active.limit || 12
      const from = (page - 1) * limit
      const to = from + limit - 1
      
      query = query.range(from, to)
      
      // Execute query with abort signal
      const { data, error, count } = await query.abortSignal(requestController.signal)

      if (error) {
        if (error.code !== '20') { // Ignore abort error (code 20 usually, strictly check if needed)
           throw error
        }
        return // Aborted, do nothing
      }

      // Add dummy stats for now (as per original code)
      const brandsWithStats = (data || []).map(brand => ({
        ...brand,
        stats: { product_count: 0 }
      }))

      setBrands(brandsWithStats)
      if (count !== null) setTotalCount(count)
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return
      }
      console.error('Error fetching brands:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      // Only set loading false if this is the latest request (not aborted)
      if (abortControllerRef.current === requestController) {
        setLoading(false)
      }
    }
  }, [supabase, filters])

  const createBrand = useCallback(async (payload: BrandInsert) => {
    const { valid, errors } = validateBrandInput({ name: payload.name, description: payload.description })
    
    if (!valid) {
      const errorMsg = Object.values(errors).join('. ')
      return { success: false as const, error: errorMsg || 'Validación fallida' }
    }
    
    try {
      const normalizedName = payload.name.trim()
      
      // Check for duplicates
      const { data: existing, error: checkError } = await supabase
        .from('brands')
        .select('id')
        .ilike('name', normalizedName)
        .limit(1)
        .maybeSingle()
      
      if (checkError) {
          console.error('Error checking duplicate:', checkError)
          throw checkError
      }
      if (existing) {
        return { success: false as const, error: 'Ya existe una marca con este nombre' }
      }

      const { data, error } = await supabase
        .from('brands')
        .insert({ ...payload, name: normalizedName })
        .select()
        .single()
      
      if (error) {
          console.error('Supabase create error:', error)
          throw error
      }
      
      await fetchBrands() // Refresh list
      return { success: true as const, data }
    } catch (err: any) {
      console.error('Error creating brand:', err)
      const message = err?.message || 'Error desconocido'
      const code = err?.code ? ` (Code: ${err.code})` : ''
      return { success: false as const, error: `${message}${code}` }
    }
  }, [supabase, fetchBrands])

  const updateBrand = useCallback(async (id: string, updates: BrandUpdate) => {
    try {
      if (updates.name) {
        const { valid, errors } = validateBrandInput({ name: updates.name })
        if (!valid) return { success: false as const, error: Object.values(errors).join('. ') }

        const normalizedName = updates.name.trim()
        
        // Check duplicate name on update (excluding self)
        const { data: existing, error: checkError } = await supabase
          .from('brands')
          .select('id')
          .ilike('name', normalizedName)
          .neq('id', id)
          .limit(1)
          .maybeSingle()
        
        if (checkError) throw checkError
        if (existing) return { success: false as const, error: 'Ya existe otra marca con este nombre' }
        
        updates.name = normalizedName
      }

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('brands')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      
      await fetchBrands() // Refresh list
      return { success: true as const, data }
    } catch (err: any) {
      console.error('Error updating brand:', err)
      const message = err?.message || 'Error desconocido'
      const code = err?.code ? ` (Code: ${err.code})` : ''
      return { success: false as const, error: `${message}${code}` }
    }
  }, [supabase, fetchBrands])

  const deleteBrand = useCallback(async (id: string) => {
    try {
      // Check associated products first
      const { count: productCount, error: productError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', id)

      if (!productError && productCount && productCount > 0) {
        return { success: false as const, error: `No se puede eliminar: Esta marca tiene ${productCount} productos asociados.` }
      }

      const { error } = await supabase.from('brands').delete().eq('id', id)
      if (error) throw error
      
      await fetchBrands() // Refresh list
      return { success: true as const }
    } catch (err: any) {
      console.error('Error deleting brand:', err)
      const message = err?.message || 'Error desconocido'
      const code = err?.code ? ` (Code: ${err.code})` : ''
      return { success: false as const, error: `${message}${code}` }
    }
  }, [supabase, fetchBrands])

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


