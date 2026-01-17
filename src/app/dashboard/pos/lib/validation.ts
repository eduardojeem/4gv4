/**
 * Esquemas de validación para el POS usando Zod
 * Proporciona validación type-safe para todas las operaciones críticas
 */

import { z } from 'zod'

// Esquema para items del carrito
export const cartItemSchema = z.object({
  id: z.string().min(1, 'ID de producto requerido'),
  name: z.string().min(1, 'Nombre de producto requerido'),
  sku: z.string().min(1, 'SKU requerido'),
  price: z.number().positive('El precio debe ser positivo'),
  quantity: z.number().int().positive('La cantidad debe ser un número positivo'),
  stock: z.number().int().nonnegative('El stock no puede ser negativo'),
  subtotal: z.number().nonnegative('El subtotal no puede ser negativo'),
  discount: z.number().min(0).max(100).optional(),
  wholesalePrice: z.number().positive().optional(),
  isService: z.boolean().optional(),
  promoCode: z.string().optional(),
  category: z.string().optional(),
  image: z.string().url().optional().or(z.literal(''))
})

export type ValidatedCartItem = z.infer<typeof cartItemSchema>

// Esquema para métodos de pago
export const paymentMethodSchema = z.enum(['cash', 'card', 'transfer', 'credit', 'mixed'], {
  errorMap: () => ({ message: 'Método de pago inválido' })
})

// Esquema para split de pagos
export const paymentSplitSchema = z.object({
  id: z.string().uuid('ID de split inválido'),
  method: paymentMethodSchema,
  amount: z.number().positive('El monto debe ser positivo'),
  reference: z.string().optional(),
  cardLast4: z.string().length(4).optional()
})

export type ValidatedPaymentSplit = z.infer<typeof paymentSplitSchema>

// Esquema para venta completa
export const saleSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'Debe haber al menos un item en la venta'),
  paymentMethod: paymentMethodSchema,
  customerId: z.string().uuid().optional().or(z.literal('')),
  discount: z.number().min(0).max(100, 'El descuento debe estar entre 0 y 100'),
  notes: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional(),
  cashReceived: z.number().nonnegative().optional(),
  cardNumber: z.string().optional(),
  transferReference: z.string().optional(),
  paymentSplit: z.array(paymentSplitSchema).optional(),
  repairIds: z.array(z.string().uuid()).optional()
})

export type ValidatedSale = z.infer<typeof saleSchema>

// Esquema para movimientos de caja
export const cashMovementSchema = z.object({
  type: z.enum(['opening', 'sale', 'in', 'cash_in', 'out', 'cash_out', 'closing']),
  amount: z.number().positive('El monto debe ser positivo'),
  note: z.string().max(200, 'La nota no puede exceder 200 caracteres').optional(),
  reason: z.string().max(200, 'La razón no puede exceder 200 caracteres').optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'mixed']).optional()
})

export type ValidatedCashMovement = z.infer<typeof cashMovementSchema>

// Esquema para apertura de caja
export const registerOpeningSchema = z.object({
  registerId: z.string().min(1, 'ID de caja requerido'),
  initialAmount: z.number().nonnegative('El monto inicial no puede ser negativo'),
  note: z.string().max(200).optional(),
  userId: z.string().optional()
})

export type ValidatedRegisterOpening = z.infer<typeof registerOpeningSchema>

// Esquema para cierre de caja
export const registerClosingSchema = z.object({
  registerId: z.string().min(1, 'ID de caja requerido'),
  closingBalance: z.number().nonnegative('El balance de cierre no puede ser negativo'),
  note: z.string().max(200).optional(),
  userId: z.string().optional()
})

export type ValidatedRegisterClosing = z.infer<typeof registerClosingSchema>

// Esquema para cliente
export const customerSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido').max(50),
  lastName: z.string().max(50).optional(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Formato de teléfono inválido').optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  type: z.enum(['regular', 'vip', 'wholesale']).default('regular')
}).refine(
  data => data.firstName.trim().length > 0 || (data.phone && data.phone.trim().length > 0),
  { message: 'Debe proporcionar al menos nombre o teléfono' }
)

export type ValidatedCustomer = z.infer<typeof customerSchema>

// Esquema para descuento
export const discountSchema = z.object({
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive('El valor del descuento debe ser positivo'),
  code: z.string().optional()
}).refine(
  data => data.type !== 'percentage' || data.value <= 100,
  { message: 'El descuento porcentual no puede exceder 100%' }
)

export type ValidatedDiscount = z.infer<typeof discountSchema>

// Funciones de validación con mensajes de error amigables
export function validateSale(data: unknown): { success: true; data: ValidatedSale } | { success: false; errors: string[] } {
  const result = saleSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.errors.map(err => {
    const path = err.path.join('.')
    return path ? `${path}: ${err.message}` : err.message
  })
  
  return { success: false, errors }
}

export function validateCartItem(data: unknown): { success: true; data: ValidatedCartItem } | { success: false; errors: string[] } {
  const result = cartItemSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.errors.map(err => err.message)
  return { success: false, errors }
}

export function validateCustomer(data: unknown): { success: true; data: ValidatedCustomer } | { success: false; errors: string[] } {
  const result = customerSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.errors.map(err => err.message)
  return { success: false, errors }
}

export function validateCashMovement(data: unknown): { success: true; data: ValidatedCashMovement } | { success: false; errors: string[] } {
  const result = cashMovementSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.errors.map(err => err.message)
  return { success: false, errors }
}

export function validateRegisterOpening(data: unknown): { success: true; data: ValidatedRegisterOpening } | { success: false; errors: string[] } {
  const result = registerOpeningSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.errors.map(err => err.message)
  return { success: false, errors }
}

export function validateRegisterClosing(data: unknown): { success: true; data: ValidatedRegisterClosing } | { success: false; errors: string[] } {
  const result = registerClosingSchema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const errors = result.error.errors.map(err => err.message)
  return { success: false, errors }
}

// Validaciones de negocio adicionales
export function validateSaleBusinessRules(sale: ValidatedSale): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = []
  
  // Validar que el efectivo recibido sea suficiente
  if (sale.paymentMethod === 'cash' && sale.cashReceived !== undefined) {
    const total = sale.items.reduce((sum, item) => sum + item.subtotal, 0)
    if (sale.cashReceived < total) {
      errors.push('El efectivo recibido es insuficiente')
    }
  }
  
  // Validar que los items tengan stock suficiente
  for (const item of sale.items) {
    if (!item.isService && item.quantity > item.stock) {
      errors.push(`Stock insuficiente para ${item.name} (disponible: ${item.stock}, solicitado: ${item.quantity})`)
    }
  }
  
  // Validar pago mixto
  if (sale.paymentMethod === 'mixed') {
    if (!sale.paymentSplit || sale.paymentSplit.length === 0) {
      errors.push('El pago mixto requiere al menos un método de pago')
    } else {
      const total = sale.items.reduce((sum, item) => sum + item.subtotal, 0)
      const splitTotal = sale.paymentSplit.reduce((sum, split) => sum + split.amount, 0)
      if (Math.abs(splitTotal - total) > 0.01) {
        errors.push(`El total de los pagos (${splitTotal}) no coincide con el total de la venta (${total})`)
      }
    }
  }
  
  // Validar referencia para transferencia
  if (sale.paymentMethod === 'transfer' && !sale.transferReference) {
    errors.push('La transferencia requiere una referencia')
  }
  
  // Validar tarjeta
  if (sale.paymentMethod === 'card' && (!sale.cardNumber || sale.cardNumber.length < 4)) {
    errors.push('Se requieren al menos los últimos 4 dígitos de la tarjeta')
  }
  
  return errors.length > 0 ? { valid: false, errors } : { valid: true }
}
