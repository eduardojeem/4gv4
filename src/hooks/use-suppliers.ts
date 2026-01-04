'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { UISupplier } from '@/lib/types/supplier-ui'
import { computeSupplierStats } from './suppliers-stats'
import { validateSupplier, formatValidationErrors } from '@/lib/validations/supplier'
import type { SupplierStats } from './suppliers-stats'

export type Supplier = UISupplier

export type { SupplierStats } from './suppliers-stats'

// computeSupplierStats importado desde './suppliers-stats'

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
    const [statsLoading, setStatsLoading] = useState(false)

    const supabase = createClient()

    // Calculate stats from DB - optimized with RPC
    const fetchStats = useCallback(async () => {
        try {
            setStatsLoading(true)

            // Try to use RPC function first (more efficient)
            const { data: rpcData, error: rpcError } = await supabase
                .rpc('get_supplier_stats')

            if (!rpcError && rpcData) {
                // The function now returns JSON, so we use it directly
                setStats({
                    total_suppliers: rpcData.total_suppliers || 0,
                    active_suppliers: rpcData.active_suppliers || 0,
                    inactive_suppliers: rpcData.inactive_suppliers || 0,
                    pending_suppliers: rpcData.pending_suppliers || 0,
                    avg_rating: rpcData.avg_rating || 0,
                    total_orders: rpcData.total_orders || 0,
                    total_amount: rpcData.total_amount || 0
                })
                return
            }

            // Fallback to client-side calculation if RPC doesn't exist
            console.log('RPC function not found or failed, using fallback method')

            // Execute counts in parallel
            const [totalResult, activeResult, inactiveResult, pendingResult] = await Promise.all([
                supabase.from('suppliers').select('*', { count: 'exact', head: true }),
                supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
                supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
                supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('status', 'pending')
            ])

            let totalOrders = 0
            let totalAmount = 0
            let avgRating = 0

            // Try to fetch aggregation data safely - NOT EXISTING IN DB YET, using defaults
            // We can calculate avgRating if we had it, but for now 0.
            
            setStats({
                total_suppliers: totalResult.count || 0,
                active_suppliers: activeResult.count || 0,
                inactive_suppliers: inactiveResult.count || 0,
                pending_suppliers: pendingResult.count || 0,
                avg_rating: 0,
                total_orders: 0,
                total_amount: 0
            })

        } catch (error: unknown) {
            console.error('Error fetching supplier stats:', error)
        } finally {
            setStatsLoading(false)
        }
    }, [supabase])

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
            let query = supabase
                .from('suppliers')
                .select('*', { count: 'exact' })

            if (params?.search && params.search.trim()) {
                const q = params.search.trim()
                query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,contact_person.ilike.%${q}%`)
            }
            if (params?.status && params.status !== 'all') {
                // Try status column first, fallback to is_active for backward compatibility
                if (params.status === 'active') {
                    query = query.or('status.eq.active,is_active.eq.true')
                } else if (params.status === 'inactive') {
                    query = query.or('status.eq.inactive,is_active.eq.false')
                } else {
                    // For pending/suspended, only use status column
                    query = query.eq('status', params.status)
                }
            }
            if (params?.businessType && params.businessType !== 'all') {
                query = query.eq('business_type', params.businessType)
            }

            const sortKey = params?.sortBy ?? 'created-desc'
            if (sortKey === 'name-asc') query = query.order('name', { ascending: true })
            else if (sortKey === 'name-desc') query = query.order('name', { ascending: false })
            // rating not in DB
            // else if (sortKey === 'rating-desc') query = query.order('rating', { ascending: false })
            else query = query.order('created_at', { ascending: false })

            query = query.range(currentPage * currentPageSize, currentPage * currentPageSize + currentPageSize - 1)

            const { data, error, count } = await query

            if (error) throw error

            const dbSuppliers = data || []
            
            // Map DB supplier to UI Supplier with backward compatibility
            const list: Supplier[] = dbSuppliers.map((s: any) => ({
                id: s.id,
                name: s.name,
                contact_person: s.contact_person || '',
                email: s.email || '',
                phone: s.phone || '',
                address: s.address || '',
                city: s.city || '',
                country: s.country || '',
                postal_code: s.postal_code || '',
                website: s.website || '',
                business_type: (s.business_type || 'distributor') as any, 
                // Use status column if available, otherwise map from is_active
                status: s.status || (s.is_active ? 'active' : 'inactive') as 'active' | 'inactive' | 'pending' | 'suspended',
                rating: s.rating || 0,
                products_count: s.products_count || 0,
                total_orders: s.total_orders || 0,
                total_amount: s.total_amount || 0,
                notes: s.notes || '',
                created_at: s.created_at,
                updated_at: s.updated_at
            } as unknown as Supplier))

            setSuppliers(list)
            setTotal(count || 0)
            // Stats are now fetched separately to be accurate across all pages
            fetchStats()
        } catch (error: any) {
            const msg = error?.message || 'Error desconocido'
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
    }, [page, pageSize, supabase, fetchStats])

    // Helper to map UI fields to DB fields
    const mapToDbPayload = (supplierData: Partial<Supplier>) => {
        const payload: any = {
            ...supplierData,
            updated_at: new Date().toISOString()
        }
        
        // Map status to is_active
        if (supplierData.status) {
            payload.is_active = supplierData.status === 'active'
            delete payload.status
        }
        
        // Map contact_person to contact_name
        if (supplierData.contact_person) {
            payload.contact_name = supplierData.contact_person
            delete payload.contact_person
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
                const errors = formatValidationErrors(validation.errors)
                const errorMessage = Object.values(errors)[0] || 'Datos inválidos'
                throw new Error(errorMessage)
            }

            const dbPayload = mapToDbPayload(validation.data)
            dbPayload.created_at = new Date().toISOString()

            const { data, error } = await supabase
                .from('suppliers')
                .insert([dbPayload])
                .select()
                .single()

            if (error) {
                // Handle specific database errors
                if (error.code === '23505') {
                    if (error.message.includes('email')) {
                        throw new Error('Ya existe un proveedor con este email')
                    }
                    throw new Error('Ya existe un proveedor con estos datos')
                }
                throw new Error(error.message)
            }

            toast.success('Proveedor creado exitosamente')
            await fetchSuppliers()
            return data
        } catch (error: any) {
            console.error('Error creating supplier:', error)
            const msg = error?.message || 'Error desconocido'
            if (error.code === '42501' || msg.includes('policy')) {
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

            const { data, error } = await supabase
                .from('suppliers')
                .update(dbPayload)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            toast.success('Proveedor actualizado exitosamente')
            await fetchSuppliers()
            return data
        } catch (error: any) {
            console.error('Error updating supplier:', error)
            const msg = error?.message || 'Error desconocido'
            if (error.code === '42501' || msg.includes('policy')) {
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
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .eq('id', id)

            if (error) throw error

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
            const { error } = await supabase
                .from('suppliers')
                .delete()
                .in('id', ids)

            if (error) throw error

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
            const is_active = status === 'active'
            const { error } = await supabase
                .from('suppliers')
                .update({ is_active, updated_at: new Date().toISOString() })
                .in('id', ids)

            if (error) throw error

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

        const channel = supabase
            .channel('suppliers-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'suppliers'
                },
                () => {
                    fetchSuppliers()
                }
            )
            .subscribe()

        return () => {
            channel.unsubscribe()
        }
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
