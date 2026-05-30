'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
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
  products_count?: number
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

  if (description && description.length < 3) {
    errors.description = 'La descripcion debe tener al menos 3 caracteres si se proporciona'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

async function readJsonResponse(response: Response) {
  const result = await response.json()

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Error procesando la solicitud')
  }

  return result
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CategoryFilters>({ isActive: undefined, search: '' })

  const fetchCategories = useCallback(async (override?: CategoryFilters) => {
    const active = override ?? filters
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      if (active.isActive !== undefined) {
        params.set('is_active', String(active.isActive))
      }

      if (active.search) {
        params.set('search', active.search.trim())
      }

      const result = await readJsonResponse(await fetch(`/api/categories?${params.toString()}`))
      const mergedData = (result.data ?? []).map((cat: Category) => {
        const stats = {
          product_count: 0,
          total_stock_value: 0,
          avg_margin_percentage: 0,
        }

        return {
          ...cat,
          stats,
          products_count: 0,
        }
      })

      setCategories(mergedData as Category[])
    } catch (err) {
      console.error('Error fetching categories:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [filters])

  const createCategory = useCallback(async (payload: CategoryInsert) => {
    const { valid, errors } = validateCategoryInput({ name: payload.name, description: payload.description ?? '' })
    if (!valid) return { success: false as const, error: 'Validacion fallida', details: errors }

    try {
      const normalizedName = payload.name.trim()
      const existing = categories.find((category) => category.name.toLowerCase() === normalizedName.toLowerCase())

      if (existing) {
        return { success: false as const, error: 'Ya existe una categoria con este nombre' }
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

      const result = await readJsonResponse(await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insert),
      }))

      await fetchCategories()
      return { success: true as const, data: result.data }
    } catch (err) {
      console.error('Error creating category:', err)
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido al crear categoria' }
    }
  }, [fetchCategories, categories])

  const updateCategory = useCallback(async (id: string, updates: CategoryUpdate) => {
    if (updates.name !== undefined || updates.description !== undefined) {
      const currentCategory = categories.find((category) => category.id === id)
      const newName = updates.name !== undefined ? String(updates.name) : currentCategory?.name || ''
      const newDesc = updates.description !== undefined ? String(updates.description) : currentCategory?.description || ''
      const { valid, errors } = validateCategoryInput({ name: newName, description: newDesc })
      if (!valid) return { success: false as const, error: 'Validacion fallida', details: errors }
    }

    try {
      if (updates.name) {
        const normalizedName = updates.name.toString().trim()
        const existing = categories.find((category) => category.name.toLowerCase() === normalizedName.toLowerCase())

        if (existing && existing.id !== id) {
          return { success: false as const, error: 'Ya existe otra categoria con este nombre' }
        }
      }

      const result = await readJsonResponse(await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, id }),
      }))

      await fetchCategories()
      return { success: true as const, data: result.data }
    } catch (err) {
      console.error('Error updating category:', err)
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido al actualizar' }
    }
  }, [fetchCategories, categories])

  const deleteCategory = useCallback(async (id: string) => {
    try {
      const childCount = categories.filter((category) => category.parent_id === id).length

      if (childCount > 0) {
        return { success: false as const, error: 'No se puede eliminar: Esta categoria tiene subcategorias.' }
      }

      await readJsonResponse(await fetch(`/api/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' }))
      await fetchCategories()
      return { success: true as const }
    } catch (err) {
      console.error('Error deleting category:', err)
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido al eliminar' }
    }
  }, [fetchCategories, categories])

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
