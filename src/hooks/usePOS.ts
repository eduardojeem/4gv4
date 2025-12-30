'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/types/product-unified'

export interface CartItem {
    id: string
    product_id: string
    name: string
    sku: string
    price: number
    quantity: number
    stock: number
    discount: number
    subtotal: number
    image?: string
    tax_rate?: number
    wholesale_price?: number
    original_price?: number
}

export interface Customer {
    id: string
    name: string
    email?: string
    phone?: string
    loyalty_points?: number
    discount_percentage?: number
}

export interface PaymentSplit {
    id: string
    method: 'cash' | 'card' | 'transfer' | 'credit'
    amount: number
    reference?: string
    card_last4?: string
}

export interface POSState {
    cart: CartItem[]
    customer: Customer | null
    paymentSplits: PaymentSplit[]
    discount: number
    notes: string
}

export function usePOS() {
    const [cart, setCart] = useState<CartItem[]>([])
    const [customer, setCustomer] = useState<Customer | null>(null)
    const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([])
    const [globalDiscount, setGlobalDiscount] = useState(0)
    const [notes, setNotes] = useState('')
    const [processing, setProcessing] = useState(false)
    const [isWholesale, setIsWholesale] = useState(false)

    const supabase = createClient()

    // Toggle wholesale mode
    const toggleWholesale = useCallback(() => {
        setIsWholesale(prev => !prev)
    }, [])

    // Recalculate prices when mode changes
    useEffect(() => {
        setCart(prev => prev.map(item => ({
            ...item,
            price: isWholesale ? (item.wholesale_price || item.original_price || item.price) : (item.original_price || item.price),
            subtotal: (isWholesale ? (item.wholesale_price || item.original_price || item.price) : (item.original_price || item.price)) * item.quantity
        })))
    }, [isWholesale])

    // Calcular subtotal
    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.subtotal, 0)
    }, [cart])

    // Calcular descuento total
    const totalDiscount = useMemo(() => {
        const itemDiscounts = cart.reduce((sum, item) => sum + (item.discount || 0), 0)
        const globalDiscountAmount = subtotal * (globalDiscount / 100)
        return itemDiscounts + globalDiscountAmount
    }, [cart, subtotal, globalDiscount])

    // Calcular impuestos
    const tax = useMemo(() => {
        return cart.reduce((sum, item) => {
            const taxRate = item.tax_rate || 0
            return sum + (item.subtotal * (taxRate / 100))
        }, 0)
    }, [cart])

    // Calcular total
    const total = useMemo(() => {
        return subtotal - totalDiscount + tax
    }, [subtotal, totalDiscount, tax])

    // Total pagado
    const totalPaid = useMemo(() => {
        return paymentSplits.reduce((sum, payment) => sum + payment.amount, 0)
    }, [paymentSplits])

    // Cambio
    const change = useMemo(() => {
        return Math.max(0, totalPaid - total)
    }, [totalPaid, total])

    // Agregar producto al carrito
    const addToCart = useCallback((product: Product, quantity: number = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.product_id === product.id)

            if (existing) {
                // Verificar stock
                if (existing.quantity + quantity > existing.stock) {
                    toast.error('Stock insuficiente')
                    return prev
                }

                return prev.map(item =>
                    item.product_id === product.id
                        ? {
                            ...item,
                            quantity: item.quantity + quantity,
                            subtotal: (item.quantity + quantity) * item.price
                        }
                        : item
                )
            }

            // Verificar stock para nuevo item
            if (quantity > product.stock_quantity) {
                toast.error('Stock insuficiente')
                return prev
            }

            const newItem: CartItem = {
                id: `cart-${Date.now()}-${product.id}`,
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                price: isWholesale ? (product.wholesale_price || product.sale_price) : product.sale_price,
                original_price: product.sale_price,
                wholesale_price: product.wholesale_price || undefined,
                quantity,
                stock: product.stock_quantity,
                discount: 0,
                subtotal: (isWholesale ? (product.wholesale_price || product.sale_price) : product.sale_price) * quantity,
                image: product.images?.[0] || undefined,
                tax_rate: 0 // Default tax rate since it's not in the Product type
            }

            return [...prev, newItem]
        })

        toast.success('Producto agregado')
    }, [])

    // Actualizar cantidad
    const updateQuantity = useCallback((itemId: string, quantity: number) => {
        if (quantity < 1) {
            removeFromCart(itemId)
            return
        }

        setCart(prev =>
            prev.map(item => {
                if (item.id === itemId) {
                    if (quantity > item.stock) {
                        toast.error('Stock insuficiente')
                        return item
                    }
                    return {
                        ...item,
                        quantity,
                        subtotal: item.price * quantity
                    }
                }
                return item
            })
        )
    }, [])

    // Aplicar descuento a un item
    const applyItemDiscount = useCallback((itemId: string, discount: number) => {
        setCart(prev =>
            prev.map(item =>
                item.id === itemId
                    ? { ...item, discount }
                    : item
            )
        )
    }, [])

    // Remover del carrito
    const removeFromCart = useCallback((itemId: string) => {
        setCart(prev => prev.filter(item => item.id !== itemId))
        toast.success('Producto eliminado')
    }, [])

    // Limpiar carrito
    const clearCart = useCallback(() => {
        setCart([])
        setCustomer(null)
        setPaymentSplits([])
        setGlobalDiscount(0)
        setNotes('')
    }, [])

    // Agregar pago
    const addPayment = useCallback((payment: Omit<PaymentSplit, 'id'>) => {
        const newPayment: PaymentSplit = {
            ...payment,
            id: `payment-${Date.now()}`
        }
        setPaymentSplits(prev => [...prev, newPayment])
    }, [])

    // Remover pago
    const removePayment = useCallback((paymentId: string) => {
        setPaymentSplits(prev => prev.filter(p => p.id !== paymentId))
    }, [])

    // Procesar venta
    const processSale = useCallback(async () => {
        if (cart.length === 0) {
            toast.error('El carrito está vacío')
            return null
        }

        if (totalPaid < total) {
            toast.error('Monto pagado insuficiente')
            return null
        }

        setProcessing(true)

        try {
            // Generar número de venta
            const saleNumber = `SALE-${Date.now()}`

            // Crear venta
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert({
                    code: saleNumber,
                    customer_id: customer?.id,
                    total_amount: total,
                    subtotal_amount: subtotal,
                    tax_amount: tax,
                    discount_amount: totalDiscount,
                    payment_method: paymentSplits.length > 1 ? 'multiple' : paymentSplits[0]?.method || 'cash',
                    payment_status: 'completed',
                    notes,
                    status: 'completed',
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (saleError) throw saleError

            // Crear items de venta
            const saleItems = cart.map(item => ({
                sale_id: sale.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.price,
                discount_amount: item.discount,
                subtotal: item.subtotal
            }))

            const { error: itemsError } = await supabase
                .from('sale_items')
                .insert(saleItems)

            if (itemsError) throw itemsError

            // Crear registros de pago
            const payments = paymentSplits.map(payment => ({
                sale_id: sale.id,
                payment_method: payment.method,
                amount: payment.amount,
                reference_number: payment.reference,
                status: 'completed'
            }))

            const { error: paymentsError } = await supabase
                .from('payments')
                .insert(payments)

            if (paymentsError) throw paymentsError

            // Actualizar stock de productos
            for (const item of cart) {
                // Get current stock first
                const { data: currentProduct } = await supabase
                    .from('products')
                    .select('stock_quantity')
                    .eq('id', item.product_id)
                    .single()

                if (currentProduct) {
                    const newStock = Math.max(0, currentProduct.stock_quantity - item.quantity)
                    const { error: stockError } = await supabase
                        .from('products')
                        .update({ stock_quantity: newStock })
                        .eq('id', item.product_id)

                    if (stockError) throw stockError
                }
            }

            toast.success('Venta procesada exitosamente')

            // Limpiar carrito
            clearCart()

            return sale
        } catch (error: unknown) {
            console.error('Error processing sale:', error)
            toast.error('Error al procesar la venta')
            return null
        } finally {
            setProcessing(false)
        }
    }, [cart, customer, subtotal, tax, totalDiscount, total, paymentSplits, notes, totalPaid, clearCart])

    return {
        // Estado
        cart,
        customer,
        paymentSplits,
        globalDiscount,
        notes,
        processing,

        // Cálculos
        subtotal,
        totalDiscount,
        tax,
        total,
        totalPaid,
        change,

        // Acciones del carrito
        addToCart,
        updateQuantity,
        applyItemDiscount,
        removeFromCart,
        clearCart,

        // Cliente
        setCustomer,

        // Descuento global
        setGlobalDiscount,

        // Notas
        setNotes,

        // Pagos
        addPayment,
        removePayment,

        // Procesar venta
        processSale,

        // Wholesale
        isWholesale,
        toggleWholesale
    }
}
