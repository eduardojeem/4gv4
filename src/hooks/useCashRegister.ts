'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface CashMovement {
    id: string
    type: 'sale' | 'cash_in' | 'cash_out' | 'opening' | 'closing'
    amount: number
    reason?: string
    created_at: string
    created_by?: string
}

export interface CashRegisterSession {
    id: string
    register_id: string
    opened_by: string
    closed_by?: string
    opening_balance: number
    closing_balance?: number
    expected_balance?: number
    discrepancy?: number
    status: 'open' | 'closed'
    opened_at: string
    closed_at?: string
    movements: CashMovement[]
}

export interface CashRegister {
    id: string
    name: string
    is_active: boolean
}

export function useCashRegister() {
    const [currentSession, setCurrentSession] = useState<CashRegisterSession | null>(null)
    const [loading, setLoading] = useState(false)
    const [registers, setRegisters] = useState<CashRegister[]>([])

    const supabase = createClient()

    // Load available registers
    const loadRegisters = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('cash_registers')
                .select('*')
                .eq('is_active', true)
                .order('name')

            if (error) throw error
            setRegisters(data || [])
        } catch (error: unknown) {
            console.error('Error loading registers:', error)
            toast.error('Error al cargar cajas')
        }
    }, [])

    // Check for open session
    const checkOpenSession = useCallback(async (registerId: string) => {
        try {
            const { data, error } = await supabase
                .from('cash_register_sessions')
                .select('*, cash_movements(*)')
                .eq('register_id', registerId)
                .eq('status', 'open')
                .single()

            if (error && error.code !== 'PGRST116') throw error

            if (data) {
                setCurrentSession({
                    ...data,
                    movements: data.cash_movements || []
                })
                return data
            }

            return null
        } catch (error: unknown) {
            console.error('Error checking session:', error)
            return null
        }
    }, [])

    // Open cash register
    const openRegister = useCallback(async (registerId: string, openingBalance: number, userId?: string) => {
        try {
            setLoading(true)

            // Check if already open
            const existingSession = await checkOpenSession(registerId)
            if (existingSession) {
                toast.error('Esta caja ya está abierta')
                return false
            }

            // Create new session
            const { data: session, error: sessionError } = await supabase
                .from('cash_register_sessions')
                .insert({
                    register_id: registerId,
                    opened_by: userId,
                    opening_balance: openingBalance,
                    status: 'open',
                    opened_at: new Date().toISOString()
                })
                .select()
                .single()

            if (sessionError) throw sessionError

            // Create opening movement
            const { error: movementError } = await supabase
                .from('cash_movements')
                .insert({
                    session_id: session.id,
                    type: 'opening',
                    amount: openingBalance,
                    reason: 'Apertura de caja',
                    created_by: userId,
                    created_at: new Date().toISOString()
                })

            if (movementError) throw movementError

            setCurrentSession({
                ...session,
                movements: [{
                    id: crypto.randomUUID(),
                    type: 'opening',
                    amount: openingBalance,
                    reason: 'Apertura de caja',
                    created_at: new Date().toISOString()
                }]
            })

            toast.success('Caja abierta exitosamente')
            return true
        } catch (error: unknown) {
            console.error('Error opening register:', error)
            toast.error('Error al abrir caja')
            return false
        } finally {
            setLoading(false)
        }
    }, [checkOpenSession])

    // Close cash register
    const closeRegister = useCallback(async (closingBalance: number, userId?: string) => {
        if (!currentSession) {
            toast.error('No hay sesión activa')
            return false
        }

        try {
            setLoading(true)

            // Calculate expected balance
            const expectedBalance = currentSession.movements.reduce((sum, mov) => {
                if (mov.type === 'opening' || mov.type === 'sale' || mov.type === 'cash_in') {
                    return sum + mov.amount
                } else if (mov.type === 'cash_out') {
                    return sum - mov.amount
                }
                return sum
            }, 0)

            const discrepancy = closingBalance - expectedBalance

            // Update session
            const { error: updateError } = await supabase
                .from('cash_register_sessions')
                .update({
                    closed_by: userId,
                    closing_balance: closingBalance,
                    expected_balance: expectedBalance,
                    discrepancy,
                    status: 'closed',
                    closed_at: new Date().toISOString()
                })
                .eq('id', currentSession.id)

            if (updateError) throw updateError

            // Create closing movement
            await supabase
                .from('cash_movements')
                .insert({
                    session_id: currentSession.id,
                    type: 'closing',
                    amount: closingBalance,
                    reason: 'Cierre de caja',
                    created_by: userId,
                    created_at: new Date().toISOString()
                })

            setCurrentSession(null)

            if (Math.abs(discrepancy) > 0) {
                toast.warning(`Caja cerrada. Diferencia: ${discrepancy.toLocaleString()} Gs.`)
            } else {
                toast.success('Caja cerrada correctamente')
            }

            return true
        } catch (error: unknown) {
            console.error('Error closing register:', error)
            toast.error('Error al cerrar caja')
            return false
        } finally {
            setLoading(false)
        }
    }, [currentSession])

    // Add cash in
    const addCashIn = useCallback(async (amount: number, reason: string, userId?: string) => {
        if (!currentSession) {
            toast.error('No hay sesión activa')
            return false
        }

        try {
            const { data, error } = await supabase
                .from('cash_movements')
                .insert({
                    session_id: currentSession.id,
                    type: 'cash_in',
                    amount,
                    reason,
                    created_by: userId,
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) throw error

            setCurrentSession(prev => prev ? {
                ...prev,
                movements: [...prev.movements, data]
            } : null)

            toast.success('Entrada de efectivo registrada')
            return true
        } catch (error: unknown) {
            console.error('Error adding cash in:', error)
            toast.error('Error al registrar entrada')
            return false
        }
    }, [currentSession])

    // Add cash out
    const addCashOut = useCallback(async (amount: number, reason: string, userId?: string) => {
        if (!currentSession) {
            toast.error('No hay sesión activa')
            return false
        }

        try {
            const { data, error } = await supabase
                .from('cash_movements')
                .insert({
                    session_id: currentSession.id,
                    type: 'cash_out',
                    amount,
                    reason,
                    created_by: userId,
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) throw error

            setCurrentSession(prev => prev ? {
                ...prev,
                movements: [...prev.movements, data]
            } : null)

            toast.success('Salida de efectivo registrada')
            return true
        } catch (error: unknown) {
            console.error('Error adding cash out:', error)
            toast.error('Error al registrar salida')
            return false
        }
    }, [currentSession])

    // Register sale
    const registerSale = useCallback(async (saleId: string, amount: number) => {
        if (!currentSession) return false

        try {
            await supabase
                .from('cash_movements')
                .insert({
                    session_id: currentSession.id,
                    type: 'sale',
                    amount,
                    reason: `Venta ${saleId}`,
                    created_at: new Date().toISOString()
                })

            // Update local state
            setCurrentSession(prev => prev ? {
                ...prev,
                movements: [...prev.movements, {
                    id: crypto.randomUUID(),
                    type: 'sale',
                    amount,
                    reason: `Venta ${saleId}`,
                    created_at: new Date().toISOString()
                }]
            } : null)

            return true
        } catch (error: unknown) {
            console.error('Error registering sale:', error)
            return false
        }
    }, [currentSession])

    // Get current balance
    const getCurrentBalance = useCallback(() => {
        if (!currentSession) return 0

        return currentSession.movements.reduce((sum, mov) => {
            if (mov.type === 'opening' || mov.type === 'sale' || mov.type === 'cash_in') {
                return sum + mov.amount
            } else if (mov.type === 'cash_out') {
                return sum - mov.amount
            }
            return sum
        }, 0)
    }, [currentSession])

    // Get session report
    const getSessionReport = useCallback(() => {
        if (!currentSession) return null

        const sales = currentSession.movements.filter(m => m.type === 'sale')
        const cashIns = currentSession.movements.filter(m => m.type === 'cash_in')
        const cashOuts = currentSession.movements.filter(m => m.type === 'cash_out')

        const totalSales = sales.reduce((sum, m) => sum + m.amount, 0)
        const totalCashIn = cashIns.reduce((sum, m) => sum + m.amount, 0)
        const totalCashOut = cashOuts.reduce((sum, m) => sum + m.amount, 0)
        const currentBalance = getCurrentBalance()

        return {
            session: currentSession,
            openingBalance: currentSession.opening_balance,
            currentBalance,
            totalSales,
            totalCashIn,
            totalCashOut,
            salesCount: sales.length,
            movements: currentSession.movements
        }
    }, [currentSession, getCurrentBalance])

    return {
        currentSession,
        registers,
        loading,
        isOpen: !!currentSession,
        currentBalance: getCurrentBalance(),
        loadRegisters,
        checkOpenSession,
        openRegister,
        closeRegister,
        addCashIn,
        addCashOut,
        registerSale,
        getSessionReport
    }
}
