/**
 * Payment Processor
 * Manejo de diferentes métodos de pago
 */

import { formatCurrency } from '@/lib/currency'

export interface PaymentMethod {
    id: string
    name: string
    type: 'cash' | 'card' | 'transfer' | 'credit'
    enabled: boolean
    requiresReference: boolean
    icon?: string
}

export interface PaymentValidation {
    valid: boolean
    errors: string[]
}

export const PAYMENT_METHODS: PaymentMethod[] = [
    {
        id: 'cash',
        name: 'Efectivo',
        type: 'cash',
        enabled: true,
        requiresReference: false,
        icon: '💵'
    },
    {
        id: 'card',
        name: 'Tarjeta',
        type: 'card',
        enabled: true,
        requiresReference: true,
        icon: '💳'
    },
    {
        id: 'transfer',
        name: 'Transferencia',
        type: 'transfer',
        enabled: true,
        requiresReference: true,
        icon: '🏦'
    },
    {
        id: 'credit',
        name: 'Crédito',
        type: 'credit',
        enabled: true,
        requiresReference: false,
        icon: '📝'
    }
]

/**
 * Validate cash payment
 */
export function validateCashPayment(amount: number, total: number): PaymentValidation {
    const errors: string[] = []

    if (amount <= 0) {
        errors.push('El monto debe ser mayor a cero')
    }

    if (amount < total) {
        errors.push('El monto es insuficiente')
    }

    return {
        valid: errors.length === 0,
        errors
    }
}

/**
 * Validate card payment
 */
export function validateCardPayment(
    amount: number,
    total: number,
    reference?: string
): PaymentValidation {
    const errors: string[] = []

    if (amount <= 0) {
        errors.push('El monto debe ser mayor a cero')
    }

    if (amount !== total) {
        errors.push('El monto debe ser exactamente igual al total')
    }

    if (!reference || reference.trim().length === 0) {
        errors.push('Se requiere número de autorización')
    }

    if (reference && reference.length < 4) {
        errors.push('Número de autorización inválido')
    }

    return {
        valid: errors.length === 0,
        errors
    }
}

/**
 * Validate transfer payment
 */
export function validateTransferPayment(
    amount: number,
    total: number,
    reference?: string
): PaymentValidation {
    const errors: string[] = []

    if (amount <= 0) {
        errors.push('El monto debe ser mayor a cero')
    }

    if (amount !== total) {
        errors.push('El monto debe ser exactamente igual al total')
    }

    if (!reference || reference.trim().length === 0) {
        errors.push('Se requiere número de referencia')
    }

    return {
        valid: errors.length === 0,
        errors
    }
}

/**
 * Validate credit payment
 */
export function validateCreditPayment(amount: number, total: number): PaymentValidation {
    const errors: string[] = []

    if (amount <= 0) {
        errors.push('El monto debe ser mayor a cero')
    }

    if (amount !== total) {
        errors.push('El monto debe ser exactamente igual al total')
    }

    return {
        valid: errors.length === 0,
        errors
    }
}

/**
 * Validate payment based on method
 */
export function validatePayment(
    method: PaymentMethod,
    amount: number,
    total: number,
    reference?: string
): PaymentValidation {
    switch (method.type) {
        case 'cash':
            return validateCashPayment(amount, total)
        case 'card':
            return validateCardPayment(amount, total, reference)
        case 'transfer':
            return validateTransferPayment(amount, total, reference)
        case 'credit':
            return validateCreditPayment(amount, total)
        default:
            return { valid: false, errors: ['Método de pago no reconocido'] }
    }
}

/**
 * Process cash payment
 */
export async function processCashPayment(amount: number, total: number): Promise<{
    success: boolean
    change: number
    error?: string
}> {
    const validation = validateCashPayment(amount, total)

    if (!validation.valid) {
        return {
            success: false,
            change: 0,
            error: validation.errors.join(', ')
        }
    }

    const change = Math.max(0, amount - total)

    return {
        success: true,
        change
    }
}

/**
 * Process card payment
 */
export async function processCardPayment(
    amount: number,
    total: number,
    cardLast4: string,
    authCode: string
): Promise<{
    success: boolean
    reference: string
    error?: string
}> {
    const validation = validateCardPayment(amount, total, authCode)

    if (!validation.valid) {
        return {
            success: false,
            reference: '',
            error: validation.errors.join(', ')
        }
    }

    // Simulate card processing
    // In production, this would integrate with a payment gateway

    return {
        success: true,
        reference: authCode
    }
}

/**
 * Process transfer payment
 */
export async function processTransferPayment(
    amount: number,
    total: number,
    reference: string
): Promise<{
    success: boolean
    reference: string
    error?: string
}> {
    const validation = validateTransferPayment(amount, total, reference)

    if (!validation.valid) {
        return {
            success: false,
            reference: '',
            error: validation.errors.join(', ')
        }
    }

    return {
        success: true,
        reference
    }
}

/**
 * Validate split payment
 */
export function validateSplitPayment(payments: Array<{ amount: number }>, total: number): PaymentValidation {
    const errors: string[] = []
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

    if (payments.length === 0) {
        errors.push('Debe agregar al menos un pago')
    }

    if (totalPaid < total) {
        errors.push(`Faltan ${formatCurrency(total - totalPaid)} por pagar`)
    }

    if (payments.some(p => p.amount <= 0)) {
        errors.push('Todos los montos deben ser mayores a cero')
    }

    return {
        valid: errors.length === 0,
        errors
    }
}


/**
 * Get payment method by ID
 */
export function getPaymentMethod(id: string): PaymentMethod | null {
    return PAYMENT_METHODS.find(m => m.id === id) || null
}

/**
 * Get enabled payment methods
 */
export function getEnabledPaymentMethods(): PaymentMethod[] {
    return PAYMENT_METHODS.filter(m => m.enabled)
}
