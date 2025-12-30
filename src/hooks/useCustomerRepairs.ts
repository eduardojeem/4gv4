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
                .select('*')
                .eq('customer_id', customerId)
                .in('status', ['completed', 'entregado']) // Assuming these are the statuses ready for payment
                .is('sale_id', null) // Only unpaid repairs

            if (error) throw error

            setRepairs(data || [])
            return data || []
        } catch (error: unknown) {
            console.error('Error fetching customer repairs:', error)
            toast.error('Error al cargar reparaciones del cliente')
            return []
        } finally {
            setLoading(false)
        }
    }, [])

    return {
        repairs,
        loading,
        fetchPendingRepairs
    }
}
