'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type CategoryRow = Database['public']['Tables']['categories']['Row']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']

export type Category = CategoryRow & {
  stats?: {
    product_count: number
    total_stock_value: number
    avg_margin_percentage: number
  }
}

interface CategoryFilters {
  search?: string
  isActive?: boolean
}

export function validateCategoryInput(input: Pick<CategoryInsert, 'name' | 'description'>) {
  const errors: Record<string, string> = {}
  const name = (input.name || '').trim()
  const description = (input.description || '').trim()
  
  if (!name) errors.name = 'El nombre es requerido'
  else if (name.length < 2) errors.name = 'El nombre debe tener al menos 2 caracteres'
  
  // Relaxed validation: Description is optional or very short
  if (description && description.length < 3) {
      errors.description = 'La descripción debe tener al menos 3 caracteres si se proporciona'
  }
  
  return { valid: Object.keys(errors).length === 0, errors }
}

export function useCategories() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Default: Show all categories (isActive: undefined)
  const [filters, setFilters] = useState<CategoryFilters>({ isActive: undefined, search: '' })

  const fetchCategories = useCallback(async (override?: CategoryFilters) => {
    const active = override ?? filters
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch Categories
      let query = supabase
        .from('categories')
        .select('id,name,description,parent_id,is_active,created_at,updated_at')
      
      if (active.isActive !== undefined) {
          query = query.eq('is_active', active.isActive)
      }
      
      if (active.search) {
          const searchTerm = active.search.trim()
          query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      }
      
      query = query.order('name', { ascending: true })
      
      // 2. Fetch Stats (in parallel)
      const [categoriesRes, statsRes] = await Promise.all([
        query,
        supabase.rpc('get_category_stats')
      ])

      if (categoriesRes.error) throw categoriesRes.error
      // Note: statsRes might fail if function doesn't exist or permission denied, handle gracefully
      const statsMap = new Map<string, any>()
      if (statsRes.data) {
        statsRes.data.forEach((s: any) => {
          statsMap.set(s.category_id, s)
        })
      }

      const mergedData = (categoriesRes.data ?? []).map((cat: any) => ({
        ...cat,
        stats: statsMap.get(cat.id) || {
          product_count: 0,
          total_stock_value: 0,
          avg_margin_percentage: 0
        }
      }))

      setCategories(mergedData as Category[])
    } catch (err) {
      console.error('Error fetching categories:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [supabase, filters])

  const createCategory = useCallback(async (payload: CategoryInsert) => {
    const { valid, errors } = validateCategoryInput({ name: payload.name, description: payload.description ?? '' })
    if (!valid) return { success: false as const, error: 'Validación fallida', details: errors }
    
    try {
      const normalizedName = payload.name.trim()
      // Check for duplicates (case-insensitive ideally, but exact match for now)
      const { data: existing } = await supabase
        .from('categories')
        .select('id,name')
        .ilike('name', normalizedName)
        .maybeSingle()
      
      if (existing) {
        return { success: false as const, error: 'Ya existe una categoría con este nombre' }
      }

      const now = new Date().toISOString()
      const insert: CategoryInsert = {
        id: payload.id,
        name: normalizedName,
        description: (payload.description || '').trim(),
        parent_id: payload.parent_id ?? null,
        is_active: payload.is_active ?? true,
        created_at: payload.created_at ?? now,
        updated_at: now,
      }
      
      const { data, error } = await supabase.from('categories').insert(insert).select('*').single()
      if (error) throw error
      
      // Refresh local state without refetching if possible, but refetching ensures consistency
      await fetchCategories()
      return { success: true as const, data }
    } catch (err) {
      console.error('Error creating category:', err)
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido al crear categoría' }
    }
  }, [supabase, fetchCategories])

  const updateCategory = useCallback(async (id: string, updates: CategoryUpdate) => {
    // Validate only if fields are present
    if (updates.name !== undefined || updates.description !== undefined) {
       const currentCategory = categories.find(c => c.id === id)
       const newName = updates.name !== undefined ? String(updates.name) : currentCategory?.name || ''
       const newDesc = updates.description !== undefined ? String(updates.description) : currentCategory?.description || ''
       
       const { valid, errors } = validateCategoryInput({ name: newName, description: newDesc })
       if (!valid) return { success: false as const, error: 'Validación fallida', details: errors }
    }

    try {
      if (updates.name) {
        const normalizedName = updates.name.toString().trim()
        const { data: existing } = await supabase
          .from('categories')
          .select('id,name')
          .ilike('name', normalizedName)
          .maybeSingle()
        
        if (existing && existing.id !== id) {
          return { success: false as const, error: 'Ya existe otra categoría con este nombre' }
        }
      }

      const { data, error } = await supabase
        .from('categories')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
      
      if (error) throw error
      await fetchCategories()
      return { success: true as const, data }
    } catch (err) {
      console.error('Error updating category:', err)
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido al actualizar' }
    }
  }, [supabase, fetchCategories, categories])

  const deleteCategory = useCallback(async (id: string) => {
    try {
      // Check for children first? Supabase FK constraints might handle this, but better UX to check
      const { count: childCount, error: childError } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', id)
      
      if (!childError && childCount && childCount > 0) {
          return { success: false as const, error: 'No se puede eliminar: Esta categoría tiene subcategorías.' }
      }

      // Check for associated products
      const { count: productCount, error: productError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', id)

      if (!productError && productCount && productCount > 0) {
        return { success: false as const, error: `No se puede eliminar: Esta categoría tiene ${productCount} productos asociados.` }
      }

      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      
      await fetchCategories()
      return { success: true as const }
    } catch (err) {
      console.error('Error deleting category:', err)
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido al eliminar' }
    }
  }, [supabase, fetchCategories])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const memo = useMemo(() => ({ categories, loading, error }), [categories, loading, error])

  return {
    ...memo,
    filters,
    setFilters,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  }
}
