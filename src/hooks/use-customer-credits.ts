import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { Customer } from './use-customer-state'

export interface CreditInfo {
  id: string
  customer_id: string
  principal: number
  interest_rate: number
  term_months: number
  start_date: string
  status: 'active' | 'completed' | 'defaulted' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface InstallmentInfo {
  id: string
  credit_id: string
  installment_number: number
  due_date: string
  amount: number
  status: 'pending' | 'paid' | 'late'
  paid_at?: string | null
  payment_method?: 'cash' | 'card' | 'transfer' | null
  amount_paid?: number | null
  created_at: string
}

export interface PaymentInfo {
  id: string
  credit_id: string
  installment_id?: string | null
  amount: number
  payment_method?: 'cash' | 'card' | 'transfer' | null
  created_at: string
  notes?: string
}

export interface DebtItem {
  id: string
  type: 'repair' | 'installment' | 'sale'
  title: string
  subtitle?: string
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  dueDate?: string
  isOverdue: boolean
  status: string
  operationalStatus?: string
  repairCategory?: 'in_progress' | 'ready_for_pickup' | 'delivered_unpaid'
  debtReason?: string
  creditId?: string
}

export interface CustomerCreditSummary {
  customer_id: string
  total_credits: number
  active_credits: number
  completed_credits: number
  defaulted_credits: number
  total_principal: number
  total_paid: number
  total_pending: number
  current_balance: number
  credit_limit: number
  available_credit: number
  credit_utilization: number // Porcentaje de crédito utilizado
  store_balance: number // Saldo a favor disponible (ya descontadas las reservas)
  store_reserved: number // Retenido por pedidos web pendientes
  overdue_debt: number // Deuda vencida
  debts: DebtItem[]
  payment_history: {
    on_time_payments: number
    late_payments: number
    missed_payments: number
    payment_score: number // 0-100
  }
  next_payment: {
    amount: number
    due_date: string
    days_until_due: number
    is_overdue: boolean
    title?: string
  } | null
  risk_assessment: {
    risk_level: 'low' | 'medium' | 'high' | 'critical'
    risk_score: number // 0-100
    factors: string[]
  }
}

export interface CustomerWithCredits extends Customer {
  credit_summary: CustomerCreditSummary
  credits: CreditInfo[]
  recent_payments: PaymentInfo[]
}

export function useCustomerCredits(customerId?: string, initialCustomer?: Customer | null) {
  const [loading, setLoading] = useState(false)
  const [credits, setCredits] = useState<CreditInfo[]>([])
  const [installments, setInstallments] = useState<InstallmentInfo[]>([])
  const [payments, setPayments] = useState<PaymentInfo[]>([])
  const [customerLimit, setCustomerLimit] = useState<number>(Number(initialCustomer?.credit_limit || 0))
  const [storeBalance, setStoreBalance] = useState<number>(Number((initialCustomer as any)?.store_credit || 0))
  const [storeReserved, setStoreReserved] = useState<number>(0)
  const [debts, setDebts] = useState<DebtItem[]>([])
  const [totalCollectDebt, setTotalCollectDebt] = useState<number>(0)
  const [overdueCollectDebt, setOverdueCollectDebt] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const supabase = useMemo(() => createClient(), [])

  // Sincronizar límite inicial si cambia en el prop del cliente
  useEffect(() => {
    if (initialCustomer?.credit_limit !== undefined) {
      setCustomerLimit(Number(initialCustomer.credit_limit || 0))
    }
    if ((initialCustomer as any)?.store_credit !== undefined) {
      setStoreBalance(Number((initialCustomer as any).store_credit || 0))
    }
  }, [initialCustomer?.credit_limit, (initialCustomer as any)?.store_credit])

  // Cargar datos de créditos y deudas reales
  useEffect(() => {
    if (!customerId) return

    let isMounted = true

    const loadCreditData = async () => {
      setLoading(true)
      setError(null)

      try {
        // 1. Cargar deudas unificadas reales y límite exacto desde el servidor
        try {
          const collectRes = await fetch(`/api/customers/${customerId}/collect-payment`)
          if (collectRes.ok) {
            const collectData = await collectRes.json()
            if (isMounted && !collectData.success) {
              setError(collectData.error || 'No se pudo cargar la deuda del cliente.')
            }
            if (isMounted && collectData.success) {
              setDebts(collectData.debts || [])
              setTotalCollectDebt(Number(collectData.totalDebt || 0))
              setOverdueCollectDebt(Number(collectData.overdueDebt || 0))
              setStoreBalance(Number(collectData.storeBalance || 0))
              setStoreReserved(Number(collectData.storeReservedBalance || 0))
              // Solo se pisa el limite que ya venia del cliente cuando el
              // servidor manda uno de verdad: un 0 por cliente no encontrado
              // borraba de la pantalla un limite correctamente cargado.
              if (collectData.creditLimit !== undefined && collectData.creditLimit !== null) {
                setCustomerLimit(Number(collectData.creditLimit) || 0)
              }
            }
          } else if (isMounted) {
            // Un 403 o un 500 tampoco puede pasar inadvertido: sin deuda
            // cargada el panel afirmaria que tiene todo el cupo libre.
            setError('No se pudo cargar la deuda del cliente.')
          }
        } catch (e) {
          // Antes solo se avisaba por consola y el hook seguia como si nada:
          // sin deudas cargadas el panel mostraba cupo completo disponible,
          // que es justo el numero que no hay que inventar.
          console.warn('Error fetching collect-payment:', e)
          if (isMounted) setError('No se pudo cargar la deuda del cliente.')
        }

        // 2. Cargar contratos de crédito formales e historial de pagos
        try {
          const response = await fetch('/api/credits/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerIds: [customerId] })
          })

          if (response.ok) {
            const { credits: creditsData, installments: installmentsData, payments: paymentsData } = await response.json()
            if (isMounted) {
              setCredits(creditsData || [])
              setInstallments(installmentsData || [])
              setPayments(paymentsData || [])
            }
          } else if (isMounted) {
            setError('No se pudieron cargar los créditos del cliente.')
          }
        } catch (e) {
          console.warn('Error fetching credits batch:', e)
          if (isMounted) setError('No se pudieron cargar los créditos del cliente.')
        }

      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error al cargar datos de créditos')
          console.error('Error loading credit data:', err)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadCreditData()

    return () => {
      isMounted = false
    }
  }, [customerId, supabase, refreshIndex])

  // Calcular resumen consolidado y real de créditos del cliente
  const creditSummary = useMemo((): CustomerCreditSummary | null => {
    if (!customerId) return null

    const activeCredits = credits.filter(c => c.status === 'active')
    const completedCredits = credits.filter(c => c.status === 'completed')
    const defaultedCredits = credits.filter(c => c.status === 'defaulted')

    const totalPrincipal = credits.reduce((sum, c) => sum + Number(c.principal || 0), 0)
    const totalPaidFromPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    
    // Deuda real total consolidada (calculada desde deudas activas o cuotas)
    // El saldo de una cuota es lo que falta pagar, no su importe completo: con
    // el importe entero una cuota pagada a medias inflaba la deuda y mostraba
    // menos credito disponible del que el servidor realmente autoriza.
    const pendingFromInstallments = installments
      .filter(i => i.status === 'pending' || i.status === 'late')
      .reduce((sum, i) => {
        const amount = Math.max(0, Number(i.amount || 0))
        const paid = Math.min(amount, Math.max(0, Number(i.amount_paid || 0)))
        return sum + (amount - paid)
      }, 0)
    const effectiveTotalPending = totalCollectDebt > 0
      ? totalCollectDebt
      : pendingFromInstallments

    // Total abonado
    const paidInstallments = installments.filter(i => i.status === 'paid')
    const totalPaidFromInstallments = paidInstallments.reduce((sum, i) => sum + Number(i.amount_paid || i.amount || 0), 0)
    const totalPaid = Math.max(totalPaidFromPayments, totalPaidFromInstallments)

    // Historial de pagos
    const latePayments = paidInstallments.filter(i => {
      if (!i.paid_at) return false
      const paidDate = new Date(i.paid_at)
      const dueDate = new Date(i.due_date)
      return paidDate > dueDate
    })
    const onTimePayments = paidInstallments.length - latePayments.length
    const missedPayments = installments.filter(i => {
      if (i.status !== 'pending' && i.status !== 'late') return false
      const dueDate = new Date(i.due_date)
      const now = new Date()
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      return daysPastDue > 30
    }).length

    const totalPaymentEvents = onTimePayments + latePayments.length + missedPayments
    const paymentScore = totalPaymentEvents > 0 
      ? Math.round(((onTimePayments * 100) + (latePayments.length * 50)) / (totalPaymentEvents * 100) * 100)
      : (overdueCollectDebt > 0 ? 65 : 100)

    // Próximo pago (buscado entre deudas con vencimiento o cuotas pendientes)
    let nextPayment = null
    const pendingWithDueDate = debts
      .filter(d => d.dueDate && d.pendingAmount > 0)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0]

    if (pendingWithDueDate) {
      const dueDate = new Date(pendingWithDueDate.dueDate!)
      const now = new Date()
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      nextPayment = {
        amount: pendingWithDueDate.pendingAmount,
        due_date: pendingWithDueDate.dueDate!,
        days_until_due: daysUntilDue,
        is_overdue: daysUntilDue < 0 || pendingWithDueDate.isOverdue,
        title: pendingWithDueDate.title
      }
    } else if (debts.length > 0 && debts.some(d => d.pendingAmount > 0)) {
      const firstDebt = debts.find(d => d.pendingAmount > 0)!
      nextPayment = {
        amount: firstDebt.pendingAmount,
        due_date: new Date().toISOString(),
        days_until_due: 0,
        is_overdue: firstDebt.isOverdue,
        title: firstDebt.title
      }
    }

    // Límite de crédito y utilización
    const realLimit = customerLimit
    const availableCredit = realLimit > 0 ? Math.max(0, realLimit - effectiveTotalPending) : 0
    const creditUtilization = realLimit > 0 ? Math.min(100, Math.round((effectiveTotalPending / realLimit) * 100)) : 0

    // Evaluación de riesgo
    let riskScore = 0
    const riskFactors: string[] = []

    if (overdueCollectDebt > 0) {
      riskScore += 45
      riskFactors.push('Registra deuda vencida en mora')
    }
    if (latePayments.length > 0) {
      riskScore += 20
      riskFactors.push('Historial de pagos con retraso')
    }
    if (creditUtilization > 85) {
      riskScore += 25
      riskFactors.push('Alta utilización de la línea de crédito')
    }
    if (defaultedCredits.length > 0) {
      riskScore += 50
      riskFactors.push('Créditos formalmente en mora')
    }

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (riskScore >= 75) riskLevel = 'critical'
    else if (riskScore >= 50) riskLevel = 'high'
    else if (riskScore >= 25) riskLevel = 'medium'

    if (riskFactors.length === 0) {
      riskFactors.push('Cliente al día sin factores de riesgo detectados')
    }

    return {
      customer_id: customerId,
      total_credits: credits.length,
      active_credits: activeCredits.length,
      completed_credits: completedCredits.length,
      defaulted_credits: defaultedCredits.length,
      total_principal: totalPrincipal,
      total_paid: totalPaid,
      total_pending: effectiveTotalPending,
      current_balance: effectiveTotalPending,
      credit_limit: realLimit,
      available_credit: availableCredit,
      credit_utilization: creditUtilization,
      store_balance: storeBalance,
      store_reserved: storeReserved,
      overdue_debt: overdueCollectDebt,
      debts: debts,
      payment_history: {
        on_time_payments: onTimePayments,
        late_payments: latePayments.length,
        missed_payments: missedPayments,
        payment_score: paymentScore
      },
      next_payment: nextPayment,
      risk_assessment: {
        risk_level: riskLevel,
        risk_score: Math.min(100, riskScore),
        factors: riskFactors
      }
    }
  }, [customerId, credits, installments, payments, customerLimit, storeBalance, storeReserved, debts, totalCollectDebt, overdueCollectDebt])

  return {
    loading,
    error,
    credits,
    installments,
    payments,
    creditSummary,
    refresh: () => setRefreshIndex(prev => prev + 1)
  }
}

// Hook para obtener resúmenes de crédito de múltiples clientes
export function useCustomersWithCredits(customers: Customer[]) {
  const [creditSummaries, setCreditSummaries] = useState<Record<string, CustomerCreditSummary>>({})
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (customers.length === 0) return

    // La lista de clientes cambia al filtrar o paginar, y cada cambio dispara
    // una consulta nueva. Sin esta bandera, una respuesta anterior mas lenta
    // sobrescribe los resumenes ya cargados y se ven saldos de otros clientes.
    let cancelled = false

    const loadCreditSummaries = async () => {
      setLoading(true)
      try {
        if (!config.supabase.isConfigured) {
             console.warn('Supabase not configured, returning empty credits')
             setCreditSummaries({})
             return
        }

        // Real Data from Supabase via API (bypassing RLS issues on client)
        const customerIds = customers.map(c => c.id)
        
        const response = await fetch('/api/credits/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerIds })
        })

        if (!response.ok) {
            throw new Error('Failed to fetch credits')
        }

        const { credits: creditsData, installments: installmentsData } = await response.json()
        
        const credits = (creditsData || []) as CreditInfo[]
        const installments = (installmentsData || []) as InstallmentInfo[]

        // 3. Aggregate data per customer
        const summaries: Record<string, CustomerCreditSummary> = {}

        customers.forEach(customer => {
            const customerCredits = credits.filter(c => c.customer_id === customer.id)
            
            if (customerCredits.length > 0) {
                const customerCreditIds = customerCredits.map(c => c.id)
                const customerInstallments = installments.filter(i => customerCreditIds.includes(i.credit_id))
                
                const activeCredits = customerCredits.filter(c => c.status === 'active')
                const completedCredits = customerCredits.filter(c => c.status === 'completed')
                const defaultedCredits = customerCredits.filter(c => c.status === 'defaulted')

                const totalPrincipal = customerCredits.reduce((sum, c) => sum + c.principal, 0)
                
                // Calculate paid/pending from installments
                const paidInstallments = customerInstallments.filter(i => i.status === 'paid')
                const pendingInstallments = customerInstallments.filter(i => i.status === 'pending' || i.status === 'late')
                
                const totalPaid = paidInstallments.reduce((sum, i) => sum + (i.amount_paid || i.amount), 0)
                // Lo adeudado de una cuota es lo que falta pagar, no su importe
                // completo. Con el importe entero una cuota abonada a medias
                // inflaba la deuda del cliente en toda la lista de creditos
                // activos, y contradecia al detalle y al servidor.
                const totalPending = pendingInstallments.reduce((sum, i) => {
                    const amount = Math.max(0, Number(i.amount || 0))
                    const paid = Math.min(amount, Math.max(0, Number(i.amount_paid || 0)))
                    return sum + (amount - paid)
                }, 0)
                
                // Payment history stats
                const latePayments = paidInstallments.filter(i => {
                    if (!i.paid_at) return false
                    return new Date(i.paid_at) > new Date(i.due_date)
                })
                
                // Calculate next payment
                const nextInstallment = pendingInstallments
                    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
                
                let nextPayment = null
                if (nextInstallment) {
                    const dueDate = new Date(nextInstallment.due_date)
                    const now = new Date()
                    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    
                    const nextAmount = Math.max(0, Number(nextInstallment.amount || 0))
                    const nextPaid = Math.min(nextAmount, Math.max(0, Number(nextInstallment.amount_paid || 0)))

                    nextPayment = {
                        // Lo que queda por cobrar de esa cuota, no su importe original.
                        amount: nextAmount - nextPaid,
                        due_date: nextInstallment.due_date,
                        days_until_due: daysUntilDue,
                        is_overdue: daysUntilDue < 0
                    }
                }

                // Risk calculation (simplified)
                const riskScore = defaultedCredits.length * 50 + (nextPayment?.is_overdue ? 30 : 0)
                let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
                if (riskScore >= 80) riskLevel = 'critical'
                else if (riskScore >= 50) riskLevel = 'high'
                else if (riskScore >= 30) riskLevel = 'medium'

                const customerLimit = Number(customer.credit_limit || 0)
                const availableCredit = customerLimit > 0 ? Math.max(0, customerLimit - totalPending) : 0
                const creditUtilization = customerLimit > 0 ? Math.min(100, Math.round((totalPending / customerLimit) * 100)) : 0

                summaries[customer.id] = {
                    customer_id: customer.id,
                    total_credits: customerCredits.length,
                    active_credits: activeCredits.length,
                    completed_credits: completedCredits.length,
                    defaulted_credits: defaultedCredits.length,
                    total_principal: totalPrincipal,
                    total_paid: totalPaid,
                    total_pending: totalPending,
                    current_balance: totalPending,
                    credit_limit: customerLimit,
                    available_credit: availableCredit,
                    credit_utilization: creditUtilization,
                    store_balance: Number((customer as any).store_credit || 0),
                    store_reserved: 0,
                    overdue_debt: nextPayment?.is_overdue ? (nextPayment.amount || 0) : 0,
                    debts: [],
                    payment_history: {
                        on_time_payments: paidInstallments.length - latePayments.length,
                        late_payments: latePayments.length,
                        missed_payments: 0,
                        payment_score: 100
                    },
                    next_payment: nextPayment,
                    risk_assessment: {
                        risk_level: riskLevel,
                        risk_score: Math.min(100, riskScore),
                        factors: []
                    }
                }
            }
        })
        
        if (cancelled) return
        setCreditSummaries(summaries)
      } catch (error) {
        console.error('Error loading credit summaries:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCreditSummaries()

    return () => { cancelled = true }
  }, [customers, supabase])

  return {
    creditSummaries,
    loading,
    getCustomerCreditSummary: (customerId: string) => creditSummaries[customerId] || null
  }
}
