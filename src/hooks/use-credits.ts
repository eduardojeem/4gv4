import { useState, useEffect, useMemo, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'

export type CreditRow = {
    id: string
    customer_id: string
    principal: number
    interest_rate: number
    term_months: number
    start_date: string
    status: 'active' | 'completed' | 'defaulted' | 'cancelled'
    customer_name?: string
}

export type InstallmentRow = {
    id: string
    credit_id: string
    installment_number: number
    due_date: string
    amount: number
    status: 'pending' | 'paid' | 'late'
    paid_at?: string | null
    payment_method?: string | null
    amount_paid?: number | null
}

export type PaymentRow = {
    id: string
    credit_id: string
    installment_id?: string | null
    amount: number
    payment_method?: 'cash' | 'card' | 'transfer' | null
    created_at?: string
}

export type CreditSummaryRow = {
    credit_id: string
    total_principal: number
    total_installments: number
    total_pagado: number
    saldo_pendiente: number
    progreso: number
}

export type InstallmentProgressRow = {
    id: string
    progreso: number
    status_effective: 'pending' | 'paid' | 'late'
}

type InstallmentFilters = {
    status: string
    fromDate: string
    toDate: string
    creditId: string
    minAmount: number | string
    customerName: string
}

const fetchData = async (supabase: SupabaseClient) => {
    const creditsResult = await (supabase.from('credit_details').select('*') as unknown as Promise<{ data?: unknown }>)
    const installmentsResult = await (supabase.from('credit_installments').select('*') as unknown as Promise<{ data?: unknown }>)
    const paymentsResult = await (supabase.from('credit_payments').select('*') as unknown as Promise<{ data?: unknown }>)
    const summaryResult = await (supabase.from('credit_summary').select('*') as unknown as Promise<{ data?: unknown }>)
    const installmentsProgressResult = await (supabase.from('credit_installments_progress').select('*') as unknown as Promise<{ data?: unknown }>)
    return {
        dbCredits: creditsResult.data,
        dbInstallments: installmentsResult.data,
        dbPayments: paymentsResult.data,
        dbSummary: summaryResult.data,
        dbInstallmentsProgress: installmentsProgressResult.data
    }
}

export function useCredits() {
    const supabase = useMemo(() => createClient(), [])
    const [isPending, startTransition] = useTransition()
    const [loading, setLoading] = useState(false)
    const [credits, setCredits] = useState<CreditRow[]>([])
    const [installments, setInstallments] = useState<InstallmentRow[]>([])
    const [payments, setPayments] = useState<PaymentRow[]>([])
    const [summary, setSummary] = useState<Record<string, CreditSummaryRow>>({})
    const [installmentsProgress, setInstallmentsProgress] = useState<Record<string, InstallmentProgressRow>>({})

    // Keep these exposed if components need them, or wrap them in actions
    const [filterValues, setFilterValues] = useState<InstallmentFilters>({
        status: '',
        fromDate: '',
        toDate: '',
        creditId: '',
        minAmount: '',
        customerName: ''
    })

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const { dbCredits, dbInstallments, dbPayments, dbSummary, dbInstallmentsProgress } = await fetchData(supabase as SupabaseClient)

            // Normalization Logic (Copied from original page.tsx to maintain logic parity)
            const creditsRaw = (dbCredits || []) as unknown as unknown[]
            const normalizedCredits = (creditsRaw || []).map((c) => {
                const o = c as Record<string, unknown>
                const nameVal = o['customer_name']
                const statusVal = String(o['status'] || 'active')
                const status: CreditRow['status'] =
                    statusVal === 'active' || statusVal === 'completed' || statusVal === 'defaulted' || statusVal === 'cancelled'
                        ? (statusVal as CreditRow['status'])
                        : 'active'
                return {
                    id: String(o['id'] || ''),
                    customer_id: String(o['customer_id'] || ''),
                    principal: Number(o['principal'] || 0),
                    interest_rate: Number(o['interest_rate'] || 0),
                    term_months: Number(o['term_months'] || 0),
                    start_date: String(o['start_date'] || new Date().toISOString()),
                    status,
                    customer_name: typeof nameVal === 'string' ? nameVal : undefined
                } as CreditRow
            })
            setCredits(normalizedCredits)

            setInstallments((dbInstallments || []) as InstallmentRow[])
            setPayments((dbPayments || []) as PaymentRow[])

            const s = ((dbSummary || []) as CreditSummaryRow[]).reduce((acc, row) => {
                acc[row.credit_id] = {
                    credit_id: String(row.credit_id),
                    total_principal: Number(row.total_principal || 0),
                    total_installments: Number(row.total_installments || 0),
                    total_pagado: Number(row.total_pagado || 0),
                    saldo_pendiente: Number(row.saldo_pendiente || 0),
                    progreso: Number(row.progreso || 0)
                }
                return acc
            }, {} as Record<string, CreditSummaryRow>)
            setSummary(s)

            const ip = ((dbInstallmentsProgress || []) as InstallmentProgressRow[]).reduce((acc, row) => {
                acc[row.id] = {
                    id: String(row.id),
                    progreso: Number(row.progreso || 0),
                    status_effective: (row.status_effective === 'paid' || row.status_effective === 'late' || row.status_effective === 'pending') ? row.status_effective : 'pending'
                }
                return acc
            }, {} as Record<string, InstallmentProgressRow>)
            setInstallmentsProgress(ip)

        } finally {
            setLoading(false)
        }
    }, [supabase])

    const refreshData = useCallback(() => {
        startTransition(() => {
            loadData()
        })
    }, [loadData])

    useEffect(() => {
        startTransition(() => { loadData() })

        // Realtime subscription
        if (!config.supabase.isConfigured) return
        const channel = supabase
            .channel('credits_realtime_hook')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_credits' }, () => { refreshData() })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_installments' }, () => { refreshData() })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_payments' }, () => { refreshData() })
        channel.subscribe()

        return () => { channel.unsubscribe() }
    }, [supabase, loadData, refreshData])


    const markInstallmentPaid = useCallback((installmentId: string, method: string, amount: number, notes?: string) => {
        startTransition(async () => {
            const current = installments.find(i => i.id === installmentId)
            if (!current) return

            const now = new Date().toISOString()
            const baseAmount = typeof current.amount === 'number' ? current.amount : Number(current.amount || 0)

            // Validation Logic
            const selectedAmount = typeof amount === 'number' && !Number.isNaN(amount) ? Math.min(Math.max(amount, 0), baseAmount) : baseAmount
            const accumulated = Math.min(baseAmount, (typeof current.amount_paid === 'number' ? current.amount_paid : 0) + selectedAmount)
            const isFullyPaid = accumulated >= baseAmount
            const nextStatus: InstallmentRow['status'] = isFullyPaid ? 'paid' : (current.status === 'late' ? 'late' : 'pending')

            if (!config.supabase.isConfigured) {
                // Optimistic / Mock update
                setInstallments(prev =>
                    prev.map(i => (i.id === installmentId ? { ...i, status: nextStatus, paid_at: isFullyPaid ? now : i.paid_at, payment_method: method, amount_paid: accumulated } : i))
                )
                setPayments(prev => ([...prev, {
                    id: `p-${Date.now()}`,
                    credit_id: current.credit_id,
                    installment_id: installmentId,
                    amount: selectedAmount,
                    payment_method: method as PaymentRow['payment_method'],
                    created_at: now
                }]))
                return
            }

            // Real update
            await (supabase.from('credit_payments')
                .insert({ 
                    credit_id: current.credit_id, 
                    installment_id: installmentId, 
                    amount: selectedAmount, 
                    payment_method: method,
                    notes: notes 
                }) as unknown as Promise<unknown>)

            await loadData()
        })
    }, [installments, supabase, loadData])


    // Derived Data Helpers
    const creditById = useMemo(() => {
        const map: Record<string, CreditRow> = {}
        for (const c of credits) { map[c.id] = c }
        return map
    }, [credits])

    const remainingByCredit = useMemo(() => {
        const map: Record<string, number> = {}
        if (Object.keys(summary).length > 0) {
            for (const key of Object.keys(summary)) { map[key] = Number(summary[key].saldo_pendiente || 0) }
            return map
        }
        // Fallback calculation
        for (const i of installments) {
            if (i.status === 'pending' || i.status === 'late') {
                map[i.credit_id] = (map[i.credit_id] || 0) + (Number(i.amount) || 0)
            }
        }
        return map
    }, [installments, summary])

    const paidByCredit = useMemo(() => {
        const map: Record<string, number> = {}
        if (Object.keys(summary).length > 0) {
            for (const key of Object.keys(summary)) { map[key] = Number(summary[key].total_pagado || 0) }
            return map
        }
        // Fallback calculation
        for (const p of payments) {
            map[p.credit_id] = (map[p.credit_id] || 0) + (Number(p.amount) || 0)
        }
        return map
    }, [payments, summary])

    const getNextPendingInstallment = useCallback((creditId: string) => {
        return installments
            .filter(i => i.credit_id === creditId && i.status === 'pending')
            .sort((a, b) => a.installment_number - b.installment_number)[0]
    }, [installments])

    const filteredInstallments = useMemo(() => {
        const isLate = (i: InstallmentRow) => i.status === 'pending' && new Date(i.due_date) < new Date()
        return installments.filter(i => {
            if (filterValues.status) {
                if (filterValues.status === 'late') {
                    if (!(i.status === 'late' || isLate(i))) return false
                } else {
                    if (i.status !== filterValues.status) return false
                }
            }
            if (filterValues.creditId && !String(i.credit_id).toLowerCase().includes(String(filterValues.creditId).toLowerCase())) return false
            if (filterValues.minAmount && Number(i.amount) < Number(filterValues.minAmount)) return false
            if (filterValues.fromDate && new Date(i.due_date) < new Date(filterValues.fromDate)) return false
            if (filterValues.toDate && new Date(i.due_date) > new Date(filterValues.toDate)) return false
            if (filterValues.customerName) {
                const name = creditById[i.credit_id]?.customer_name || ''
                if (!name.toLowerCase().includes(String(filterValues.customerName).toLowerCase())) return false
            }
            return true
        })
    }, [installments, filterValues, creditById])

    return {
        loading,
        isPending,
        refreshData,
        credits,
        installments,
        payments,
        summary,
        installmentsProgress,
        filterValues,
        setFilterValues,
        markInstallmentPaid,
        creditById,
        remainingByCredit,
        paidByCredit,
        getNextPendingInstallment,
        filteredInstallments
    }
}
