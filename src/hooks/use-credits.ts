import { useState, useEffect, useRef, useMemo, useTransition, useCallback } from 'react'
import type { SaleItemLike, SaleLike } from '@/lib/credits/display'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { config } from '@/lib/config'
import { endOfLocalDay, startOfLocalDay } from '@/lib/date-only'

export type CreditRow = {
    id: string
    customer_id: string
    sale_id?: string | null
    organization_id?: string | null
    principal: number
    interest_rate: number
    term_months: number
    start_date: string
    status: 'active' | 'completed' | 'defaulted' | 'cancelled'
    customer_name?: string
    customer_code?: string
    credit_code?: string | null
    credit_type?: string | null
    origin_type?: string | null
    label?: string | null
    sale_code?: string | null
}

export type InstallmentRow = {
    id: string
    credit_id: string
    sale_id?: string | null
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
    notes?: string | null
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
  i.status === 'late' || (i.status === 'pending' && startOfLocalDay(i.due_date) < startOfLocalDay(new Date()))

const emptyTenantCreditsData = {
    dbCredits: [],
    dbInstallments: [],
    dbPayments: [],
    dbSummary: [],
    dbInstallmentsProgress: [],
    dbCustomers: [],
    dbSales: [],
    dbSaleItems: []
}

const fetchTenantCreditsData = async () => {
  const response = await fetch('/api/credits', { cache: 'no-store' })
  const result = await response.json()

  if (response.status === 402 && (result?.error === 'Module unavailable' || result?.message === 'This module is not enabled for the current plan.')) {
    return emptyTenantCreditsData
  }

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'No se pudieron cargar los creditos.')
  }

  const data = result.data || {}
  return {
    dbCredits: data.credits,
    dbInstallments: data.installments,
    dbPayments: data.payments,
    dbSummary: data.summary,
    dbInstallmentsProgress: data.installmentsProgress,
    dbCustomers: data.customers,
    dbSales: data.sales,
    dbSaleItems: data.saleItems
  }
}

export function useCredits(enabled = true) {
    const supabase = useMemo(() => createClient(), [])
    const [isPending, startTransition] = useTransition()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null)
    const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [credits, setCredits] = useState<CreditRow[]>([])
    const [installments, setInstallments] = useState<InstallmentRow[]>([])
    const [payments, setPayments] = useState<PaymentRow[]>([])
    const [summary, setSummary] = useState<Record<string, CreditSummaryRow>>({})
    const [installmentsProgress, setInstallmentsProgress] = useState<Record<string, InstallmentProgressRow>>({})
    const [sales, setSales] = useState<SaleLike[]>([])
    const [saleItems, setSaleItems] = useState<SaleItemLike[]>([])

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
        if (!enabled) {
            setCredits([])
            setInstallments([])
            setPayments([])
            setSummary({})
            setInstallmentsProgress({})
            setSales([])
            setSaleItems([])
            setError(null)
            setLoading(false)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const { dbCredits, dbInstallments, dbPayments, dbSummary, dbInstallmentsProgress, dbCustomers, dbSales, dbSaleItems } = await fetchTenantCreditsData()

            const customersMap = ((dbCustomers || []) as Array<{ id: string; customer_code?: string }>).reduce((acc, c) => {
                acc[c.id] = c.customer_code ?? ''
                return acc
            }, {} as Record<string, string>)

            // Normalization Logic
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
                    sale_id: o['sale_id'] ? String(o['sale_id']) : null,
                    organization_id: o['organization_id'] ? String(o['organization_id']) : null,
                    principal: Number(o['principal'] || 0),
                    interest_rate: Number(o['interest_rate'] || 0),
                    term_months: Number(o['term_months'] || 0),
                    start_date: String(o['start_date'] || new Date().toISOString()),
                    status,
                    customer_name: typeof nameVal === 'string' ? nameVal : undefined,
                    customer_code: typeof o['customer_code'] === 'string' && o['customer_code']
                        ? String(o['customer_code'])
                        : customersMap[String(o['customer_id'] || '')],
                    credit_code: typeof o['credit_code'] === 'string' ? String(o['credit_code']) : null,
                    credit_type: typeof o['credit_type'] === 'string' ? String(o['credit_type']) : null,
                    origin_type: typeof o['origin_type'] === 'string' ? String(o['origin_type']) : null,
                    label: typeof o['label'] === 'string' ? String(o['label']) : null,
                    sale_code: typeof o['sale_code'] === 'string' ? String(o['sale_code']) : null,
                } as CreditRow
            })
            setCredits(normalizedCredits)

            setInstallments((dbInstallments || []) as InstallmentRow[])
            setPayments((dbPayments || []) as PaymentRow[])
            setSales(dbSales || [])
            setSaleItems(dbSaleItems || [])

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

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al cargar los créditos.'
            console.error('[useCredits] loadData error:', err)
            setError(message)
        } finally {
            setLoading(false)
        }
    }, [enabled])

    const refreshData = useCallback(() => {
        startTransition(() => {
            loadData()
        })
    }, [loadData])

    const scheduleRefresh = useCallback(() => {
        if (realtimeRefreshTimeoutRef.current) {
            clearTimeout(realtimeRefreshTimeoutRef.current)
        }

        realtimeRefreshTimeoutRef.current = setTimeout(() => {
            realtimeRefreshTimeoutRef.current = null
            refreshData()
        }, 500)
    }, [refreshData])

    // Initial data load
    useEffect(() => {
        if (!enabled) return
        startTransition(() => { loadData() })
    }, [enabled, loadData])

    // Realtime subscription — separate effect with ref guard to avoid duplicate channels
    useEffect(() => {
        if (!enabled) return
        if (!config.supabase.isConfigured) return

        // Unsubscribe any existing channel before creating a new one
        if (channelRef.current) {
            channelRef.current.unsubscribe()
        }

        const channel = supabase
            .channel('credits_realtime_hook')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customer_credits' }, () => scheduleRefresh())
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_credits' }, () => scheduleRefresh())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'credit_installments' }, () => scheduleRefresh())
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'credit_installments' }, () => scheduleRefresh())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'credit_payments' }, () => scheduleRefresh())

        channel.subscribe()
        channelRef.current = channel

        return () => {
            if (realtimeRefreshTimeoutRef.current) {
                clearTimeout(realtimeRefreshTimeoutRef.current)
                realtimeRefreshTimeoutRef.current = null
            }
            channel.unsubscribe()
            channelRef.current = null
        }
    }, [enabled, supabase, scheduleRefresh])
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

        const response = await fetch('/api/credits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                installmentId,
                method,
                amount: selectedAmount,
                notes
            })
        })

        const payload = await response.json().catch(() => null)

        if (!response.ok || payload?.success === false) {
            const message = payload?.error || 'No se pudo registrar el pago.'
            console.error('Error al registrar el pago:', payload)
            return { success: false, error: message }
        }

        await loadData()
        return { success: true, appliedAmount: selectedAmount, installmentId }
    }, [installments, loadData])


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
            if (filterValues.fromDate && startOfLocalDay(i.due_date) < startOfLocalDay(filterValues.fromDate)) return false
            if (filterValues.toDate) {
                if (startOfLocalDay(i.due_date) > endOfLocalDay(filterValues.toDate)) return false
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
        error,
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
        filteredInstallments,
        sales,
        saleItems
    }
}
