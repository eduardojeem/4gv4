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
          // Datos mock para desarrollo
          const mockCredits: CreditInfo[] = [
            {
              id: `credit-${customerId}-1`,
              customer_id: customerId,
              principal: 1500000,
              interest_rate: 12,
              term_months: 12,
              start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: `credit-${customerId}-2`,
              customer_id: customerId,
              principal: 800000,
              interest_rate: 8,
              term_months: 6,
              start_date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
              status: 'completed',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]

          const mockInstallments: InstallmentInfo[] = [
            {
              id: `inst-${customerId}-1`,
              credit_id: `credit-${customerId}-1`,
              installment_number: 1,
              due_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              amount: 150000,
              status: 'paid',
              paid_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
              payment_method: 'cash',
              amount_paid: 150000,
              created_at: new Date().toISOString()
            },
            {
              id: `inst-${customerId}-2`,
              credit_id: `credit-${customerId}-1`,
              installment_number: 2,
              due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
              amount: 150000,
              status: 'pending',
              created_at: new Date().toISOString()
            },
            {
              id: `inst-${customerId}-3`,
              credit_id: `credit-${customerId}-1`,
              installment_number: 3,
              due_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
              amount: 150000,
              status: 'pending',
              created_at: new Date().toISOString()
            }
          ]

          const mockPayments: PaymentInfo[] = [
            {
              id: `pay-${customerId}-1`,
              credit_id: `credit-${customerId}-1`,
              installment_id: `inst-${customerId}-1`,
              amount: 150000,
              payment_method: 'cash',
              created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
              notes: 'Pago puntual'
            }
          ]

          setCredits(mockCredits)
          setInstallments(mockInstallments)
          setPayments(mockPayments)
        } else {
          // Cargar datos reales de Supabase
          const [creditsResult, installmentsResult, paymentsResult] = await Promise.all([
            supabase
              .from('customer_credits')
              .select('*')
              .eq('customer_id', customerId)
              .order('created_at', { ascending: false }),
            supabase
              .from('credit_installments')
              .select('*')
              .in('credit_id', credits.map(c => c.id))
              .order('due_date', { ascending: true }),
            supabase
              .from('credit_payments')
              .select('*')
              .in('credit_id', credits.map(c => c.id))
              .order('created_at', { ascending: false })
              .limit(10)
          ])

          if (creditsResult.error) throw creditsResult.error
          if (installmentsResult.error) throw installmentsResult.error
          if (paymentsResult.error) throw paymentsResult.error

          setCredits(creditsResult.data || [])
          setInstallments(installmentsResult.data || [])
          setPayments(paymentsResult.data || [])
        }
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
    const summaries: Record<string, CustomerCreditSummary> = {}
    
    // En una implementación real, esto sería una consulta optimizada
    for (const id of customerIds) {
      // Por ahora retornamos datos mock
      summaries[id] = {
        customer_id: id,
        total_credits: Math.floor(Math.random() * 5) + 1,
        active_credits: Math.floor(Math.random() * 3),
        completed_credits: Math.floor(Math.random() * 3),
        defaulted_credits: Math.floor(Math.random() * 2),
        total_principal: Math.floor(Math.random() * 5000000) + 500000,
        total_paid: Math.floor(Math.random() * 2000000),
        total_pending: Math.floor(Math.random() * 1000000),
        current_balance: Math.floor(Math.random() * 1000000),
        credit_limit: 5000000,
        credit_utilization: Math.floor(Math.random() * 100),
        payment_history: {
          on_time_payments: Math.floor(Math.random() * 20) + 5,
          late_payments: Math.floor(Math.random() * 5),
          missed_payments: Math.floor(Math.random() * 2),
          payment_score: Math.floor(Math.random() * 40) + 60
        },
        next_payment: Math.random() > 0.3 ? {
          amount: Math.floor(Math.random() * 200000) + 50000,
          due_date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          days_until_due: Math.floor(Math.random() * 30) - 5,
          is_overdue: Math.random() > 0.8
        } : null,
        risk_assessment: {
          risk_level: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
          risk_score: Math.floor(Math.random() * 100),
          factors: ['Sin factores de riesgo identificados']
        }
      }
    }
    
    return summaries
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

  useEffect(() => {
    if (customers.length === 0) return

    const loadCreditSummaries = async () => {
      setLoading(true)
      try {
        // Simular carga de datos de crédito para todos los clientes
        const summaries: Record<string, CustomerCreditSummary> = {}
        
        customers.forEach(customer => {
          const hasCredits = Math.random() > 0.3 // 70% de clientes tienen créditos
          
          if (hasCredits) {
            const totalCredits = Math.floor(Math.random() * 5) + 1
            const activeCredits = Math.floor(Math.random() * 3)
            const totalPrincipal = Math.floor(Math.random() * 5000000) + 500000
            const totalPaid = Math.floor(Math.random() * totalPrincipal * 0.8)
            const totalPending = totalPrincipal - totalPaid
            
            const onTimePayments = Math.floor(Math.random() * 20) + 5
            const latePayments = Math.floor(Math.random() * 5)
            const missedPayments = Math.floor(Math.random() * 2)
            const paymentScore = Math.floor(((onTimePayments * 100) + (latePayments * 50)) / ((onTimePayments + latePayments + missedPayments) * 100) * 100)
            
            let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
            let riskScore = 0
            
            if (latePayments > onTimePayments * 0.3) riskScore += 30
            if (missedPayments > 0) riskScore += 40
            if (totalPending > totalPrincipal * 0.8) riskScore += 20
            
            if (riskScore >= 80) riskLevel = 'critical'
            else if (riskScore >= 60) riskLevel = 'high'
            else if (riskScore >= 30) riskLevel = 'medium'

            summaries[customer.id] = {
              customer_id: customer.id,
              total_credits: totalCredits,
              active_credits: activeCredits,
              completed_credits: totalCredits - activeCredits,
              defaulted_credits: Math.floor(Math.random() * 2),
              total_principal: totalPrincipal,
              total_paid: totalPaid,
              total_pending: totalPending,
              current_balance: totalPending,
              credit_limit: customer.credit_limit || 5000000,
              credit_utilization: Math.round((totalPending / (customer.credit_limit || 5000000)) * 100),
              payment_history: {
                on_time_payments: onTimePayments,
                late_payments: latePayments,
                missed_payments: missedPayments,
                payment_score: paymentScore
              },
              next_payment: Math.random() > 0.4 ? {
                amount: Math.floor(Math.random() * 200000) + 50000,
                due_date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                days_until_due: Math.floor(Math.random() * 30) - 5,
                is_overdue: Math.random() > 0.8
              } : null,
              risk_assessment: {
                risk_level: riskLevel,
                risk_score: Math.min(100, riskScore),
                factors: riskScore === 0 ? ['Sin factores de riesgo identificados'] : ['Factores de riesgo detectados']
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
  }, [customers])

  return {
    creditSummaries,
    loading,
    getCustomerCreditSummary: (customerId: string) => creditSummaries[customerId] || null
  }
}