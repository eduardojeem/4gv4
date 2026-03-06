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
        const validationErrors = 'errors' in validation ? validation.errors : ['Datos de venta inválidos']
        throw new Error(validationErrors.join(', '))
      }

      // Validar reglas de negocio
      const businessValidation = validateSaleBusinessRules(validation.data)
      if (!businessValidation.valid) {
        const businessErrors = 'errors' in businessValidation ? businessValidation.errors : ['Reglas de negocio inválidas']
        throw new Error(businessErrors.join(', '))
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
      POSErrorHandler.handle(error, 'sale', { cart, total })
      const errorMessage = error instanceof Error ? error.message : 'Error al procesar la venta'
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

async function persistSaleToSupabase(
  cart: CartItem[],
  paymentMethod: string,
  discount: number,
  tax: number,
  total: number,
  selectedCustomer?: string,
  repairIds: string[] = [],
  markRepairDelivered: boolean = false,
  finalCostFromSale: boolean = false
): Promise<string> {
  const supabase = createClient()

  const salePayload: Record<string, unknown> = {
    customer_id: selectedCustomer || null,
    payment_method: paymentMethod,
    discount_amount: discount || 0,
    tax_amount: tax || 0,
    total_amount: total || 0,
    subtotal_amount: Math.max(0, (total || 0) - (tax || 0)),
    notes: null
  }

  const { data: saleRow, error: saleError } = await supabase
    .from('sales')
    .insert(salePayload)
    .select('id')
    .single()

  if (saleError || !saleRow?.id) {
    throw new Error(saleError?.message || 'No se pudo crear la venta')
  }

  if (cart.length > 0) {
    const itemsPayload = cart.map((item) => ({
      sale_id: saleRow.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.subtotal ?? item.price * item.quantity,
      discount: item.discount || 0
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(itemsPayload)
    if (itemsError) {
      throw new Error(itemsError.message || 'No se pudieron guardar los ítems de la venta')
    }
  }

  if (repairIds.length > 0 && markRepairDelivered) {
    const status = 'entregado'
    const updatePayload: Record<string, unknown> = {
      status,
      delivered_at: new Date().toISOString()
    }
    if (finalCostFromSale) {
      updatePayload.final_cost = total
    }
    const { error: repairsError } = await supabase
      .from('repairs')
      .update(updatePayload)
      .in('id', repairIds)
    if (repairsError) {
      throw new Error(repairsError.message || 'No se pudieron actualizar las reparaciones')
    }
  }

  return saleRow.id
}
