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
    customer_code?: string
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

export type MarkInstallmentPaidResult =
    | { success: true; appliedAmount: number; installmentId: string }
    | { success: false; error: string }

type InstallmentFilters = {
    status: string
    fromDate: string
    toDate: string
    creditId: string
    minAmount: number | string
    customerName: string
}

/** Retorna true si la cuota está vencida aunque su status sea 'pending' */
export const isInstallmentLate = (i: InstallmentRow): boolean =>
  i.status === 'late' || (i.status === 'pending' && new Date(i.due_date) < new Date())

const fetchData = async (supabase: SupabaseClient) => {
  const [
    creditsResult,
    installmentsResult,
    paymentsResult,
    summaryResult,
    installmentsProgressResult,
    customersResult
  ] = await Promise.all([
    supabase.from('credit_details').select('*') as unknown as Promise<{ data?: unknown }>,
    supabase
      .from('credit_installments')
      .select('*')
      .order('due_date', { ascending: true })
      .order('installment_number', { ascending: true }) as unknown as Promise<{ data?: unknown }>,
    supabase
      .from('credit_payments')
      .select('*')
      .order('created_at', { ascending: false }) as unknown as Promise<{ data?: unknown }>,
    supabase.from('credit_summary').select('*') as unknown as Promise<{ data?: unknown }>,
    supabase.from('credit_installments_progress').select('*') as unknown as Promise<{ data?: unknown }>,
    supabase.from('customers').select('id, customer_code') as unknown as Promise<{ data?: unknown }>
  ])
  return {
    dbCredits: creditsResult.data,
    dbInstallments: installmentsResult.data,
    dbPayments: paymentsResult.data,
    dbSummary: summaryResult.data,
    dbInstallmentsProgress: installmentsProgressResult.data,
    dbCustomers: customersResult.data
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
            const { dbCredits, dbInstallments, dbPayments, dbSummary, dbInstallmentsProgress, dbCustomers } = await fetchData(supabase as SupabaseClient)

            const customersMap = ((dbCustomers || []) as any[]).reduce((acc, c) => {
                acc[c.id] = c.customer_code
                return acc
            }, {} as Record<string, string>)

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
                    customer_name: typeof nameVal === 'string' ? nameVal : undefined,
                    customer_code: customersMap[String(o['customer_id'] || '')]
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
    const markInstallmentPaid = useCallback(async (
        installmentId: string,
        method: string,
        amount: number,
        notes?: string
    ): Promise<MarkInstallmentPaidResult> => {
        const current = installments.find(i => i.id === installmentId)
        if (!current) {
            return { success: false, error: 'Cuota no encontrada.' }
        }

        const now = new Date().toISOString()
        const baseAmount = Number(current.amount || 0)
        const currentPaidRaw = Number(current.amount_paid || 0)
        const currentPaid = Number.isFinite(currentPaidRaw)
            ? Math.max(0, Math.min(baseAmount, currentPaidRaw))
            : 0
        const outstanding = Math.max(baseAmount - currentPaid, 0)
        const requestedAmount = Number.isFinite(amount) ? Number(amount) : outstanding
        const selectedAmount = Math.max(0, Math.min(requestedAmount, outstanding))

        if (selectedAmount <= 0) {
            return { success: false, error: 'La cuota ya no tiene saldo pendiente.' }
        }

        const accumulated = Math.min(baseAmount, currentPaid + selectedAmount)
        const isFullyPaid = accumulated >= baseAmount
        const nextStatus: InstallmentRow['status'] = isFullyPaid
            ? 'paid'
            : (isInstallmentLate(current) ? 'late' : 'pending')

        if (!config.supabase.isConfigured) {
            // Actualizacion optimista (entorno sin Supabase)
            setInstallments(prev =>
                prev.map(i => (
                    i.id === installmentId
                        ? { ...i, status: nextStatus, paid_at: isFullyPaid ? now : i.paid_at, payment_method: method, amount_paid: accumulated }
                        : i
                ))
            )
            setPayments(prev => ([{
                id: `p-${Date.now()}`,
                credit_id: current.credit_id,
                installment_id: installmentId,
                amount: selectedAmount,
                payment_method: method as PaymentRow['payment_method'],
                created_at: now
            }, ...prev]))
            return { success: true, appliedAmount: selectedAmount, installmentId }
        }

        const { error } = await (supabase.from('credit_payments')
            .insert({
                credit_id: current.credit_id,
                installment_id: installmentId,
                amount: selectedAmount,
                payment_method: method,
                notes
            }) as unknown as Promise<{ error: unknown }>)

        if (error) {
            const message = error instanceof Error ? error.message : 'No se pudo registrar el pago.'
            console.error('Error al registrar el pago:', error)
            return { success: false, error: message }
        }

        await loadData()
        return { success: true, appliedAmount: selectedAmount, installmentId }
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
                const installmentAmount = Number(i.amount || 0)
                const paidAmount = Math.max(0, Number(i.amount_paid || 0))
                map[i.credit_id] = (map[i.credit_id] || 0) + Math.max(0, installmentAmount - paidAmount)
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
            .filter(i => i.credit_id === creditId && (i.status === 'pending' || i.status === 'late'))
            .sort((a, b) => a.installment_number - b.installment_number)[0]
    }, [installments])

    const filteredInstallments = useMemo(() => {
        return installments.filter(i => {
            if (filterValues.status) {
                if (filterValues.status === 'late') {
                    if (!isInstallmentLate(i)) return false
                } else {
                    if (i.status !== filterValues.status) return false
                }
            }
            if (filterValues.creditId && !String(i.credit_id).toLowerCase().includes(String(filterValues.creditId).toLowerCase())) return false
            if (filterValues.minAmount && Number(i.amount) < Number(filterValues.minAmount)) return false
            if (filterValues.fromDate && new Date(i.due_date) < new Date(filterValues.fromDate)) return false
            if (filterValues.toDate) {
                const toDate = new Date(filterValues.toDate)
                toDate.setHours(23, 59, 59, 999)
                if (new Date(i.due_date) > toDate) return false
            }
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


