/**
 * Hook para procesar ventas en el POS
 * Centraliza toda la lógica de procesamiento de ventas
 */

import { useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useCashRegisterContext } from '../contexts/CashRegisterContext'
import { useCheckout } from '../contexts/CheckoutContext'
import { usePOSCustomer } from '../contexts/POSCustomerContext'
import { POSErrorHandler } from '../lib/error-handler'
import { validateSale, validateSaleBusinessRules } from '../lib/validation'
import type { CartItem } from '../types'

export interface SaleProcessorOptions {
  onSuccess?: (saleId: string) => void
  onError?: (error: unknown) => void
}

export function useSaleProcessor(options: SaleProcessorOptions = {}) {
  const { registerSale, getCurrentRegister } = useCashRegisterContext()
  const { selectedCustomer } = usePOSCustomer()
  const {
    paymentMethod,
    cashReceived,
    cardNumber,
    transferReference,
    notes,
    discount,
    paymentSplit,
    setPaymentStatus,
    setPaymentError
  } = useCheckout()

  const processSale = useCallback(async (
    cart: CartItem[],
    total: number,
    tax: number,
    subtotal: number,
    repairIds: string[] = [],
    markRepairDelivered: boolean = false,
    finalCostFromSale: boolean = false
  ) => {
    setPaymentStatus('processing')
    setPaymentError('')

    try {
      // Validar que la caja esté abierta
      if (!getCurrentRegister.isOpen) {
        throw new Error('La caja debe estar abierta para procesar ventas')
      }

      // Preparar datos de venta
      const saleData = {
        items: cart,
        paymentMethod,
        customerId: selectedCustomer,
        discount,
        notes,
        cashReceived,
        cardNumber,
        transferReference,
        paymentSplit: paymentMethod === 'mixed' ? paymentSplit : undefined,
        repairIds
      }

      // Validar datos
      const validation = validateSale(saleData)
      if (!validation.success) {
        throw new Error(validation.errors.join(', '))
      }

      // Validar reglas de negocio
      const businessValidation = validateSaleBusinessRules(validation.data)
      if (!businessValidation.valid) {
        throw new Error(businessValidation.errors.join(', '))
      }

      // Procesar en Supabase
      const saleId = await persistSaleToSupabase(
        cart,
        paymentMethod,
        discount,
        tax,
        total,
        selectedCustomer,
        repairIds,
        markRepairDelivered,
        finalCostFromSale
      )

      // Registrar en caja
      await registerSale(saleId, total, paymentMethod)

      setPaymentStatus('success')
      toast.success('Venta procesada exitosamente')
      
      options.onSuccess?.(saleId)
      
      return saleId
    } catch (error) {
      setPaymentStatus('failed')
      const errorMessage = POSErrorHandler.handle(error, 'sale', { cart, total })
      setPaymentError(errorMessage)
      options.onError?.(error)
      throw error
    }
  }, [
    paymentMethod,
    cashReceived,
    cardNumber,
    transferReference,
    notes,
    discount,
    paymentSplit,
    selectedCustomer,
    getCurrentRegister,
    registerSale,
    setPaymentStatus,
    setPaymentError,
    options
  ])

  return { processSale }
}
