'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { RepairStatus } from '@/types/repairs'

export interface CustomerRepair {
    id: string
    ticket_number?: string | null
    device_brand: string
    device_model: string
    problem_description: string
    status: string
    estimated_cost: number
    final_cost?: number | null
    paid_amount?: number | null
    payment_status?: string | null
    delivered_at?: string | null
    created_at: string
    sale_id?: string
}

export function useCustomerRepairs() {
    const [repairs, setRepairs] = useState<CustomerRepair[]>([])
    const [loading, setLoading] = useState(false)

    const supabase = createClient()

    // Los estados van en castellano, como el enum `repair_status` de la base.
    // Se tipan para que un filtro en inglés ('pending', 'in_progress') no
    // compile: la base lo rechaza y la ficha del cliente quedaba sin reparaciones.
    const fetchRepairs = useCallback(async (customerId: string, statusFilter?: RepairStatus[]) => {
        try {
            setLoading(true)
            let query = supabase
                .from('repairs')
                .select('id, ticket_number, device_brand, device_model, problem_description, status, estimated_cost, final_cost, paid_amount, payment_status, delivered_at, created_at')
                .eq('customer_id', customerId)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })

            if (statusFilter && statusFilter.length > 0) {
                query = query.in('status', statusFilter)
            }
            
            const { data, error } = await query

            if (error) throw error

            setRepairs(data || [])
            return data || []
        } catch (error: unknown) {
            const msg = error instanceof Error
                ? error.message
                : (typeof error === 'object' && error !== null && 'message' in error)
                    ? String((error as { message: unknown }).message)
                    : String(error)
            console.error('Error fetching customer repairs:', msg)
            toast.error('No se pudieron cargar las reparaciones del cliente.')
            return []
        } finally {
            setLoading(false)
        }
    }, [supabase])

    return {
        repairs,
        loading,
        fetchRepairs
    }
}
