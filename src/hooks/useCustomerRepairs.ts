'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface CustomerRepair {
    id: string
    device_brand: string
    device_model: string
    problem_description: string
    status: string
    estimated_cost: number
    final_cost?: number
    created_at: string
    sale_id?: string
}

export function useCustomerRepairs() {
    const [repairs, setRepairs] = useState<CustomerRepair[]>([])
    const [loading, setLoading] = useState(false)

    const supabase = createClient()

    const fetchPendingRepairs = useCallback(async (customerId: string) => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('repairs')
                .select('id, device_brand, device_model, problem_description, status, estimated_cost, final_cost, created_at')
                .eq('customer_id', customerId)
                .in('status', ['listo', 'entregado'])

            if (error) throw error

            setRepairs(data || [])
            return data || []
        } catch (error: unknown) {
            const msg = error && typeof error === 'object' && 'message' in (error as any)
                ? String((error as any).message)
                : JSON.stringify(error)
            console.error('Error fetching customer repairs:', msg)
            toast.error(msg || 'Error al cargar reparaciones del cliente')
            return []
        } finally {
            setLoading(false)
        }
    }, [supabase])

    return {
        repairs,
        loading,
        fetchPendingRepairs
    }
}
