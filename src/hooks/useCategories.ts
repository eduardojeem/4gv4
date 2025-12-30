'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type CategoryRow = Database['public']['Tables']['categories']['Row']
type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type CategoryUpdate = Database['public']['Tables']['categories']['Update']

export type Category = CategoryRow

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
  if (!description) errors.description = 'La descripción es requerida'
  else if (description.length < 10) errors.description = 'La descripción debe tener al menos 10 caracteres'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function useCategories() {
  const supabase = createClient()
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CategoryFilters>({ isActive: true, search: '' })

  const fetchCategories = useCallback(async (override?: CategoryFilters) => {
    const active = override ?? filters
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('categories')
        .select('id,name,description,parent_id,is_active,created_at,updated_at')
      if (active.isActive !== undefined) query = query.eq('is_active', active.isActive)
      if (active.search) query = query.or(`name.ilike.%${active.search}%,description.ilike.%${active.search}%`)
      query = query.order('name', { ascending: true })
      const { data, error } = await query
      if (error) throw error
      setCategories((data ?? []) as CategoryRow[])
    } catch (err) {
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
      const { data: existing } = await supabase
        .from('categories')
        .select('id,name')
        .eq('name', normalizedName)
        .maybeSingle()
      if (existing as { id: string; name: string } | null) {
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
      await fetchCategories()
      return { success: true as const, data }
    } catch (err) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }, [supabase, fetchCategories])

  const updateCategory = useCallback(async (id: string, updates: CategoryUpdate) => {
    if (updates.name || updates.description) {
      const { valid, errors } = validateCategoryInput({ name: (updates.name ?? '').toString(), description: (updates.description ?? '').toString() })
      if (!valid) return { success: false as const, error: 'Validación fallida', details: errors }
    }
    try {
      if (updates.name) {
        const normalizedName = updates.name.toString().trim()
        const { data: existing } = await supabase
          .from('categories')
          .select('id,name')
          .eq('name', normalizedName)
          .maybeSingle()
        const existingRow = existing as { id: string; name: string } | null
        if (existingRow && existingRow.id !== id) {
          return { success: false as const, error: 'Ya existe una categoría con este nombre' }
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
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }, [supabase, fetchCategories])

  const deleteCategory = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      await fetchCategories()
      return { success: true as const }
    } catch (err) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido' }
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
