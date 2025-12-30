/**
 * Hook para manejar el sistema de créditos de clientes
 * Incluye ventas a crédito, pagos, historial y límites
 */

import { useState, useCallback, useMemo } from 'react'
import { Customer } from './use-customer-state'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'

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
}

export interface UseCreditSystemReturn {
  // Estado
  creditTransactions: CreditTransaction[]
  creditSales: CreditSale[]
  
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
  const [creditTransactions] = useState<CreditTransaction[]>(mockTransactions)
  const [creditSales, setCreditSales] = useState<CreditSale[]>(mockCreditSales)

  // Verificar si un cliente puede comprar a crédito
  const canSellOnCredit = useCallback((customer: Customer, amount: number): boolean => {
    if (!customer.credit_limit || customer.credit_limit <= 0) {
      return false
    }

    const currentBalance = customer.current_balance || 0
    const availableCredit = customer.credit_limit - currentBalance
    
    return availableCredit >= amount
  }, [])

  // Crear una venta a crédito
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

      // Calcular fechas de vencimiento para cuotas
      let dueDate = saleData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      let installmentInfo = undefined

      if (saleData.installments && saleData.installments.count > 1) {
        const installmentAmount = Math.round(saleData.amount / saleData.installments.count)
        
        // Calcular próxima fecha de vencimiento según frecuencia
        const nextDueDate = new Date()
        switch (saleData.installments.frequency) {
          case 'weekly':
            nextDueDate.setDate(nextDueDate.getDate() + 7)
            break
          case 'biweekly':
            nextDueDate.setDate(nextDueDate.getDate() + 14)
            break
          case 'monthly':
            nextDueDate.setMonth(nextDueDate.getMonth() + 1)
            break
        }

        installmentInfo = {
          total: saleData.installments.count,
          current: 1,
          amount: installmentAmount,
          frequency: saleData.installments.frequency,
          nextDue: nextDueDate.toISOString().split('T')[0]
        }

        dueDate = nextDueDate.toISOString().split('T')[0]
      }

      const newSale: CreditSale = {
        id: `cs-${Date.now()}`,
        customerId: customer.id,
        saleId: `sale-${Date.now()}`,
        amount: saleData.amount,
        remainingAmount: saleData.amount,
        dueDate,
        status: 'pending',
        createdAt: new Date().toISOString().split('T')[0],
        items: saleData.items,
        repairIds: saleData.repairIds,
        installments: installmentInfo
      }

      const newTransaction: CreditTransaction = {
        id: `tx-${Date.now()}`,
        customerId: customer.id,
        type: 'sale',
        amount: saleData.amount,
        description: installmentInfo 
          ? `Venta a crédito (${installmentInfo.total} cuotas) - ${saleData.items.map(i => i.name).join(', ')}`
          : `Venta a crédito - ${saleData.items.map(i => i.name).join(', ')}`,
        date: new Date().toISOString().split('T')[0],
        saleId: newSale.saleId,
        status: 'completed',
        createdBy: 'current-user'
      }

      setCreditSales(prev => [...prev, newSale])
      
      const successMessage = installmentInfo 
        ? `Venta a crédito creada: ${formatCurrency(saleData.amount)} en ${installmentInfo.total} cuotas de ${formatCurrency(installmentInfo.amount)}`
        : `Venta a crédito creada por ${formatCurrency(saleData.amount)}`
      
      toast.success(successMessage)
      return true
    } catch (error) {
      console.error('Error creating credit sale:', error)
      toast.error('Error al crear la venta a crédito')
      return false
    }
  }, [canSellOnCredit])

  // Registrar un pago
  const recordPayment = useCallback(async (
    customerId: string, 
    amount: number, 
    paymentMethod: string, 
    reference?: string
  ): Promise<boolean> => {
    try {
      const newTransaction: CreditTransaction = {
        id: `tx-${Date.now()}`,
        customerId,
        type: 'payment',
        amount: -amount, // Negativo porque reduce el balance
        description: `Pago - ${paymentMethod}`,
        date: new Date().toISOString().split('T')[0],
        paymentMethod,
        reference,
        status: 'completed',
        createdBy: 'current-user'
      }

      // Aplicar el pago a las ventas pendientes (FIFO)
      setCreditSales(prev => {
        const customerSales = prev.filter(s => s.customerId === customerId && s.remainingAmount > 0)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        
        let remainingPayment = amount
        const updatedSales = prev.map(sale => {
          if (sale.customerId === customerId && sale.remainingAmount > 0 && remainingPayment > 0) {
            const paymentToApply = Math.min(remainingPayment, sale.remainingAmount)
            remainingPayment -= paymentToApply
            
            const newRemainingAmount = sale.remainingAmount - paymentToApply
            return {
              ...sale,
              remainingAmount: newRemainingAmount,
              status: newRemainingAmount === 0 ? 'paid' as const : 'partial' as const
            }
          }
          return sale
        })

        return updatedSales
      })

      toast.success(`Pago registrado: ${formatCurrency(amount)}`)
      return true
    } catch (error) {
      console.error('Error recording payment:', error)
      toast.error('Error al registrar el pago')
      return false
    }
  }, [])

  // Obtener resumen de crédito del cliente
  const getCreditSummary = useCallback((customer: Customer): CreditSummary => {
    const customerSales = creditSales.filter(s => s.customerId === customer.id)
    const totalCredit = customer.credit_limit || 0
    const usedCredit = customer.current_balance || 0
    const availableCredit = totalCredit - usedCredit
    
    const overdueAmount = customerSales
      .filter(s => s.status !== 'paid' && new Date(s.dueDate) < new Date())
      .reduce((sum, s) => sum + s.remainingAmount, 0)
    
    const pendingSales = customerSales.filter(s => s.status !== 'paid').length
    const creditUtilization = totalCredit > 0 ? (usedCredit / totalCredit) * 100 : 0

    return {
      totalCredit,
      availableCredit,
      usedCredit,
      overdueAmount,
      pendingSales,
      creditUtilization
    }
  }, [creditSales])

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

  return {
    creditTransactions,
    creditSales,
    canSellOnCredit,
    createCreditSale,
    recordPayment,
    getCreditSummary,
    getCustomerTransactions,
    getCustomerSales,
    getOverdueSales,
    formatCreditStatus,
    getCreditStatusColor,
    calculateDaysOverdue
  }
}