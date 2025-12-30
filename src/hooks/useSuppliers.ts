'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  if (input.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact_email)) {
    errors.contact_email = 'El email no es válido'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function useSuppliers() {
  const supabase = createClient()
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<SupplierFilters>({ isActive: true, search: '' })

  const fetchSuppliers = useCallback(async (override?: SupplierFilters) => {
    const active = override ?? filters
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('suppliers')
        .select('*')
      
      if (active.isActive !== undefined) query = query.eq('is_active', active.isActive)
      if (active.search) {
        query = query.or(`name.ilike.%${active.search}%,contact_name.ilike.%${active.search}%,contact_email.ilike.%${active.search}%`)
      }
      
      query = query.order('name', { ascending: true })
      
      const { data, error } = await query
      if (error) throw error
      setSuppliers((data ?? []) as SupplierRow[])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [supabase, filters])

  const createSupplier = useCallback(async (payload: SupplierInsert) => {
    const { valid, errors } = validateSupplierInput(payload)
    if (!valid) return { success: false as const, error: 'Validación fallida', details: errors }
    
    try {
      const normalizedName = payload.name.trim()
      const { data: existing } = await supabase
        .from('suppliers')
        .select('id,name')
        .eq('name', normalizedName)
        .maybeSingle()
        
      if (existing) {
        return { success: false as const, error: 'Ya existe un proveedor con este nombre' }
      }

      const now = new Date().toISOString()
      const insert: SupplierInsert = {
        ...payload,
        name: normalizedName,
        is_active: payload.is_active ?? true,
        created_at: payload.created_at ?? now,
        updated_at: now,
      }
      
      const { data, error } = await supabase.from('suppliers').insert(insert).select('*').single()
      if (error) throw error
      await fetchSuppliers()
      return { success: true as const, data }
    } catch (err) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }, [supabase, fetchSuppliers])

  const updateSupplier = useCallback(async (id: string, updates: SupplierUpdate) => {
    if (updates.name) {
      const { valid, errors } = validateSupplierInput({ name: updates.name })
      if (!valid) return { success: false as const, error: 'Validación fallida', details: errors }
    }

    try {
      if (updates.name) {
        const normalizedName = updates.name.trim()
        const { data: existing } = await supabase
          .from('suppliers')
          .select('id,name')
          .eq('name', normalizedName)
          .maybeSingle()
          
        if (existing && existing.id !== id) {
          return { success: false as const, error: 'Ya existe un proveedor con este nombre' }
        }
      }

      const { data, error } = await supabase
        .from('suppliers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()
        
      if (error) throw error
      await fetchSuppliers()
      return { success: true as const, data }
    } catch (err) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }, [supabase, fetchSuppliers])

  const deleteSupplier = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
      await fetchSuppliers()
      return { success: true as const }
    } catch (err) {
      return { success: false as const, error: err instanceof Error ? err.message : 'Error desconocido' }
    }
  }, [supabase, fetchSuppliers])

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
