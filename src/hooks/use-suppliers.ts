'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { UISupplier } from '@/lib/types/supplier-ui'
import { validateSupplier, formatValidationErrors } from '@/lib/validations/supplier'
import type { SupplierStats } from './suppliers-stats'

export type Supplier = UISupplier

export type { SupplierStats } from './suppliers-stats'

type SupplierApiRow = Partial<Supplier> & {
    contact_person?: string | null
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Error desconocido'
}

export function useSuppliers() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(20)
    const [total, setTotal] = useState(0)
    const [stats, setStats] = useState<SupplierStats>({
        total_suppliers: 0,
        active_suppliers: 0,
        inactive_suppliers: 0,
        pending_suppliers: 0,
        avg_rating: 0,
        total_orders: 0,
        total_amount: 0
    })
    const [statsLoading] = useState(false)

    // Fetch suppliers
    const fetchSuppliers = useCallback(async (params?: {
        search?: string
        status?: string
        businessType?: string
        sortBy?: string
        page?: number
        pageSize?: number
    }) => {
        try {
            setLoading(true)
            const currentPage = params?.page ?? page
            const currentPageSize = params?.pageSize ?? pageSize
            const searchParams = new URLSearchParams()
            searchParams.set('page', String(currentPage))
            searchParams.set('pageSize', String(currentPageSize))
            if (params?.search && params.search.trim()) searchParams.set('search', params.search.trim())
            if (params?.status && params.status !== 'all') searchParams.set('status', params.status)
            if (params?.businessType && params.businessType !== 'all') searchParams.set('business_type', params.businessType)

            const response = await fetch(`/api/suppliers?${searchParams.toString()}`, { cache: 'no-store' })
            const result = await response.json()

            if (!response.ok || !result.success) throw new Error(result.error || 'No se pudieron cargar los proveedores')

            const dbSuppliers = (result.data || []) as SupplierApiRow[]
            
            // Map DB supplier to UI Supplier with backward compatibility
            const list: Supplier[] = dbSuppliers.map((s) => ({
                id: s.id,
                name: s.name,
                contact_name: s.contact_name || s.contact_person || '',
                email: s.email || '',
                phone: s.phone || '',
                address: s.address || '',
                city: s.city || '',
                country: s.country || '',
                postal_code: s.postal_code || '',
                website: s.website || '',
                business_type: (s.business_type || 'distributor') as Supplier['business_type'],
                // Use status column if available, otherwise map from is_active
                status: s.status || 'inactive',
                rating: s.rating || 0,
                products_count: s.products_count || 0,
                total_orders: s.total_orders || 0,
                total_amount: s.total_amount || 0,
                notes: s.notes || '',
                created_at: s.created_at,
                updated_at: s.updated_at
            } as unknown as Supplier))

            setSuppliers(list)
            setTotal(result.count || 0)
            if (result.stats) setStats(result.stats)
        } catch (error: unknown) {
            const msg = getErrorMessage(error)
            console.error('Error fetching suppliers:', error)
            
            // Handle specific schema errors gracefully
            if (msg.includes("Could not find the table") || msg.includes("does not exist")) {
                console.warn('Potential schema mismatch:', msg)
                // Don't clear suppliers if it's just a column missing in a filter
                if (!msg.includes("column")) {
                    setSuppliers([])
                    setTotal(0)
                }
            }
            
            toast.error('Error al cargar proveedores: ' + msg)
        } finally {
            setLoading(false)
        }
    }, [page, pageSize])

    // Helper to map UI fields to DB fields
    const mapToDbPayload = (supplierData: Partial<Supplier>) => {
        const payload: Record<string, unknown> = {
            ...supplierData,
            updated_at: new Date().toISOString()
        }
        
        // Remove non-existent fields or fields managed by DB
        const fieldsToRemove = [
            'products_count', 'total_orders', 'total_amount'
        ]
        
        fieldsToRemove.forEach(field => delete payload[field])
        
        return payload
    }

    // Create supplier
    const createSupplier = async (supplierData: Partial<Supplier>) => {
        try {
            // Validate data before sending to database
            const validation = validateSupplier(supplierData)
            if (!validation.success) {
                if (!('errors' in validation)) {
                    throw new Error('Datos invalidos')
                }
                const errors = formatValidationErrors(validation.errors)
                const errorMessage = Object.values(errors)[0] || 'Datos inválidos'
                throw new Error(errorMessage)
            }

            const dbPayload = mapToDbPayload(validation.data)
            dbPayload.created_at = new Date().toISOString()

            const response = await fetch('/api/suppliers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbPayload)
            })
            const result = await response.json()

            if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo crear el proveedor')

            toast.success('Proveedor creado exitosamente')
            await fetchSuppliers()
            return result.data
        } catch (error: unknown) {
            console.error('Error creating supplier:', error)
            const msg = getErrorMessage(error)
            if (msg.includes('42501') || msg.includes('policy')) {
                toast.error('No tienes permisos para crear proveedores')
            } else {
                toast.error(msg.includes('Ya existe') ? msg : 'Error al crear proveedor: ' + msg)
            }
            throw error
        }
    }

    // Update supplier
    const updateSupplier = async (id: string, supplierData: Partial<Supplier>) => {
        try {
            const dbPayload = mapToDbPayload(supplierData)

            const response = await fetch('/api/suppliers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...dbPayload, id })
            })
            const result = await response.json()

            if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo actualizar el proveedor')

            toast.success('Proveedor actualizado exitosamente')
            await fetchSuppliers()
            return result.data
        } catch (error: unknown) {
            console.error('Error updating supplier:', error)
            const msg = getErrorMessage(error)
            if (msg.includes('42501') || msg.includes('policy')) {
                toast.error('No tienes permisos para actualizar este proveedor')
            } else {
                toast.error('Error al actualizar proveedor: ' + msg)
            }
            throw error
        }
    }

    // Delete supplier
    const deleteSupplier = async (id: string) => {
        try {
            const response = await fetch(`/api/suppliers?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
            const result = await response.json()
            if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo eliminar el proveedor')

            toast.success('Proveedor eliminado exitosamente')
            await fetchSuppliers()
        } catch (error: unknown) {
            console.error('Error deleting supplier:', error)
            toast.error('Error al eliminar proveedor')
            throw error
        }
    }

    // Bulk delete suppliers
    const bulkDeleteSuppliers = async (ids: string[]) => {
        try {
            const response = await fetch(`/api/suppliers?ids=${encodeURIComponent(ids.join(','))}`, { method: 'DELETE' })
            const result = await response.json()
            if (!response.ok || !result.success) throw new Error(result.error || 'No se pudieron eliminar los proveedores')

            toast.success(`${ids.length} proveedores eliminados exitosamente`)
            await fetchSuppliers()
        } catch (error: unknown) {
            console.error('Error bulk deleting suppliers:', error)
            toast.error('Error al eliminar proveedores')
            throw error
        }
    }

    // Bulk update supplier status
    const bulkUpdateStatus = async (ids: string[], status: string) => {
        try {
            await Promise.all(ids.map(async (id) => {
                const response = await fetch('/api/suppliers', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, status, updated_at: new Date().toISOString() })
                })
                const result = await response.json()
                if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo actualizar un proveedor')
            }))

            toast.success(`Estado actualizado para ${ids.length} proveedores`)
            await fetchSuppliers()
        } catch (error: unknown) {
            console.error('Error bulk updating status:', error)
            toast.error('Error al actualizar estado')
            throw error
        }
    }

    // Toggle supplier status
    const toggleSupplierStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
        await updateSupplier(id, { status: newStatus })
    }

    // Real-time subscription
    useEffect(() => {
        fetchSuppliers()

    }, [fetchSuppliers])

    return {
        suppliers,
        loading,
        statsLoading,
        pagination: { page, pageSize, total },
        setPage,
        setPageSize,
        stats,
        createSupplier,
        updateSupplier,
        deleteSupplier,
        bulkDeleteSuppliers,
        bulkUpdateStatus,
        toggleSupplierStatus,
        refresh: fetchSuppliers
    }
}


