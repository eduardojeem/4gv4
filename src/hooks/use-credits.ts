import { useState, useEffect, useRef, useMemo, useTransition, useCallback } from 'react'
import type { SaleItemLike, SaleLike } from '@/lib/credits/display'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useAuth } from '@/hooks/use-auth'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import { useOptionalBranch } from '@/contexts/branch-context'
import { runCollectionAttempt, retryCollectionAttempt, pendingCollectionAttempt, CollectionAttemptError } from '@/lib/credits/collection-attempt'
import type { CollectionResult } from '@/lib/credits/collection-contract'
import type { CreditPortfolioSummary } from '@/lib/credits/portfolio'
import { config } from '@/lib/config'
import { daysUntilCreditDue, creditCalendarDate } from '@/lib/credits/calendar'

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
    | { success: true; appliedAmount: number; installmentId: string; collection: CollectionResult }
    | { success: false; error: string; uncertain?: boolean }

type InstallmentFilters = {
    status: string
    fromDate: string
    toDate: string
    creditId: string
    minAmount: number | string
    customerName: string
}

/** Retorna true si la cuota está vencida aunque su status sea 'pending' */
export const isInstallmentLate = (i: InstallmentRow, timeZone = 'America/Asuncion'): boolean =>
  i.status === 'late' || (i.status === 'pending' && (daysUntilCreditDue(i.due_date, timeZone) ?? 0) < 0)

const fetchTenantCreditsData = async () => {
  const response = await fetch('/api/credits', { cache: 'no-store' })
  const result = await response.json()

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'No se pudieron cargar los creditos.')
  }

  const data = result.data || {}
  if (!data.globalSummary || data.pagination?.complete !== true) throw new Error('La respuesta de créditos está incompleta. Actualizá antes de consultar saldos.')
  return {
    dbCredits: data.credits,
    dbInstallments: data.installments,
    dbPayments: data.payments,
    dbSummary: data.summary,
    dbInstallmentsProgress: data.installmentsProgress,
    dbCustomers: data.customers,
    dbSales: data.sales,
    dbSaleItems: data.saleItems,
    globalSummary: data.globalSummary as CreditPortfolioSummary,
    timeZone: data.timeZone || 'America/Asuncion',
  }
}

export function useCredits(enabled = true) {
    const { user } = useAuth()
    const organizationId = useOptionalActiveOrganization()?.organization?.id
    const branchId = useOptionalBranch()?.selectedBranchId ?? undefined
    const [globalSummary, setGlobalSummary] = useState<CreditPortfolioSummary | null>(null)
    const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | undefined>()
    const currentOrganizationRef = useRef(organizationId)
    currentOrganizationRef.current = organizationId
    const [timeZone, setTimeZone] = useState('America/Asuncion')

    const supabase = useMemo(() => createClient(), [])
    const [isPending, startTransition] = useTransition()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const hasCurrentData = enabled && !!user?.id && !error && loadedOrganizationId === organizationId
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

    /**
     * Numero de la carga en curso. Hay refresco por realtime, por accion del
     * usuario y por cambio de filtros, asi que puede haber varias en vuelo: sin
     * este contador, una respuesta lenta anterior pisa a la mas reciente y la
     * pantalla termina mostrando el credito de otro cliente.
     */
    const loadSeqRef = useRef(0)

    const loadData = useCallback(async () => {
        const requestId = ++loadSeqRef.current
        if (!enabled) {
            setCredits([])
            setGlobalSummary(null)
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
            const { dbCredits, dbInstallments, dbPayments, dbSummary, dbInstallmentsProgress, dbCustomers, dbSales, dbSaleItems, globalSummary: loadedSummary, timeZone: loadedTimeZone } = await fetchTenantCreditsData()

            // Llego una carga mas nueva mientras esta viajaba: se descarta.
            if (requestId !== loadSeqRef.current) return
            if (currentOrganizationRef.current !== organizationId) return
            setLoadedOrganizationId(organizationId)
            setGlobalSummary(loadedSummary)
            setTimeZone(loadedTimeZone)

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
            if (requestId !== loadSeqRef.current) return
            if (currentOrganizationRef.current !== organizationId) return
            const message = err instanceof Error ? err.message : 'Error al cargar los créditos.'
            console.error('[useCredits] loadData error:', err)
            setError(message)
        } finally {
            // Solo la carga vigente apaga el indicador: si lo hiciera una vieja,
            // la pantalla diria "listo" con una consulta todavia en curso.
            if (requestId === loadSeqRef.current) setLoading(false)
        }
    }, [enabled, organizationId])

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
        installmentId: string, method: string, amount: number, notes?: string,
        options?: { creditId?: string; reference?: string; recover?: boolean },
    ): Promise<MarkInstallmentPaidResult> => {
        const current = installments.find(i => i.id === installmentId)
        const credit = credits.find(c => c.id === current?.credit_id)
        if (!hasCurrentData || !current || !credit || !organizationId || !user?.id) return { success: false, error: 'Esperá a que se valide la organización y el crédito.' }
        if (!config.supabase.isConfigured) return { success: false, error: 'El cobro requiere conexión con la base de datos.' }
        const scope = organizationId + ':' + user.id + ':' + credit.customer_id
        try {
            const result = options?.recover
                ? await retryCollectionAttempt(scope)
                : await runCollectionAttempt(scope, '/api/credits', {
                    installmentId, method, amount, notes, branchId,
                    creditId: options?.creditId, reference: options?.reference,
                })
            // The committed receipt is authority even if refreshing the screen fails.
            void loadData()
            return { success: true, appliedAmount: result.collection.appliedAmount, installmentId, collection: result.collection }
        } catch (cause) {
            return { success: false, error: cause instanceof Error ? cause.message : 'No se pudo confirmar el cobro.', uncertain: cause instanceof CollectionAttemptError && cause.uncertain }
        }
    }, [hasCurrentData, installments, credits, organizationId, user?.id, branchId, loadData])
    const hasPendingCreditPayment = useCallback((creditId: string) => {
        const credit = credits.find(c => c.id === creditId)
        if (!organizationId || !user?.id || !credit) return false
        try { return !!pendingCollectionAttempt(organizationId + ':' + user.id + ':' + credit.customer_id) } catch { return true }
    }, [credits, organizationId, user?.id])

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
            if (['cancelled', 'cancelado', 'canceled'].includes(creditById[i.credit_id]?.status) || (creditById[i.credit_id]?.status === 'completed' && i.status !== 'paid')) return false
            if (filterValues.status) {
                if (filterValues.status === 'late') {
                    if (!isInstallmentLate(i, timeZone)) return false
                } else {
                    if (i.status !== filterValues.status) return false
                }
            }
            if (filterValues.creditId && !String(i.credit_id).toLowerCase().includes(String(filterValues.creditId).toLowerCase())) return false
            if (filterValues.minAmount && Number(i.amount) < Number(filterValues.minAmount)) return false
            if (filterValues.fromDate && (creditCalendarDate(i.due_date, timeZone) ?? '') < filterValues.fromDate) return false
            if (filterValues.toDate) {
                if ((creditCalendarDate(i.due_date, timeZone) ?? '') > filterValues.toDate) return false
            }
            if (filterValues.customerName) {
                const name = creditById[i.credit_id]?.customer_name || ''
                if (!name.toLowerCase().includes(String(filterValues.customerName).toLowerCase())) return false
            }
            return true
        })
    }, [installments, filterValues, creditById, timeZone])

    return {
        loading: loading || !hasCurrentData,
        globalSummary: hasCurrentData ? globalSummary : null,
        timeZone,
        isPending,
        error,
        refreshData,
        credits: hasCurrentData ? credits : [],
        installments: hasCurrentData ? installments.filter(row => !['cancelled', 'completed'].includes(creditById[row.credit_id]?.status) || row.status === 'paid') : [],
        payments: hasCurrentData ? payments : [],
        summary: hasCurrentData ? summary : {},
        installmentsProgress: hasCurrentData ? installmentsProgress : {},
        filterValues,
        setFilterValues,
        markInstallmentPaid,
        hasPendingCreditPayment,
        creditById: hasCurrentData ? creditById : {},
        remainingByCredit: hasCurrentData ? remainingByCredit : {},
        paidByCredit: hasCurrentData ? paidByCredit : {},
        getNextPendingInstallment: hasCurrentData ? getNextPendingInstallment : () => undefined,
        filteredInstallments: hasCurrentData ? filteredInstallments : [],
        sales: hasCurrentData ? sales : [],
        saleItems: hasCurrentData ? saleItems : []
    }
}
