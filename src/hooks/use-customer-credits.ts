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
  credit_utilization: number // Porcentaje de crédito utilizado
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

export function useCustomerCredits(customerId?: string) {
  const [loading, setLoading] = useState(false)
  const [credits, setCredits] = useState<CreditInfo[]>([])
  const [installments, setInstallments] = useState<InstallmentInfo[]>([])
  const [payments, setPayments] = useState<PaymentInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  // Cargar datos de créditos
  useEffect(() => {
    if (!customerId) return

    const loadCreditData = async () => {
      setLoading(true)
      setError(null)

      try {
        if (!config.supabase.isConfigured) {
          console.warn('Supabase not configured')
          setCredits([])
          setInstallments([])
          setPayments([])
          return
        }

        // Use API to bypass RLS
        const response = await fetch('/api/credits/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerIds: [customerId] })
        })

        if (!response.ok) throw new Error('Failed to fetch credit data')

        const { credits: creditsData, installments: installmentsData, payments: paymentsData } = await response.json()
        
        setCredits(creditsData || [])
        setInstallments(installmentsData || [])
        setPayments(paymentsData || [])

      } catch (err: any) {
        setError(err.message || 'Error al cargar datos de créditos')
        console.error('Error loading credit data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCreditData()
  }, [customerId, supabase])

  // Calcular resumen de créditos del cliente
  const creditSummary = useMemo((): CustomerCreditSummary | null => {
    if (!customerId || credits.length === 0) return null

    const activeCredits = credits.filter(c => c.status === 'active')
    const completedCredits = credits.filter(c => c.status === 'completed')
    const defaultedCredits = credits.filter(c => c.status === 'defaulted')

    const totalPrincipal = credits.reduce((sum, c) => sum + c.principal, 0)
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    
    const pendingInstallments = installments.filter(i => i.status === 'pending' || i.status === 'late')
    const totalPending = pendingInstallments.reduce((sum, i) => sum + i.amount, 0)

    // Calcular historial de pagos
    const paidInstallments = installments.filter(i => i.status === 'paid')
    const latePayments = paidInstallments.filter(i => {
      if (!i.paid_at) return false
      const paidDate = new Date(i.paid_at)
      const dueDate = new Date(i.due_date)
      return paidDate > dueDate
    })
    const onTimePayments = paidInstallments.length - latePayments.length
    const missedPayments = installments.filter(i => {
      if (i.status !== 'pending') return false
      const dueDate = new Date(i.due_date)
      const now = new Date()
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      return daysPastDue > 30 // Consideramos perdido después de 30 días
    }).length

    const totalPaymentEvents = onTimePayments + latePayments.length + missedPayments.length
    const paymentScore = totalPaymentEvents > 0 
      ? Math.round(((onTimePayments * 100) + (latePayments.length * 50)) / (totalPaymentEvents * 100) * 100)
      : 100

    // Próximo pago
    const nextInstallment = pendingInstallments
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
    
    let nextPayment = null
    if (nextInstallment) {
      const dueDate = new Date(nextInstallment.due_date)
      const now = new Date()
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      nextPayment = {
        amount: nextInstallment.amount,
        due_date: nextInstallment.due_date,
        days_until_due: daysUntilDue,
        is_overdue: daysUntilDue < 0
      }
    }

    // Evaluación de riesgo
    let riskScore = 0
    const riskFactors: string[] = []

    // Factores de riesgo
    if (latePayments.length > onTimePayments * 0.3) {
      riskScore += 30
      riskFactors.push('Historial de pagos tardíos')
    }
    
    if (missedPayments > 0) {
      riskScore += 40
      riskFactors.push('Pagos perdidos')
    }

    if (defaultedCredits.length > 0) {
      riskScore += 50
      riskFactors.push('Créditos en mora')
    }

    const creditUtilization = totalPending / (totalPrincipal || 1) * 100
    if (creditUtilization > 80) {
      riskScore += 20
      riskFactors.push('Alta utilización de crédito')
    }

    if (nextPayment?.is_overdue) {
      riskScore += 25
      riskFactors.push('Pago vencido')
    }

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (riskScore >= 80) riskLevel = 'critical'
    else if (riskScore >= 60) riskLevel = 'high'
    else if (riskScore >= 30) riskLevel = 'medium'

    if (riskFactors.length === 0) {
      riskFactors.push('Sin factores de riesgo identificados')
    }

    return {
      customer_id: customerId,
      total_credits: credits.length,
      active_credits: activeCredits.length,
      completed_credits: completedCredits.length,
      defaulted_credits: defaultedCredits.length,
      total_principal: totalPrincipal,
      total_paid: totalPaid,
      total_pending: totalPending,
      current_balance: totalPending,
      credit_limit: 5000000, // Esto debería venir de la configuración del cliente
      credit_utilization: Math.round(creditUtilization),
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
  }, [customerId, credits, installments, payments])

  // Función para obtener resumen de múltiples clientes
  const getMultipleCustomersSummary = async (customerIds: string[]): Promise<Record<string, CustomerCreditSummary>> => {
    try {
      const response = await fetch('/api/credits/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerIds })
      })

      if (!response.ok) throw new Error('Failed to fetch credit data')

      const { credits: creditsData, installments: installmentsData } = await response.json()
      const credits = (creditsData || []) as CreditInfo[]
      const installments = (installmentsData || []) as InstallmentInfo[]

      const summaries: Record<string, CustomerCreditSummary> = {}

      for (const id of customerIds) {
          const customerCredits = credits.filter(c => c.customer_id === id)
          
          if (customerCredits.length > 0) {
              const customerCreditIds = customerCredits.map(c => c.id)
              const customerInstallments = installments.filter(i => customerCreditIds.includes(i.credit_id))
              
              const activeCredits = customerCredits.filter(c => c.status === 'active')
              const completedCredits = customerCredits.filter(c => c.status === 'completed')
              const defaultedCredits = customerCredits.filter(c => c.status === 'defaulted')

              const totalPrincipal = customerCredits.reduce((sum, c) => sum + c.principal, 0)
              
              const paidInstallments = customerInstallments.filter(i => i.status === 'paid')
              const pendingInstallments = customerInstallments.filter(i => i.status === 'pending' || i.status === 'late')
              
              const totalPaid = paidInstallments.reduce((sum, i) => sum + (i.amount_paid || i.amount), 0)
              const totalPending = pendingInstallments.reduce((sum, i) => sum + i.amount, 0)
              
              const latePayments = paidInstallments.filter(i => {
                  if (!i.paid_at) return false
                  return new Date(i.paid_at) > new Date(i.due_date)
              })
              
              const nextInstallment = pendingInstallments
                  .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
              
              let nextPayment = null
              if (nextInstallment) {
                  const dueDate = new Date(nextInstallment.due_date)
                  const now = new Date()
                  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  
                  nextPayment = {
                      amount: nextInstallment.amount,
                      due_date: nextInstallment.due_date,
                      days_until_due: daysUntilDue,
                      is_overdue: daysUntilDue < 0
                  }
              }

              const riskScore = defaultedCredits.length * 50 + (nextPayment?.is_overdue ? 30 : 0)
              let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
              if (riskScore >= 80) riskLevel = 'critical'
              else if (riskScore >= 50) riskLevel = 'high'
              else if (riskScore >= 30) riskLevel = 'medium'

              summaries[id] = {
                  customer_id: id,
                  total_credits: customerCredits.length,
                  active_credits: activeCredits.length,
                  completed_credits: completedCredits.length,
                  defaulted_credits: defaultedCredits.length,
                  total_principal: totalPrincipal,
                  total_paid: totalPaid,
                  total_pending: totalPending,
                  current_balance: totalPending,
                  credit_limit: 5000000,
                  credit_utilization: Math.round((totalPending / 5000000) * 100),
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
      }
      return summaries
    } catch (error) {
      console.error('Error fetching multiple customer summaries:', error)
      return {}
    }
  }

  return {
    loading,
    error,
    credits,
    installments,
    payments,
    creditSummary,
    getMultipleCustomersSummary,
    refresh: () => {
      if (customerId) {
        // Trigger reload
        setCredits([])
        setInstallments([])
        setPayments([])
      }
    }
  }
}

// Hook para obtener resúmenes de crédito de múltiples clientes
export function useCustomersWithCredits(customers: Customer[]) {
  const [creditSummaries, setCreditSummaries] = useState<Record<string, CustomerCreditSummary>>({})
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (customers.length === 0) return

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
                const totalPending = pendingInstallments.reduce((sum, i) => sum + i.amount, 0)
                
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
                    
                    nextPayment = {
                        amount: nextInstallment.amount,
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
                    credit_limit: customer.credit_limit || 5000000,
                    credit_utilization: Math.round((totalPending / (customer.credit_limit || 5000000)) * 100),
                    payment_history: {
                        on_time_payments: paidInstallments.length - latePayments.length,
                        late_payments: latePayments.length,
                        missed_payments: 0, // Need to calculate properly if needed
                        payment_score: 100 // Placeholder
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
        
        setCreditSummaries(summaries)
      } catch (error) {
        console.error('Error loading credit summaries:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCreditSummaries()
  }, [customers, supabase])

  return {
    creditSummaries,
    loading,
    getCustomerCreditSummary: (customerId: string) => creditSummaries[customerId] || null
  }
}