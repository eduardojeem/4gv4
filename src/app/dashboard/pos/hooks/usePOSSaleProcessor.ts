'use client'

/**
 * usePOSSaleProcessor
 *
 * Encapsula el procesamiento de ventas del POS:
 * - processSale: pago simple (efectivo, tarjeta, transferencia, crédito)
 * - processMixedPayment: pago con múltiples métodos
 * - normalizePaymentError: normalización de mensajes de error
 * - paymentAttempts: historial de intentos para diagnóstico
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { createReceiptData } from '@/lib/receipt-utils'
import { buildPosCreditSummary, withPersistedCreditSchedule, type PosCreditTerms } from '@/lib/credits/pos-credit-summary'
import { getMixedPaymentValidation } from '../lib/payment-validation'
import type { CartItem } from '../types'
import { firstPaymentError } from '@/lib/credits/first-payment'

// ─── Tipos auxiliares ────────────────────────────────────────────────────────

export interface PaymentAttempt {
  time: string
  status: 'processing' | 'success' | 'failed'
  method: 'single' | 'mixed'
  amount: number
  message?: string
}

export interface SaleProcessorDependencies {
  // Caja
  isRegisterOpen: boolean
  currentSessionId: string | null

  // Carrito y cálculos
  combinedCartItems: CartItem[]
  cartCalculations: {
    subtotal: number
    totalDiscount: number
    tax: number
    repairCost?: number
    total: number
    change: number
  }
  isWholesale: boolean
  generalDiscount: number

  // Checkout (desde CheckoutContext)
  paymentMethod: string
  cashReceived: number
  cardNumber: string
  transferReference: string
  electronicProvider: string
  electronicInstitution: string
  electronicChannel: string
  terminalId: string
  notes: string
  creditTerms: PosCreditTerms
  paymentSplit: Array<{
    id: string
    method: string
    amount: number
    reference?: string
    cardLast4?: string
    provider?: string
    institution?: string
    channel?: string
    terminalId?: string
  }>
  storeCreditApplied: number

  // Reparaciones
  selectedRepairIds: string[]
  markRepairDelivered: boolean
  deliveryOutcome: 'repaired' | 'withdrawn' | 'unrepairable'

  // Cliente
  selectedCustomer: string
  customers: any[]
  cashierName: string

  // Callbacks de estado de pago (CheckoutContext setters)
  setPaymentStatus: (s: 'idle' | 'processing' | 'success' | 'failed') => void
  setPaymentError: (e: string) => void

  // Callback que ejecuta la transacción en el servidor
  processInventorySale: (payload: any) => Promise<any>

  // Callbacks post-venta
  onSuccess: (receiptData: any) => void
  onAfterSale: () => void

  // Formateo
  formatCurrency: (amount: number) => string

  // Medidor de performance (opcional)
  measureSaleProcessing?: <T>(fn: () => Promise<T>) => Promise<T>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePOSSaleProcessor() {
  const [paymentAttempts, setPaymentAttempts] = useState<PaymentAttempt[]>([])

  const addPaymentAttempt = useCallback(
    (attempt: Omit<PaymentAttempt, 'time'>) => {
      setPaymentAttempts(prev =>
        [{ ...attempt, time: new Date().toISOString() }, ...prev].slice(0, 50)
      )
    },
    []
  )

  const clearPaymentAttempts = useCallback(() => {
    setPaymentAttempts([])
  }, [])

  const normalizePaymentError = useCallback((err: unknown): string => {
    try {
      if (!err) return 'Error desconocido'
      const e = err as any
      const msg =
        typeof err === 'string'
          ? err
          : e.message || e.error_description || e.details || e.hint || 'Error desconocido'
      const lower = (msg || '').toLowerCase()
      if (lower.includes('network') || lower.includes('fetch'))
        return 'Error de red: verifique la conexión.'
      if (lower.includes('permission') || lower.includes('auth') || lower.includes('jwt'))
        return 'Permisos insuficientes o sesión inválida.'
      if (lower.includes('duplicate key') || lower.includes('unique constraint'))
        return 'Registro duplicado.'
      if (lower.includes('timeout')) return 'Tiempo de espera agotado.'
      if (lower.includes('not null')) return 'Faltan datos requeridos.'
      return msg
    } catch {
      return 'Error desconocido'
    }
  }, [])

  // ── processSale ──────────────────────────────────────────────────────────
  const processSale = useCallback(
    async (deps: SaleProcessorDependencies) => {
      const run = async () => {
        const {
          isRegisterOpen,
          currentSessionId,
          combinedCartItems,
          cartCalculations,
          isWholesale,
          generalDiscount,
          paymentMethod,
          cashReceived,
          cardNumber,
          transferReference,
          electronicProvider,
          electronicInstitution,
          electronicChannel,
          terminalId,
          notes,
          creditTerms,
          storeCreditApplied,
          selectedRepairIds,
          markRepairDelivered,
          deliveryOutcome,
          selectedCustomer,
          customers,
          cashierName,
          setPaymentStatus,
          setPaymentError,
          processInventorySale,
          onSuccess,
          onAfterSale,
          formatCurrency,
        } = deps

        const amountDue = Math.max(0, cartCalculations.total - storeCreditApplied)

        if (!isRegisterOpen) {
          toast.error('La caja está cerrada. No se pueden procesar ventas.')
          return
        }
        if (!currentSessionId) {
          toast.error('No se pudo identificar la sesión de caja abierta.')
          return
        }
        if (combinedCartItems.length === 0) {
          const msg = 'El carrito está vacío'
          toast.error(msg)
          setPaymentStatus('failed')
          setPaymentError(msg)
          addPaymentAttempt({ status: 'failed', method: 'single', amount: cartCalculations.total, message: msg })
          return
        }
        if (!paymentMethod) {
          const msg = 'Seleccione un método de pago'
          toast.error(msg)
          setPaymentStatus('failed')
          setPaymentError(msg)
          addPaymentAttempt({ status: 'failed', method: 'single', amount: cartCalculations.total, message: msg })
          return
        }
        if (paymentMethod === 'cash' && cashReceived < amountDue) {
          const msg = 'Efectivo insuficiente'
          toast.error(msg)
          setPaymentStatus('failed')
          setPaymentError(msg)
          addPaymentAttempt({ status: 'failed', method: 'single', amount: cartCalculations.total, message: msg })
          return
        }

        const customer = selectedCustomer ? customers.find(c => c.id === selectedCustomer) : undefined
        const creditSummary =
          paymentMethod === 'credit' ? buildPosCreditSummary(amountDue, creditTerms) : null
        const firstPaymentValidation = creditSummary ? firstPaymentError(creditTerms.firstPayment, creditSummary.installmentAmount, creditSummary.firstInstallmentTiming) : null
        if (firstPaymentValidation) {
          setPaymentError(firstPaymentValidation)
          setPaymentStatus('failed')
          return
        }
        const receiptPaymentAmount = creditSummary?.financedTotal ?? amountDue

        const receiptCalculations = {
          subtotal: cartCalculations.subtotal,
          totalDiscount: cartCalculations.totalDiscount,
          tax: cartCalculations.tax,
          repairCost: cartCalculations.repairCost,
          total: creditSummary
            ? storeCreditApplied + creditSummary.financedTotal
            : cartCalculations.total,
          change: cartCalculations.change,
          creditInfo: creditSummary
            ? { ...creditSummary, interestRate: creditTerms.interestRate }
            : undefined,
        }

        const payments = [
          ...(storeCreditApplied > 0
            ? [{ id: 'store-credit', method: 'store_credit' as const, amount: storeCreditApplied }]
            : []),
          ...(receiptPaymentAmount > 0
            ? [
                {
                  id: '1',
                  method: paymentMethod as 'cash' | 'card' | 'transfer' | 'credit',
                  amount: receiptPaymentAmount,
                  reference: paymentMethod === 'transfer' ? transferReference : undefined,
                  cardLast4:
                    paymentMethod === 'card' && cardNumber ? cardNumber.slice(-4) : undefined,
                },
              ]
            : []),
        ]

        const receiptData = createReceiptData(
          combinedCartItems,
          receiptCalculations,
          payments,
          customer,
          cashierName
        )

        setPaymentStatus('processing')
        setPaymentError('')
        addPaymentAttempt({
          status: 'processing',
          method: 'single',
          amount: cartCalculations.total,
          message: 'Procesando pago simple',
        })

        try {
          const productItems = combinedCartItems.filter(item => !item.isService)
          const saleResult = await processInventorySale({
            items: productItems.map(item => ({
              id: item.id,
              name: item.name,
              sku: item.sku,
              price: item.price,
              quantity: item.quantity,
              stock: item.stock,
              discount_amount: item.discount
                ? item.price * item.quantity * (item.discount / 100)
                : 0,
              subtotal: item.price * item.quantity,
            })),
            total: cartCalculations.total,
            payment_method: paymentMethod as 'cash' | 'card' | 'transfer' | 'credit',
            payments:
              amountDue > 0
                ? [
                    {
                      payment_method: paymentMethod as 'cash' | 'card' | 'transfer' | 'credit',
                      amount: amountDue,
                      reference: paymentMethod === 'transfer' ? transferReference : undefined,
                      card_last4:
                        paymentMethod === 'card' && cardNumber ? cardNumber.slice(-4) : undefined,
                      provider:
                        paymentMethod === 'card' || paymentMethod === 'transfer'
                          ? electronicProvider || undefined
                          : undefined,
                      institution:
                        paymentMethod === 'card' || paymentMethod === 'transfer'
                          ? electronicInstitution || undefined
                          : undefined,
                      channel:
                        paymentMethod === 'card'
                          ? 'card_terminal'
                          : paymentMethod === 'transfer'
                          ? electronicChannel
                          : undefined,
                      terminal_id: paymentMethod === 'card' ? terminalId || undefined : undefined,
                    },
                  ]
                : [],
            session_id: currentSessionId,
            price_mode: isWholesale ? 'wholesale' : 'retail',
            order_discount_rate: generalDiscount,
            customer_id: selectedCustomer || undefined,
            notes: notes || undefined,
            credit:
              paymentMethod === 'credit'
                ? {
                    interest_rate: creditTerms.interestRate,
                    installment_count: creditTerms.count,
                    frequency: creditTerms.frequency,
                    first_installment_timing: creditSummary?.firstInstallmentTiming,
                    start_date: creditSummary?.startDate,
                    first_payment: creditTerms.firstPayment,
                  }
                : undefined,
            repair_ids: selectedRepairIds,
            mark_repairs_delivered: markRepairDelivered,
            delivery_outcome: deliveryOutcome,
            store_credit_amount: storeCreditApplied,
          })

          if (
            saleResult &&
            typeof saleResult === 'object' &&
            'success' in saleResult &&
            saleResult.success === false
          ) {
            throw new Error(
              String((saleResult as { error?: unknown }).error || 'No se pudo procesar la venta')
            )
          }

          const persistedReceipt = {
            ...receiptData,
            creditInfo: receiptData.creditInfo ? withPersistedCreditSchedule(receiptData.creditInfo, saleResult?.data?.creditSchedule) : undefined,
            receiptNumber: saleResult?.saleId
              ? `POS-${String(saleResult.saleId).slice(0, 8).toUpperCase()}`
              : receiptData.receiptNumber,
            tax: Number.isFinite(Number(saleResult?.data?.tax))
              ? Number(saleResult.data.tax)
              : receiptData.tax,
            totalDiscount: Number.isFinite(Number(saleResult?.data?.discount))
              ? Number(saleResult.data.discount)
              : receiptData.totalDiscount,
          }

          setPaymentStatus('success')
          toast.success(
            `¡Venta completada! Comprobante #${persistedReceipt.receiptNumber || 'POS'} generado (${formatCurrency(receiptCalculations.total)})`,
            { duration: 4500 }
          )
          addPaymentAttempt({
            status: 'success',
            method: 'single',
            amount: cartCalculations.total,
            message: 'Pago exitoso',
          })

          onSuccess(persistedReceipt)
          setTimeout(() => {
            onAfterSale()
            setPaymentStatus('idle')
          }, 600)
        } catch (error) {
          const msg = normalizePaymentError(error)
          setPaymentStatus('failed')
          setPaymentError(msg)
          toast.error(msg, { duration: 6000 })
          addPaymentAttempt({
            status: 'failed',
            method: 'single',
            amount: cartCalculations.total,
            message: msg,
          })
        }
      }

      if (deps.measureSaleProcessing) {
        return deps.measureSaleProcessing(run)
      }
      return run()
    },
    [addPaymentAttempt, normalizePaymentError]
  )

  // ── processMixedPayment ──────────────────────────────────────────────────
  const processMixedPayment = useCallback(
    async (deps: SaleProcessorDependencies) => {
      const {
        isRegisterOpen,
        currentSessionId,
        combinedCartItems,
        cartCalculations,
        isWholesale,
        generalDiscount,
        notes,
        creditTerms,
        paymentSplit,
        storeCreditApplied,
        selectedRepairIds,
        markRepairDelivered,
        deliveryOutcome,
        selectedCustomer,
        customers,
        cashierName,
        setPaymentStatus,
        setPaymentError,
        processInventorySale,
        onSuccess,
        onAfterSale,
        formatCurrency,
      } = deps

      const amountDue = Math.max(0, cartCalculations.total - storeCreditApplied)

      if (!isRegisterOpen) {
        toast.error('La caja está cerrada. No se pueden procesar ventas.')
        return
      }
      if (!currentSessionId) {
        toast.error('No se pudo identificar la sesión de caja abierta.')
        return
      }

      const validation = getMixedPaymentValidation(amountDue, paymentSplit as any)
      if (!validation.valid) {
        const errorMessages: Record<string, string> = {
          PAYMENT_INCOMPLETE: `Faltan ${formatCurrency(validation.remaining)} para completar el pago`,
          PAYMENT_EXCESS: `Exceso de pago: ${formatCurrency(Math.abs(validation.remaining))}`,
          CARD_REFERENCE_REQUIRED: 'Ingrese los últimos 4 dígitos de cada tarjeta',
          TRANSFER_REFERENCE_REQUIRED: 'Ingrese la referencia de cada transferencia',
          PAYMENT_LIMIT_EXCEEDED: 'Solo se permiten hasta 10 formas de pago por venta',
          PAYMENTS_REQUIRED: 'Agregue al menos una forma de pago',
        }
        const msg = errorMessages[validation.code ?? ''] ?? 'Cada pago debe tener un monto positivo'
        toast.error(msg)
        setPaymentStatus('failed')
        setPaymentError(msg)
        addPaymentAttempt({ status: 'failed', method: 'mixed', amount: cartCalculations.total, message: msg })
        return
      }

      const customer = selectedCustomer ? customers.find(c => c.id === selectedCustomer) : undefined
      const creditPrincipal = paymentSplit
        .filter(s => s.method === 'credit')
        .reduce((t, s) => t + s.amount, 0)
      const mixedCreditSummary =
        creditPrincipal > 0 ? buildPosCreditSummary(creditPrincipal, creditTerms) : null
      const firstPaymentValidation = mixedCreditSummary ? firstPaymentError(creditTerms.firstPayment, mixedCreditSummary.installmentAmount, mixedCreditSummary.firstInstallmentTiming) : null
      if (firstPaymentValidation) {
        setPaymentError(firstPaymentValidation)
        setPaymentStatus('failed')
        return
      }

      const receiptPayments = [
        ...(storeCreditApplied > 0
          ? [{ id: 'store-credit', method: 'store_credit' as const, amount: storeCreditApplied }]
          : []),
        ...paymentSplit,
      ]

      const receiptData = createReceiptData(
        combinedCartItems,
        mixedCreditSummary
          ? {
              ...cartCalculations,
              creditInfo: { ...mixedCreditSummary, interestRate: creditTerms.interestRate },
            }
          : cartCalculations,
        receiptPayments as any,
        customer,
        cashierName
      )

      setPaymentStatus('processing')
      setPaymentError('')
      addPaymentAttempt({
        status: 'processing',
        method: 'mixed',
        amount: cartCalculations.total,
        message: 'Procesando pago mixto',
      })

      try {
        const productItems = combinedCartItems.filter(item => !item.isService)
        const saleResult = await processInventorySale({
          items: productItems.map(item => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            price: item.price,
            quantity: item.quantity,
            stock: item.stock,
            discount_amount: item.discount
              ? item.price * item.quantity * (item.discount / 100)
              : 0,
            subtotal: item.price * item.quantity,
          })),
          total: cartCalculations.total,
          payment_method: (paymentSplit[0]?.method || 'cash') as
            | 'cash'
            | 'card'
            | 'transfer'
            | 'credit',
          payments: paymentSplit.map(split => ({
            payment_method: split.method,
            amount: split.amount,
            reference: split.reference,
            card_last4: split.cardLast4,
            provider: split.provider,
            institution: split.institution,
            channel: split.channel,
            terminal_id: split.terminalId,
          })),
          session_id: currentSessionId,
          price_mode: isWholesale ? 'wholesale' : 'retail',
          order_discount_rate: generalDiscount,
          customer_id: selectedCustomer || undefined,
          notes: notes || undefined,
          credit: paymentSplit.some(s => s.method === 'credit')
            ? {
                interest_rate: creditTerms.interestRate,
                installment_count: creditTerms.count,
                frequency: creditTerms.frequency,
                first_installment_timing: mixedCreditSummary?.firstInstallmentTiming,
                start_date: mixedCreditSummary?.startDate,
                first_payment: creditTerms.firstPayment,
              }
            : undefined,
          repair_ids: selectedRepairIds,
          mark_repairs_delivered: markRepairDelivered,
          delivery_outcome: deliveryOutcome,
          store_credit_amount: storeCreditApplied,
        })

        if (
          saleResult &&
          typeof saleResult === 'object' &&
          'success' in saleResult &&
          saleResult.success === false
        ) {
          throw new Error(
            String((saleResult as { error?: unknown }).error || 'No se pudo procesar la venta')
          )
        }

        const persistedReceipt = {
          ...receiptData,
          creditInfo: receiptData.creditInfo ? withPersistedCreditSchedule(receiptData.creditInfo, saleResult?.data?.creditSchedule) : undefined,
          receiptNumber: saleResult?.saleId
            ? `POS-${String(saleResult.saleId).slice(0, 8).toUpperCase()}`
            : receiptData.receiptNumber,
          tax: Number.isFinite(Number(saleResult?.data?.tax))
            ? Number(saleResult.data.tax)
            : receiptData.tax,
          totalDiscount: Number.isFinite(Number(saleResult?.data?.discount))
            ? Number(saleResult.data.discount)
            : receiptData.totalDiscount,
        }

        setPaymentStatus('success')
        toast.success(
          `¡Venta completada! Comprobante #${persistedReceipt.receiptNumber || 'POS'} generado (${formatCurrency(cartCalculations.total)})`,
          { duration: 4500 }
        )
        addPaymentAttempt({
          status: 'success',
          method: 'mixed',
          amount: cartCalculations.total,
          message: 'Pago exitoso',
        })

        onSuccess(persistedReceipt)
        setTimeout(() => {
          onAfterSale()
          setPaymentStatus('idle')
        }, 600)
      } catch (error) {
        const msg = normalizePaymentError(error)
        setPaymentStatus('failed')
        setPaymentError(msg)
        toast.error(msg, { duration: 6000 })
        addPaymentAttempt({
          status: 'failed',
          method: 'mixed',
          amount: cartCalculations.total,
          message: msg,
        })
      }
    },
    [addPaymentAttempt, normalizePaymentError]
  )

  return {
    paymentAttempts,
    addPaymentAttempt,
    clearPaymentAttempts,
    normalizePaymentError,
    processSale,
    processMixedPayment,
  }
}
