'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Database } from '@/lib/supabase/types'

type SupplierRow = Database['public']['Tables']['suppliers']['Row']
type SupplierInsert = Database['public']['Tables']['suppliers']['Insert']
type SupplierUpdate = Database['public']['Tables']['suppliers']['Update']

export type Supplier = SupplierRow

interface SupplierFilters {
  search?: string
  isActive?: boolean
}

export function validateSupplierInput(input: Partial<SupplierInsert>) {
  const errors: Record<string, string> = {}
  const name = (input.name || '').trim()
  
  if (!name) errors.name = 'El nombre es requerido'
  else if (name.length < 2) errors.name = 'El nombre debe tener al menos 2 caracteres'
  
  // Basic email validation if provided
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = 'El email no es válido'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<SupplierFilters>({ isActive: true, search: '' })

  const fetchSuppliers = useCallback(async (override?: SupplierFilters) => {
    const active = override ?? filters
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      
      if (active.isActive !== undefined) params.set('is_active', String(active.isActive))
      if (active.search) params.set('search', active.search.trim())
      
      const response = await fetch(`/api/suppliers?${params.toString()}`, { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudieron cargar los proveedores')
      setSuppliers((result.data ?? []) as SupplierRow[])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [filters])

  const createSupplier = useCallback(async (payload: SupplierInsert) => {
    const { valid, errors } = validateSupplierInput(payload)
    if (!valid) return { success: false as const, error: 'Validación fallida', details: errors }
    
    try {
      const normalizedName = payload.name.trim()

      const now = new Date().toISOString()
      const insert: SupplierInsert = {
        ...payload,
        name: normalizedName,
        is_active: payload.is_active ?? true,
        created_at: payload.created_at ?? now,
        updated_at: now,
      }
      
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insert),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo crear el proveedor')
      await fetchSuppliers()
      return { success: true as const, data: result.data }
    } catch (err) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }, [fetchSuppliers])

  const updateSupplier = useCallback(async (id: string, updates: SupplierUpdate) => {
    if (updates.name) {
      const { valid, errors } = validateSupplierInput({ name: updates.name })
      if (!valid) return { success: false as const, error: 'Validación fallida', details: errors }
    }

    try {
      const response = await fetch('/api/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, id, updated_at: new Date().toISOString() }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo actualizar el proveedor')
      await fetchSuppliers()
      return { success: true as const, data: result.data }
    } catch (err) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }, [fetchSuppliers])

  const deleteSupplier = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/suppliers?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo eliminar el proveedor')
      await fetchSuppliers()
      return { success: true as const }
    } catch (err) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }, [fetchSuppliers])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const memo = useMemo(() => ({ suppliers, loading, error }), [suppliers, loading, error])

  return {
    ...memo,
    filters,
    setFilters,
    fetchSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  }
}
