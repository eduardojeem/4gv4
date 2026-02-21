'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<BrandFilters>({ isActive: undefined, search: '' })

  const fetchBrands = useCallback(async (override?: BrandFilters) => {
    const active = override ?? filters
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('brands')
        .select('*')
      
      if (active.isActive !== undefined) {
        query = query.eq('is_active', active.isActive)
      }
      
      if (active.search) {
        const searchTerm = active.search.trim()
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      }
      
      query = query.order('name', { ascending: true })
      
      const { data, error } = await query

      if (error) throw error

      // For now, we won't fetch stats to keep it simple, or we could add a separate count query
      // To get product count efficiently we might need an RPC or a separate query
      // Let's do a simple separate query for counts if needed, but for now 0 is fine
      const brandsWithStats = (data || []).map(brand => ({
        ...brand,
        stats: { product_count: 0 }
      }))

      setBrands(brandsWithStats)
    } catch (err) {
      console.error('Error fetching brands:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, filters])

  const createBrand = useCallback(async (payload: BrandInsert) => {
    const { valid, errors } = validateBrandInput({ name: payload.name, description: payload.description })
    if (!valid) return { success: false as const, error: 'Validación fallida', details: errors }
    
    try {
      const normalizedName = payload.name.trim()
      const { data: existing } = await supabase
        .from('brands')
        .select('id,name')
        .ilike('name', normalizedName)
        .maybeSingle()
      
      if (existing) {
        return { success: false as const, error: 'Ya existe una marca con este nombre' }
      }

      const { data, error } = await supabase
        .from('brands')
        .insert({ ...payload, name: normalizedName })
        .select('*')
        .single()
      
      if (error) throw error
      
      await fetchBrands()
      return { success: true as const, data }
    } catch (err) {
      console.error('Error creating brand:', err)
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido al crear marca' }
    }
  }, [supabase, fetchBrands])

  const updateBrand = useCallback(async (id: string, updates: BrandUpdate) => {
    try {
      if (updates.name) {
        const normalizedName = updates.name.trim()
        const { data: existing } = await supabase
          .from('brands')
          .select('id,name')
          .ilike('name', normalizedName)
          .maybeSingle()
        
        if (existing && existing.id !== id) {
          return { success: false as const, error: 'Ya existe otra marca con este nombre' }
        }
        updates.name = normalizedName
      }

      const { data, error } = await supabase
        .from('brands')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
      
      if (error) throw error
      await fetchBrands()
      return { success: true as const, data }
    } catch (err) {
      console.error('Error updating brand:', err)
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido al actualizar' }
    }
  }, [supabase, fetchBrands])

  const deleteBrand = useCallback(async (id: string) => {
    try {
      // Check for associated products
      const { count: productCount, error: productError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', id)

      if (!productError && productCount && productCount > 0) {
        return { success: false as const, error: `No se puede eliminar: Esta marca tiene ${productCount} productos asociados.` }
      }

      const { error } = await supabase.from('brands').delete().eq('id', id)
      if (error) throw error
      
      await fetchBrands()
      return { success: true as const }
    } catch (err) {
      console.error('Error deleting brand:', err)
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido al eliminar' }
    }
  }, [supabase, fetchBrands])

  useEffect(() => {
    fetchBrands()
  }, [fetchBrands])

  return {
    brands,
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
