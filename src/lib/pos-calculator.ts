/**
 * POS Calculator Utilities
 * Funciones para cálculos de impuestos, descuentos y totales
 */

import { formatCurrency as formatCurrencyCentral } from './currency'
import { Repair } from '@/types/repairs'

export interface CalculationInput {
    subtotal: number
    taxRate?: number
    discountPercentage?: number
    discountAmount?: number
}

export interface CalculationResult {
    subtotal: number
    taxAmount: number
    discountAmount: number
    total: number
}

// Nuevos tipos para reparaciones
export interface RepairCalculationInput {
    laborCost: number
    partsCost: number
    taxRate?: number
    discountPercentage?: number
    discountAmount?: number
    pricesIncludeTax?: boolean // Nueva opción para IVA incluido
}

export interface RepairCalculationResult {
    laborCost: number
    partsCost: number
    subtotal: number
    taxAmount: number
    discountAmount: number
    total: number
    breakdown: {
        laborTax: number
        partsTax: number
        laborSubtotal: number // Subtotal sin IVA de mano de obra
        partsSubtotal: number // Subtotal sin IVA de repuestos
    }
}

export interface CartRepairItem {
    id: string
    type: 'repair'
    repair: Repair
    laborCost: number
    partsCost: number
    subtotal: number
    taxAmount: number
    total: number
    taxRate: number
}

/**
 * Calcular impuestos
 */
export function calculateTax(amount: number, taxRate: number): number {
    return Math.round((amount * (taxRate / 100)) * 100) / 100
}

/**
 * Calcular descuento por porcentaje
 */
export function calculateDiscountByPercentage(amount: number, percentage: number): number {
    return Math.round((amount * (percentage / 100)) * 100) / 100
}

/**
 * Calcular total con impuestos y descuentos
 */
export function calculateTotal(input: CalculationInput): CalculationResult {
    const { subtotal, taxRate = 0, discountPercentage, discountAmount } = input

    // Calcular descuento
    let discount = 0
    if (discountAmount) {
        discount = discountAmount
    } else if (discountPercentage) {
        discount = calculateDiscountByPercentage(subtotal, discountPercentage)
    }

    // Calcular subtotal después del descuento
    const subtotalAfterDiscount = Math.max(0, subtotal - discount)

    // Calcular impuestos sobre el subtotal con descuento
    const tax = calculateTax(subtotalAfterDiscount, taxRate)

    // Total final
    const total = subtotalAfterDiscount + tax

    return {
        subtotal,
        taxAmount: tax,
        discountAmount: discount,
        total: Math.round(total * 100) / 100
    }
}

/**
 * Calcular IVA desde precio con IVA incluido
 */
export function calculateTaxFromInclusivePrice(inclusivePrice: number, taxRate: number): {
    subtotal: number
    taxAmount: number
} {
    // Fórmula: subtotal = precio_con_iva / (1 + tasa_iva/100)
    const subtotal = Math.round((inclusivePrice / (1 + taxRate / 100)) * 100) / 100
    const taxAmount = Math.round((inclusivePrice - subtotal) * 100) / 100
    
    return {
        subtotal,
        taxAmount
    }
}

/**
 * Calcular total de reparación con IVA separado para mano de obra y repuestos
 * Ahora soporta precios con IVA incluido
 */
export function calculateRepairTotal(input: RepairCalculationInput): RepairCalculationResult {
    const { laborCost, partsCost, taxRate = 10, discountPercentage, discountAmount, pricesIncludeTax = true } = input

    let laborSubtotal: number
    let partsSubtotal: number
    let laborTax: number
    let partsTax: number

    if (pricesIncludeTax) {
        // Los precios YA incluyen IVA, necesitamos extraerlo
        const laborCalc = calculateTaxFromInclusivePrice(laborCost, taxRate)
        const partsCalc = calculateTaxFromInclusivePrice(partsCost, taxRate)
        
        laborSubtotal = laborCalc.subtotal
        partsSubtotal = partsCalc.subtotal
        laborTax = laborCalc.taxAmount
        partsTax = partsCalc.taxAmount
    } else {
        // Los precios NO incluyen IVA, calculamos como antes
        laborSubtotal = laborCost
        partsSubtotal = partsCost
        laborTax = calculateTax(laborCost, taxRate)
        partsTax = calculateTax(partsCost, taxRate)
    }

    const subtotalBeforeDiscount = laborSubtotal + partsSubtotal
    const totalTaxBeforeDiscount = laborTax + partsTax

    // Manejar caso de subtotal cero
    if (subtotalBeforeDiscount === 0) {
        return {
            laborCost,
            partsCost,
            subtotal: 0,
            taxAmount: 0,
            discountAmount: 0,
            total: 0,
            breakdown: {
                laborTax: 0,
                partsTax: 0,
                laborSubtotal: 0,
                partsSubtotal: 0
            }
        }
    }

    // Calcular descuento
    let discount = 0
    if (discountAmount) {
        discount = discountAmount
    } else if (discountPercentage) {
        // El descuento se aplica sobre el total con IVA incluido
        const totalWithTax = laborCost + partsCost
        discount = calculateDiscountByPercentage(totalWithTax, discountPercentage)
    }

    // Aplicar descuento proporcionalmente al subtotal y al IVA
    const totalBeforeDiscount = laborCost + partsCost
    const discountRatio = totalBeforeDiscount > 0 ? discount / totalBeforeDiscount : 0
    
    const finalLaborSubtotal = Math.max(0, laborSubtotal - (laborSubtotal * discountRatio))
    const finalPartsSubtotal = Math.max(0, partsSubtotal - (partsSubtotal * discountRatio))
    const finalLaborTax = Math.max(0, laborTax - (laborTax * discountRatio))
    const finalPartsTax = Math.max(0, partsTax - (partsTax * discountRatio))

    const finalSubtotal = finalLaborSubtotal + finalPartsSubtotal
    const finalTaxAmount = finalLaborTax + finalPartsTax
    const finalTotal = finalSubtotal + finalTaxAmount

    return {
        laborCost,
        partsCost,
        subtotal: Math.round(finalSubtotal * 100) / 100,
        taxAmount: Math.round(finalTaxAmount * 100) / 100,
        discountAmount: Math.round(discount * 100) / 100,
        total: Math.round(finalTotal * 100) / 100,
        breakdown: {
            laborTax: Math.round(finalLaborTax * 100) / 100,
            partsTax: Math.round(finalPartsTax * 100) / 100,
            laborSubtotal: Math.round(finalLaborSubtotal * 100) / 100,
            partsSubtotal: Math.round(finalPartsSubtotal * 100) / 100
        }
    }
}

/**
 * Crear item de carrito para reparación
 * Ahora soporta precios con IVA incluido por defecto
 */
export function createRepairCartItem(
    repair: Repair, 
    taxRate: number = 10,
    discountPercentage?: number,
    discountAmount?: number,
    pricesIncludeTax: boolean = true
): CartRepairItem {
    const laborCost = repair.laborCost || 0
    const partsCost = repair.parts.reduce((sum, part) => sum + (part.cost * part.quantity), 0)

    const calculation = calculateRepairTotal({
        laborCost,
        partsCost,
        taxRate,
        discountPercentage,
        discountAmount,
        pricesIncludeTax
    })

    return {
        id: `repair-${repair.id}`,
        type: 'repair',
        repair,
        laborCost: calculation.laborCost,
        partsCost: calculation.partsCost,
        subtotal: calculation.subtotal,
        taxAmount: calculation.taxAmount,
        total: calculation.total,
        taxRate
    }
}

/**
 * Calcular cambio
 */
export function calculateChange(total: number, amountPaid: number): number {
    return Math.max(0, Math.round((amountPaid - total) * 100) / 100)
}

/**
 * Aplicar redondeo (para efectivo)
 */
export function applyRounding(amount: number, roundTo: number = 10): number {
    return Math.round(amount / roundTo) * roundTo
}

/**
 * Formatear moneda
 */
export function formatCurrency(amount: number, currency: string = 'PYG'): string {
    return formatCurrencyCentral(amount)
}

/**
 * Calcular margen de ganancia
 */
export function calculateProfitMargin(cost: number, price: number): number {
    if (price === 0) return 0
    return Math.round(((price - cost) / price) * 100 * 100) / 100
}

/**
 * Calcular markup
 */
export function calculateMarkup(cost: number, price: number): number {
    if (cost === 0) return 0
    return Math.round(((price - cost) / cost) * 100 * 100) / 100
}

/**
 * Validar monto de pago
 */
export function validatePaymentAmount(amount: number, total: number): boolean {
    return amount >= total && amount > 0
}

/**
 * Dividir pagos (split payment)
 */
export function splitPayment(total: number, payments: number[]): { valid: boolean; remaining: number } {
    const totalPaid = payments.reduce((sum, p) => sum + p, 0)
    const remaining = total - totalPaid

    return {
        valid: remaining <= 0,
        remaining: Math.max(0, remaining)
    }
}

/**
 * Calcular propina sugerida
 */
export function calculateTip(subtotal: number, percentage: number): number {
    return calculateDiscountByPercentage(subtotal, percentage)
}

/**
 * Calcular promedio de ticket
 */
export function calculateAverageTicket(totalSales: number, numberOfTransactions: number): number {
    if (numberOfTransactions === 0) return 0
    return Math.round((totalSales / numberOfTransactions) * 100) / 100
}

/**
 * Formatear desglose de IVA para reparaciones
 */
export function formatRepairTaxBreakdown(calculation: RepairCalculationResult): string {
    const { breakdown } = calculation
    return `Mano de obra: ${formatCurrency(breakdown.laborTax)} | Repuestos: ${formatCurrency(breakdown.partsTax)}`
}

/**
 * Calcular total de carrito mixto (productos + reparaciones)
 * Actualizado para manejar IVA incluido
 */
export function calculateMixedCartTotal(
    productItems: Array<{ subtotal: number; taxAmount: number }>,
    repairItems: CartRepairItem[]
): {
    subtotal: number
    totalTax: number
    total: number
    repairTaxBreakdown: {
        laborTax: number
        partsTax: number
        laborSubtotal: number
        partsSubtotal: number
    }
} {
    // Calcular totales de productos
    const productSubtotal = productItems.reduce((sum, item) => sum + item.subtotal, 0)
    const productTax = productItems.reduce((sum, item) => sum + item.taxAmount, 0)

    // Calcular totales de reparaciones
    const repairSubtotal = repairItems.reduce((sum, item) => sum + item.subtotal, 0)
    const repairTax = repairItems.reduce((sum, item) => sum + item.taxAmount, 0)

    // Calcular desglose de IVA de reparaciones
    const repairLaborTax = repairItems.reduce((sum, item) => {
        const calc = calculateRepairTotal({
            laborCost: item.laborCost,
            partsCost: item.partsCost,
            taxRate: item.taxRate,
            pricesIncludeTax: true
        })
        return sum + calc.breakdown.laborTax
    }, 0)

    const repairPartsTax = repairItems.reduce((sum, item) => {
        const calc = calculateRepairTotal({
            laborCost: item.laborCost,
            partsCost: item.partsCost,
            taxRate: item.taxRate,
            pricesIncludeTax: true
        })
        return sum + calc.breakdown.partsTax
    }, 0)

    const repairLaborSubtotal = repairItems.reduce((sum, item) => {
        const calc = calculateRepairTotal({
            laborCost: item.laborCost,
            partsCost: item.partsCost,
            taxRate: item.taxRate,
            pricesIncludeTax: true
        })
        return sum + calc.breakdown.laborSubtotal
    }, 0)

    const repairPartsSubtotal = repairItems.reduce((sum, item) => {
        const calc = calculateRepairTotal({
            laborCost: item.laborCost,
            partsCost: item.partsCost,
            taxRate: item.taxRate,
            pricesIncludeTax: true
        })
        return sum + calc.breakdown.partsSubtotal
    }, 0)

    return {
        subtotal: productSubtotal + repairSubtotal,
        totalTax: productTax + repairTax,
        total: productSubtotal + repairSubtotal + productTax + repairTax,
        repairTaxBreakdown: {
            laborTax: Math.round(repairLaborTax * 100) / 100,
            partsTax: Math.round(repairPartsTax * 100) / 100,
            laborSubtotal: Math.round(repairLaborSubtotal * 100) / 100,
            partsSubtotal: Math.round(repairPartsSubtotal * 100) / 100
        }
    }
}
