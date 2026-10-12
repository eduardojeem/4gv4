/**
 * Hook para manejar el sistema de créditos de clientes
 * Incluye ventas a crédito, pagos, historial y límites
 * 
 * SINCRONIZADO CON useCustomerCredits - Usa datos reales de Supabase
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { isCreditInstallmentOverdue } from '@/lib/credits/installments'
import { sumInstallmentsOutstanding } from '@/lib/credits/customer-outstanding'
import { Customer } from './use-customer-state'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { useBranch } from '@/contexts/branch-context'
import type { CollectionResult } from '@/lib/credits/collection-contract'
import { pendingCollectionAttempt, retryCollectionAttempt, runCollectionAttempt } from '@/lib/credits/collection-attempt'
import { useAuth } from '@/hooks/use-auth'
import { useOptionalActiveOrganization } from '@/contexts/ActiveOrganizationContext'

// Interfaces sincronizadas con Supabase
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

// Interfaces legacy para compatibilidad
export interface CreditTransaction {
  id: string
  customerId: string
  type: 'sale' | 'payment' | 'adjustment'
  amount: number
  description: string
  date: string
  saleId?: string
  paymentMethod?: string
  reference?: string
  status: 'pending' | 'completed' | 'cancelled'
  createdBy: string
}

export interface CreditSale {
  id: string
  customerId: string
  saleId: string
  amount: number
  remainingAmount: number
  dueDate: string
  status: 'pending' | 'partial' | 'paid' | 'overdue'
  createdAt: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  repairIds?: string[]
  installments?: {
    total: number
    current: number
    amount: number
    frequency: 'weekly' | 'biweekly' | 'monthly'
    nextDue: string
  }
}

export interface CreditSummary {
  totalCredit: number
  availableCredit: number
  usedCredit: number
  overdueAmount: number
  pendingSales: number
  creditUtilization: number // Porcentaje usado del límite
  // Campos adicionales sincronizados con useCustomerCredits
  activeCredits?: number
  completedCredits?: number
  totalPaid?: number
  nextPayment?: {
    amount: number
    due_date: string
    days_until_due: number
    is_overdue: boolean
  } | null
}

export interface UseCreditSystemReturn {
  // Estado
  creditTransactions: CreditTransaction[]
  creditSales: CreditSale[]
  loading: boolean
  error: string | null
  
  // Datos reales de Supabase
  credits: CreditInfo[]
  installments: InstallmentInfo[]
  payments: PaymentInfo[]
  
  // Funciones principales
  canSellOnCredit: (customer: Customer, amount: number) => boolean
  createCreditSale: (customer: Customer, saleData: {
    amount: number
    items: Array<{ name: string; quantity: number; price: number }>
    repairIds?: string[]
    dueDate?: string
    firstInstallmentTiming?: 'at_start' | 'next_cycle'
  }) => Promise<boolean>
  recordPayment: (customerId: string, amount: number, paymentMethod: string, reference?: string) => Promise<CollectionResult | false>
  hasPendingPayment: (customerId: string) => boolean
  hasVerifiedCustomer: (customerId: string) => boolean
  
  // Consultas
  getCreditSummary: (customer: Customer) => CreditSummary
  getCustomerTransactions: (customerId: string) => CreditTransaction[]
  getCustomerSales: (customerId: string) => CreditSale[]
  getOverdueSales: (customerId: string) => CreditSale[]
  
  // Utilidades
  formatCreditStatus: (status: string) => string
  getCreditStatusColor: (status: string) => string
  calculateDaysOverdue: (dueDate: string) => number
  
  // Carga de datos
  loadCreditData: (customerId?: string) => Promise<void>
  refresh: () => void
}

// Datos mock para desarrollo


export function useCreditSystem(): UseCreditSystemReturn {
  const { selectedBranchId } = useBranch()
  const { user } = useAuth()
  const organizationId = useOptionalActiveOrganization()?.organization?.id
  const [loading, setLoading] = useState(false)
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null)
  const dataSequence = useRef(0)
  const [error, setError] = useState<string | null>(null)
  
  // Datos reales de Supabase
  const [credits, setCredits] = useState<CreditInfo[]>([])
  const [installments, setInstallments] = useState<InstallmentInfo[]>([])
  const [payments, setPayments] = useState<PaymentInfo[]>([])
  
  // Legacy data (convertido desde datos reales)
  const [creditTransactions] = useState<CreditTransaction[]>([])
  const [creditSales, _setCreditSales] = useState<CreditSale[]>([])
  
  void (useMemo(() => createClient(), []));

  // Cargar datos de créditos desde Supabase
  const loadCreditData = useCallback(async (customerId?: string) => {
    if (!customerId) return
    const requestId = ++dataSequence.current

    setLoading(true)
    setError(null)

    try {
      if (!config.supabase.isConfigured) throw new Error('La consulta requiere conexión con la base de datos.')

      // Usar API para bypass RLS
      const response = await fetch('/api/credits/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: [customerId] })
      })

      if (!response.ok) throw new Error('Failed to fetch credit data')

      const { credits: creditsData, installments: installmentsData, payments: paymentsData } = await response.json()
      
      if (requestId !== dataSequence.current) return
      setCredits(creditsData || [])
      setInstallments(installmentsData || [])
      setPayments(paymentsData || [])
      setLoadedIdentity((organizationId ?? '') + ':' + customerId)

    } catch (error) {
      if (requestId !== dataSequence.current) return
      const message = error instanceof Error ? error.message : 'Error al cargar datos de créditos'
      setError(message)
      console.error('Error loading credit data:', error)
      // En caso de error, usar datos vacíos
      setCredits([])
      setInstallments([])
      setPayments([])
    } finally {
      if (requestId === dataSequence.current) setLoading(false)
    }
  }, [organizationId])

  // Verificar si un cliente puede comprar a crédito (SINCRONIZADO)
  const canSellOnCredit = useCallback((customer: Customer, amount: number): boolean => {
    if (!customer.credit_limit || customer.credit_limit <= 0) {
      return false
    }

    // Calcular balance real desde las cuotas pendientes (igual que useCustomerCredits)
    const customerCreditIds = credits
      .filter(c => c.customer_id === customer.id)
      .map(c => c.id)
    
    const pendingInstallments = installments.filter(i => 
      customerCreditIds.includes(i.credit_id) && 
      (i.status === 'pending' || i.status === 'late')
    )
    
    // Lo adeudado es el saldo de cada cuota, no su importe completo: una cuota
    // pagada a medias contaba entera y bloqueaba ventas que el servidor —que
    // resta `amount_paid`— si habria aceptado.
    const currentBalance = pendingInstallments.reduce((sum, i) => {
      const amount = Math.max(0, Number(i.amount || 0))
      const paid = Math.min(amount, Math.max(0, Number((i as { amount_paid?: number | null }).amount_paid || 0)))
      return sum + (amount - paid)
    }, 0)
    const availableCredit = customer.credit_limit - currentBalance
    
    return availableCredit >= amount
  }, [credits, installments])

  // Crear una venta a crédito (Implementación REAL con Supabase)
  const createCreditSale = useCallback(async (
    customer: Customer, 
    saleData: {
      amount: number
      items: Array<{ name: string; quantity: number; price: number }>
      repairIds?: string[]
      dueDate?: string
      firstInstallmentTiming?: 'at_start' | 'next_cycle'
      interestRate?: number
      installments?: {
        count: number
        frequency: 'weekly' | 'biweekly' | 'monthly'
      }
    }
  ): Promise<boolean> => {
    try {
      if (!canSellOnCredit(customer, saleData.amount)) {
        toast.error('El cliente no tiene suficiente límite de crédito disponible')
        return false
      }

      const response = await fetch('/api/credits/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          amount: saleData.amount,
          interestRate: saleData.interestRate ?? 0,
          dueDate: saleData.dueDate,
          firstInstallmentTiming: saleData.firstInstallmentTiming,
          installments: saleData.installments ?? { count: 1, frequency: 'monthly' },
        })
      })

      const result = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        throw new Error(result?.error || 'No se pudo registrar la venta a crédito')
      }

      toast.success(`Venta a crédito creada exitosamente`)
      
      // Recargar datos
      await loadCreditData(customer.id)
      
      return true
    } catch (error) {
      console.error('Error creating credit sale:', error)
      const message = error instanceof Error ? error.message : 'Error al crear la venta a crédito'
      toast.error(message)
      return false
    }
  }, [canSellOnCredit, loadCreditData])

  // The legacy POS consumer shares the same atomic, recoverable customer transaction.
  const hasPendingPayment = useCallback((customerId: string) => {
    if (!organizationId || !user?.id) return false
    try { return !!pendingCollectionAttempt(organizationId + ':' + user.id + ':' + customerId) }
    catch { return true }
  }, [organizationId, user?.id])
  const hasVerifiedCustomer = useCallback((customerId: string) => !loading && !error &&
    loadedIdentity === (organizationId ?? '') + ':' + customerId, [loading, error, loadedIdentity, organizationId])

  const recordPayment = useCallback(async (customerId: string, amount: number, paymentMethod: string,
    reference?: string): Promise<CollectionResult | false> => {
    if (!organizationId || !user?.id || !config.supabase.isConfigured) {
      toast.error('El cobro requiere una organización y sesión verificadas.')
      return false
    }
    const scope = organizationId + ':' + user.id + ':' + customerId
    try {
      let outcome
      if (pendingCollectionAttempt(scope)) {
        outcome = await retryCollectionAttempt(scope)
      } else {
        const creditIds = new Set(credits.filter(row => row.customer_id === customerId &&
          row.status !== 'completed' && row.status !== 'cancelled').map(row => row.id))
        let remaining = amount
        const allocations = installments.filter(row => creditIds.has(row.credit_id) && row.status !== 'paid')
          .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))).flatMap(row => {
            const applied = Math.min(remaining, Math.max(0, Number(row.amount) - Number(row.amount_paid || 0)))
            if (applied <= 0) return []
            remaining = Math.round((remaining - applied) * 100) / 100
            return [{ id: row.id, type: 'installment', amount: applied }]
          })
        if (!Number.isFinite(amount) || amount <= 0 || !allocations.length || remaining > 0) {
          toast.error('Revisá el importe y actualizá la deuda antes de cobrar.')
          return false
        }
        outcome = await runCollectionAttempt(scope, '/api/customers/' + customerId + '/collect-payment', {
          amount, paymentMethod, mode: 'manual', allocations, branchId: selectedBranchId,
          referenceNumber: paymentMethod === 'transfer' ? reference : undefined,
          voucherNumber: paymentMethod === 'card' ? reference : undefined,
          creditExcessToStoreCredit: false,
        })
      }
      void loadCreditData(customerId)
      toast.success('Cobro confirmado: ' + outcome.collection.receiptNumber)
      return outcome.collection
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo confirmar el cobro.')
      return false
    }
  }, [credits, installments, loadCreditData, selectedBranchId, organizationId, user?.id])

  // Obtener resumen de crédito del cliente (SINCRONIZADO)
  const getCreditSummary = useCallback((customer: Customer): CreditSummary => {
    const customerCredits = credits.filter(c => c.customer_id === customer.id)
    const customerCreditIds = customerCredits.map(c => c.id)
    const customerInstallments = installments.filter(i => customerCreditIds.includes(i.credit_id))
    
    const totalCredit = customer.credit_limit || 0
    
    // Calcular balance real desde cuotas pendientes (SINCRONIZADO)
    const pendingInstallments = customerInstallments.filter(i => 
      i.status === 'pending' || i.status === 'late'
    )
    const usedCredit = sumInstallmentsOutstanding(pendingInstallments)
    const availableCredit = totalCredit - usedCredit
    
    // Calcular cuotas vencidas
    const today = new Date()
    const overdueAmount = sumInstallmentsOutstanding(pendingInstallments.filter(i => isCreditInstallmentOverdue(i.due_date, today)))
    
    const pendingSales = customerCredits.filter(c => c.status === 'active').length
    const creditUtilization = totalCredit > 0 ? (usedCredit / totalCredit) * 100 : 0

    // Datos adicionales
    const activeCredits = customerCredits.filter(c => c.status === 'active').length
    const completedCredits = customerCredits.filter(c => c.status === 'completed').length
    
    const totalPaid = customerInstallments.reduce((sum, i) => sum + Math.min(i.amount, Math.max(0, i.amount_paid ?? (i.status === 'paid' ? i.amount : 0))), 0)
    
    // Próximo pago
    const nextInstallment = pendingInstallments
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]
    
    let nextPayment = null
    if (nextInstallment) {
      const dueDate = new Date(nextInstallment.due_date)
      const now = new Date()
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      nextPayment = {
        amount: sumInstallmentsOutstanding([nextInstallment]),
        due_date: nextInstallment.due_date,
        days_until_due: daysUntilDue,
        is_overdue: daysUntilDue < 0
      }
    }

    return {
      totalCredit,
      availableCredit,
      usedCredit,
      overdueAmount,
      pendingSales,
      creditUtilization,
      activeCredits,
      completedCredits,
      totalPaid,
      nextPayment
    }
  }, [credits, installments])

  // Obtener transacciones del cliente
  const getCustomerTransactions = useCallback((customerId: string): CreditTransaction[] => {
    return creditTransactions
      .filter(t => t.customerId === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [creditTransactions])

  // Obtener ventas del cliente
  const getCustomerSales = useCallback((customerId: string): CreditSale[] => {
    return creditSales
      .filter(s => s.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [creditSales])

  // Obtener ventas vencidas
  const getOverdueSales = useCallback((customerId: string): CreditSale[] => {
    const today = new Date()
    return creditSales
      .filter(s => 
        s.customerId === customerId && 
        s.status !== 'paid' && 
        new Date(s.dueDate) < today
      )
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }, [creditSales])

  // Formatear estado de crédito
  const formatCreditStatus = useCallback((status: string): string => {
    switch (status) {
      case 'pending': return 'Pendiente'
      case 'partial': return 'Parcial'
      case 'paid': return 'Pagado'
      case 'overdue': return 'Vencido'
      default: return status
    }
  }, [])

  // Obtener color del estado
  const getCreditStatusColor = useCallback((status: string): string => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'partial': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }, [])

  // Calcular días de vencimiento
  const calculateDaysOverdue = useCallback((dueDate: string): number => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = today.getTime() - due.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }, [])

  // Función refresh para recargar datos
  const refresh = useCallback(() => {
    setCredits([])
    setInstallments([])
    setPayments([])
  }, [])

  return {
    creditTransactions,
    creditSales,
    loading,
    error,
    credits,
    installments,
    payments,
    canSellOnCredit,
    createCreditSale,
    recordPayment,
    hasPendingPayment,
    hasVerifiedCustomer,
    getCreditSummary,
    getCustomerTransactions,
    getCustomerSales,
    getOverdueSales,
    formatCreditStatus,
    getCreditStatusColor,
    calculateDaysOverdue,
    loadCreditData,
    refresh
  }
}
