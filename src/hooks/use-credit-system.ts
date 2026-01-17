/**
 * Hook para manejar el sistema de créditos de clientes
 * Incluye ventas a crédito, pagos, historial y límites
 * 
 * SINCRONIZADO CON useCustomerCredits - Usa datos reales de Supabase
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Customer } from './use-customer-state'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'

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
  }) => Promise<boolean>
  recordPayment: (customerId: string, amount: number, paymentMethod: string, reference?: string) => Promise<boolean>
  
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
const mockTransactions: CreditTransaction[] = [
  {
    id: 'tx-001',
    customerId: 'customer-1',
    type: 'sale',
    amount: 150000,
    description: 'Venta POS - Reparación iPhone 12',
    date: '2024-12-20',
    saleId: 'sale-001',
    status: 'completed',
    createdBy: 'user-1'
  },
  {
    id: 'tx-002',
    customerId: 'customer-1',
    type: 'payment',
    amount: -50000,
    description: 'Pago parcial - Efectivo',
    date: '2024-12-22',
    paymentMethod: 'cash',
    reference: 'PAY-001',
    status: 'completed',
    createdBy: 'user-1'
  },
  {
    id: 'tx-003',
    customerId: 'customer-1',
    type: 'sale',
    amount: 75000,
    description: 'Venta POS - Accesorios',
    date: '2024-12-25',
    saleId: 'sale-002',
    status: 'completed',
    createdBy: 'user-1'
  }
]

const mockCreditSales: CreditSale[] = [
  {
    id: 'cs-001',
    customerId: 'customer-1',
    saleId: 'sale-001',
    amount: 150000,
    remainingAmount: 100000,
    dueDate: '2025-01-20',
    status: 'partial',
    createdAt: '2024-12-20',
    items: [
      { name: 'Reparación iPhone 12', quantity: 1, price: 150000 }
    ],
    repairIds: ['repair-001']
  },
  {
    id: 'cs-002',
    customerId: 'customer-1',
    saleId: 'sale-002',
    amount: 75000,
    remainingAmount: 75000,
    dueDate: '2025-01-25',
    status: 'pending',
    createdAt: '2024-12-25',
    items: [
      { name: 'Funda iPhone', quantity: 1, price: 45000 },
      { name: 'Protector pantalla', quantity: 1, price: 30000 }
    ]
  }
]

export function useCreditSystem(): UseCreditSystemReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Datos reales de Supabase
  const [credits, setCredits] = useState<CreditInfo[]>([])
  const [installments, setInstallments] = useState<InstallmentInfo[]>([])
  const [payments, setPayments] = useState<PaymentInfo[]>([])
  
  // Legacy data (convertido desde datos reales)
  const [creditTransactions] = useState<CreditTransaction[]>([])
  const [creditSales, setCreditSales] = useState<CreditSale[]>([])
  
  const supabase = useMemo(() => createClient(), [])

  // Cargar datos de créditos desde Supabase
  const loadCreditData = useCallback(async (customerId?: string) => {
    if (!customerId) return

    setLoading(true)
    setError(null)

    try {
      if (!config.supabase.isConfigured) {
        console.warn('Supabase not configured, using mock data')
        // Usar datos mock si Supabase no está configurado
        const mockCustomerCredits = credits.filter(c => c.customer_id === customerId)
        const mockCustomerInstallments = installments.filter(i => 
          mockCustomerCredits.map(c => c.id).includes(i.credit_id)
        )
        setCredits(mockCustomerCredits)
        setInstallments(mockCustomerInstallments)
        setPayments([])
        setLoading(false)
        return
      }

      // Usar API para bypass RLS
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
      // En caso de error, usar datos vacíos
      setCredits([])
      setInstallments([])
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

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
    
    const currentBalance = pendingInstallments.reduce((sum, i) => sum + i.amount, 0)
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

      const installmentCount = saleData.installments?.count || 1
      const frequency = saleData.installments?.frequency || 'monthly'

      // 1. Crear el crédito principal
      const { data: creditData, error: creditError } = await supabase
        .from('customer_credits')
        .insert({
          customer_id: customer.id,
          principal: saleData.amount,
          interest_rate: 0, // Por ahora 0% interés en POS
          term_months: installmentCount, // Aproximación si es mensual
          start_date: new Date().toISOString(),
          status: 'active'
        })
        .select()
        .single()

      if (creditError) {
        console.error('Error creating credit header:', creditError)
        throw new Error('Error al crear el registro de crédito')
      }

      const creditId = creditData.id

      // 2. Generar cuotas
      const installmentsToInsert = []
      const baseAmount = Math.floor(saleData.amount / installmentCount)
      const remainder = saleData.amount % installmentCount

      for (let i = 0; i < installmentCount; i++) {
        const dueDate = new Date()
        // Calcular fecha según frecuencia
        if (frequency === 'weekly') dueDate.setDate(dueDate.getDate() + (7 * (i + 1)))
        else if (frequency === 'biweekly') dueDate.setDate(dueDate.getDate() + (14 * (i + 1)))
        else dueDate.setMonth(dueDate.getMonth() + (i + 1)) // Mensual default

        installmentsToInsert.push({
          credit_id: creditId,
          installment_number: i + 1,
          amount: i === installmentCount - 1 ? baseAmount + remainder : baseAmount,
          due_date: dueDate.toISOString(),
          status: 'pending'
        })
      }

      const { error: installmentsError } = await supabase
        .from('credit_installments')
        .insert(installmentsToInsert)

      if (installmentsError) {
        console.error('Error creating installments:', installmentsError)
        // Idealmente aquí haríamos rollback del credit header
        await supabase.from('customer_credits').delete().eq('id', creditId)
        throw new Error('Error al generar las cuotas')
      }

      // 3. (Opcional) Vincular reparaciones si existen
      // Esto requeriría una tabla intermedia o actualizar la tabla repairs con el credit_id
      // Por ahora el CheckoutModal maneja la actualización de estado de repairs a 'entregado'

      toast.success(`Venta a crédito creada exitosamente`)
      
      // Recargar datos
      await loadCreditData(customer.id)
      
      return true
    } catch (error: any) {
      console.error('Error creating credit sale:', error)
      toast.error(error.message || 'Error al crear la venta a crédito')
      return false
    }
  }, [canSellOnCredit, loadCreditData, supabase])

  // Registrar un pago (Implementación REAL con Supabase)
  const recordPayment = useCallback(async (
    customerId: string, 
    amount: number, 
    paymentMethod: string, 
    reference?: string
  ): Promise<boolean> => {
    try {
      // 1. Obtener cuotas pendientes del cliente (FIFO)
      const customerCreditIds = credits
        .filter(c => c.customer_id === customerId)
        .map(c => c.id)
      
      const pendingInstallments = installments
        .filter(i => 
          customerCreditIds.includes(i.credit_id) && 
          (i.status === 'pending' || i.status === 'late')
        )
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

      if (pendingInstallments.length === 0) {
        toast.error('El cliente no tiene deuda pendiente')
        return false
      }

      let remainingPayment = amount
      const paymentsToInsert = []

      for (const installment of pendingInstallments) {
        if (remainingPayment <= 0) break

        const currentBalance = installment.amount - (installment.amount_paid || 0)
        const paymentAmount = Math.min(remainingPayment, currentBalance)

        if (paymentAmount > 0) {
          paymentsToInsert.push({
            credit_id: installment.credit_id,
            installment_id: installment.id,
            amount: paymentAmount,
            payment_method: paymentMethod,
            notes: reference ? `Referencia: ${reference}` : undefined
          })
          remainingPayment -= paymentAmount
        }
      }

      if (paymentsToInsert.length === 0) {
        toast.error('No se pudo aplicar el pago a ninguna cuota')
        return false
      }

      // 2. Insertar pagos (Los triggers de BD deberían actualizar estados)
      const { error: paymentError } = await supabase
        .from('credit_payments')
        .insert(paymentsToInsert)

      if (paymentError) {
        console.error('Error recording payments:', paymentError)
        throw new Error('Error al registrar los pagos en base de datos')
      }

      if (remainingPayment > 0) {
        toast.success(`Pago registrado parcialmente. Sobraron ${formatCurrency(remainingPayment)}`)
      } else {
        toast.success(`Pago registrado: ${formatCurrency(amount)}`)
      }

      // Recargar datos
      await loadCreditData(customerId)
      
      return true
    } catch (error: any) {
      console.error('Error recording payment:', error)
      toast.error(error.message || 'Error al registrar el pago')
      return false
    }
  }, [credits, installments, loadCreditData, supabase])

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
    const usedCredit = pendingInstallments.reduce((sum, i) => sum + i.amount, 0)
    const availableCredit = totalCredit - usedCredit
    
    // Calcular cuotas vencidas
    const today = new Date()
    const overdueAmount = pendingInstallments
      .filter(i => new Date(i.due_date) < today)
      .reduce((sum, i) => sum + i.amount, 0)
    
    const pendingSales = customerCredits.filter(c => c.status === 'active').length
    const creditUtilization = totalCredit > 0 ? (usedCredit / totalCredit) * 100 : 0

    // Datos adicionales
    const activeCredits = customerCredits.filter(c => c.status === 'active').length
    const completedCredits = customerCredits.filter(c => c.status === 'completed').length
    
    const paidInstallments = customerInstallments.filter(i => i.status === 'paid')
    const totalPaid = paidInstallments.reduce((sum, i) => sum + (i.amount_paid || i.amount), 0)
    
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