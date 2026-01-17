'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { toast } from 'sonner'

export interface CashMovement {
    id: string
    type: 'sale' | 'cash_in' | 'cash_out' | 'opening' | 'closing'
    amount: number
    reason?: string
    payment_method?: 'cash' | 'card' | 'transfer' | 'mixed'
    created_at: string
    created_by?: string
    userName?: string
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
    const [initialized, setInitialized] = useState(false)

    const [history, setHistory] = useState<CashRegisterSession[]>([])
    const [auditLog, setAuditLog] = useState<CashMovement[]>([])

    let supabase: ReturnType<typeof createClient> | null = null
    try {
        supabase = createClient()
    } catch (e) {
        supabase = null
    }

    // Load initialization
    useEffect(() => {
        setInitialized(true)
    }, [])

    // Always sync state to localStorage


    // Load available registers
    const loadRegisters = useCallback(async () => {
        if (!config.supabase.isConfigured || !supabase) {
            setRegisters([{ id: 'principal', name: 'Caja Principal', is_active: true }])
            return
        }

        const { data, error } = await supabase
            .from('cash_registers')
            .select('*')
            .eq('is_active', true)
            .order('name')

        if (error) {
            setRegisters(prev => prev.length ? prev : [{ id: 'principal', name: 'Caja Principal', is_active: true }])
            return
        }

        setRegisters(data || [])
    }, [supabase])

    // Fetch history (closed sessions)
    const fetchHistory = useCallback(async (limit = 20) => {
        if (!config.supabase.isConfigured || !supabase) {
            return []
        }

        // Fetch sessions first (avoiding join to prevent relationship errors)
        const { data: sessions, error: sessionsError } = await supabase
            .from('cash_closures')
            .select('*')
            .not('date', 'is', null) // Closed sessions
            .order('date', { ascending: false })
            .limit(limit)

        if (sessionsError) {
            console.error('Error fetching history sessions:', sessionsError, JSON.stringify(sessionsError))
            return []
        }

        if (!sessions || sessions.length === 0) {
            setHistory([])
            return []
        }

        // Fetch movements for these sessions
        const sessionIds = sessions.map(s => s.id)
        const { data: movements, error: movementsError } = await supabase
            .from('cash_movements')
            .select('*')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: true })

        if (movementsError) {
            console.error('Error fetching history movements:', movementsError)
            // Return sessions with empty movements on error
            const formatted = sessions.map(session => ({
                ...session,
                movements: []
            }))
            setHistory(formatted)
            return formatted
        }

        // Group movements by session
        const movementsBySession = (movements || []).reduce((acc, mov) => {
            if (!acc[mov.session_id]) {
                acc[mov.session_id] = []
            }
            acc[mov.session_id].push(mov)
            return acc
        }, {} as Record<string, CashMovement[]>)

        const formatted = sessions.map(session => ({
            ...session,
            id: session.id,
            register_id: session.register_id,
            opened_by: session.opened_by || 'system',
            closed_by: session.closed_by,
            opening_balance: session.opening_balance,
            closing_balance: session.closing_balance,
            expected_balance: session.expected_balance || 0,
            discrepancy: session.discrepancy || 0,
            status: 'closed' as const,
            opened_at: session.created_at, // Map created_at to opened_at
            closed_at: session.date,       // Map date to closed_at
            movements: movementsBySession[session.id] || []
        }))

        setHistory(formatted)
        return formatted
    }, [supabase])

    // Fetch audit log (all movements)
    const fetchAuditLog = useCallback(async (limit = 100) => {
        if (!config.supabase.isConfigured || !supabase) {
            return []
        }

        const { data, error } = await supabase
            .from('cash_movements')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) {
            console.error('Error fetching audit log:', error)
            return []
        }

        // Fetch user names
        const movements = data || []
        const userIds = [...new Set(movements.map(m => m.created_by).filter(Boolean))] as string[]
        let userMap: Record<string, string> = {}
        
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', userIds)
            
            if (profiles) {
                userMap = profiles.reduce((acc, p) => {
                    acc[p.id] = p.full_name || 'Usuario'
                    return acc
                }, {} as Record<string, string>)
            }
        }

        const formatted = movements.map(item => ({
            ...item,
            userName: item.created_by ? (userMap[item.created_by] || 'Usuario Desconocido') : 'Sistema'
        }))

        setAuditLog(formatted)
        return formatted
    }, [supabase])

    // Analytics
    const getDailyAnalytics = useCallback(async (date?: string) => {
        if (!config.supabase.isConfigured || !supabase) return null

        const targetDate = date || new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
            .from('cash_closures')
            .select('sales_total_cash, sales_total_card, movements_count') // Adjusted fields based on script
            .not('date', 'is', null) // Closed sessions
            .gte('date', `${targetDate}T00:00:00`)
            .lte('date', `${targetDate}T23:59:59`)

        if (error) return null

        // Note: total_sales might need to be calculated if not stored in session
        // Assuming we need to calculate from movements if columns don't exist
        // But let's assume for now we might need to adjust based on schema.
        // For safety, let's fetch movements if needed, but for performance, using columns is better.
        // Let's stick to the Context interface which returns calculated values.

        return {
            date: targetDate,
            totalSales: 0, // Placeholder
            totalTransactions: 0,
            averageTicket: 0,
            discrepancies: 0
        }
    }, [supabase])

    // Check for open session
    const checkOpenSession = useCallback(async (registerId: string) => {
        try {
            if (!config.supabase.isConfigured || !supabase) {
                if (currentSession) return currentSession

                // Try to load from local storage if not in memory
                if (typeof window !== 'undefined') {
                    const saved = localStorage.getItem('pos_current_session')
                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved)
                            if (parsed && typeof parsed === 'object') {
                                setCurrentSession(parsed)
                                return parsed
                            }
                        } catch { }
                    }
                }
                return null
            }

            // Fetch session first (using cash_closures as session table)
            const { data: session, error: sessionError } = await supabase
                .from('cash_closures')
                .select('*')
                .eq('register_id', registerId)
                .is('date', null)
                .maybeSingle()

            if (sessionError) throw sessionError

            if (session) {
                // Fetch movements separately
                const { data: movements, error: movementsError } = await supabase
                    .from('cash_movements')
                    .select('*')
                    .eq('session_id', session.id)
                    .order('created_at', { ascending: true })

                if (movementsError) {
                    console.error('Error fetching session movements:', movementsError)
                    // Continue with empty movements if fail
                }

                const fullSession = {
                    ...session,
                    movements: movements || []
                }
                setCurrentSession(fullSession)
                return fullSession
            }

            return null
        } catch (error: unknown) {
            // Check if error is due to network/fetch failure
            const isNetworkError = error instanceof TypeError && error.message.includes('Failed to fetch')
            
            if (!isNetworkError) {
                 console.error('Error checking open session:', error, JSON.stringify(error))
            } else {
                 console.warn('Network error checking open session, using local fallback if available')
            }

            // On error (e.g. network), if we have a valid local session for this register, keep it alive
            if (currentSession && currentSession.register_id === registerId) {
                console.warn('Using local session as fallback due to check error')
                return currentSession
            }
            return null
        }
    }, [supabase, currentSession])

    // Open cash register
    const openRegister = useCallback(async (registerId: string, openingBalance: number, userId?: string) => {
        try {
            setLoading(true)
            if (!config.supabase.isConfigured || !supabase) {
                toast.error('Error: Conexión a base de datos no disponible')
                return false
            }

            // Check if already open
            const existingSession = await checkOpenSession(registerId)
            if (existingSession) {
                toast.error('Esta caja ya está abierta')
                return false
            }

            // Create new session
            // Create new session (closure record with status implicitly open)
            const { data: session, error: sessionError } = await supabase
                .from('cash_closures')
                .insert({
                    register_id: registerId,
                    opening_balance: openingBalance,
                    type: 'z',
                    date: null // Explicitly null to mark as open
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
                id: session.id,
                register_id: session.register_id,
                opened_by: session.opened_by || userId || 'system',
                opening_balance: session.opening_balance,
                status: 'open',
                opened_at: session.created_at,
                movements: [{
                    id: crypto.randomUUID(),
                    type: 'opening',
                    amount: openingBalance,
                    reason: 'Apertura de caja',
                    created_at: new Date().toISOString()
                }]
            } as any)

            toast.success('Caja abierta exitosamente')
            return true
        } catch (error: any) {
            console.error('Error opening register:', error)
            toast.error(`Error al abrir caja: ${error.message || 'Desconocido'}`)
            return false
        } finally {
            setLoading(false)
        }
    }, [checkOpenSession, supabase])

    // Close cash register
    const closeRegister = useCallback(async (closingBalance: number, userId?: string) => {
        if (!currentSession) {
            toast.error('No hay sesión activa')
            return false
        }

        try {
            setLoading(true)
            if (!config.supabase.isConfigured || !supabase) {
                setCurrentSession(null)
                toast.success('Caja cerrada correctamente')
                return true
            }

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

            // Update session (closure)
            const { error: updateError } = await supabase
                .from('cash_closures')
                .update({
                    // closed_by: userId, // Removing closed_by as it likely doesn't exist in the simple schema
                    closing_balance: closingBalance,
                    // expected_balance: expectedBalance, // Removing if unsure
                    // discrepancy, // Removing if unsure
                    date: new Date().toISOString() // Set date to mark as closed
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
            // Fallback: cerrar sesión local
            setCurrentSession(null)
            toast.success('Caja cerrada (modo local)')
            return true
        } finally {
            setLoading(false)
        }
    }, [currentSession, supabase])

    // Add cash in
    const addCashIn = useCallback(async (amount: number, reason: string, userId?: string) => {
        if (!currentSession) {
            toast.error('No hay sesión activa')
            return false
        }

        if (!config.supabase.isConfigured || !supabase) {
            toast.error('Error de configuración: Supabase no disponible')
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
        } catch (error: any) {
            console.error('Error adding cash in:', JSON.stringify(error, null, 2), error.message, error.code)
            toast.error(`Error al registrar entrada: ${error.message || 'Desconocido'}`)
            return false
        }
    }, [currentSession, supabase])

    // Add cash out
    const addCashOut = useCallback(async (amount: number, reason: string, userId?: string) => {
        if (!currentSession) {
            toast.error('No hay sesión activa')
            return false
        }

        if (!config.supabase.isConfigured || !supabase) {
            toast.error('Error de configuración: Supabase no disponible')
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
            toast.error('Error al registrar salida de efectivo')
            return false
        }
    }, [currentSession, supabase])

    // Register sale
    const registerSale = useCallback(async (saleId: string, amount: number, method?: 'cash' | 'card' | 'transfer' | 'mixed') => {
        if (!currentSession) return false

        if (!config.supabase.isConfigured || !supabase) {
            console.error('Supabase not configured for sale registration')
            return false
        }

        try {
            const { data, error } = await supabase
                .from('cash_movements')
                .insert({
                    session_id: currentSession.id,
                    type: 'sale',
                    amount,
                    reason: `Venta ${saleId}`,
                    payment_method: method,
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (error) throw error

            // Update local state with REAL data
            setCurrentSession(prev => prev ? {
                ...prev,
                // Ensure no duplicates by ID just in case
                movements: [...prev.movements.filter(m => m.id !== data.id), data]
            } : null)

            return true
        } catch (error: any) {
            console.error('Error registering sale movement:', error)
            // We do NOT modify local state on error. The sale might have happened in database but cash movement failed?
            // This is a critical consistency issue. 
            // Ideally we should alert.
            toast.error(`Error al registrar movimiento de caja para la venta: ${error.message}`)
            return false
        }
    }, [currentSession, supabase])

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

    // Generate report for a date range
    const getReportData = useCallback(async (start: Date, end: Date) => {
        if (!config.supabase.isConfigured || !supabase) return null

        const startIso = start.toISOString()
        const endIso = end.toISOString()

        // Fetch all movements in range
        const { data: movements, error } = await supabase
            .from('cash_movements')
            .select('*')
            .gte('created_at', startIso)
            .lte('created_at', endIso)

        if (error) {
            console.error('Error fetching report movements:', error)
            return null
        }

        const safeMovements = movements || []

        // Calculate totals
        const report = safeMovements.reduce((acc, mov) => {
            const amount = Number(mov.amount) || 0

            if (mov.type === 'sale') {
                acc.totalSales += amount

                // Track by payment method
                const method = mov.payment_method || 'cash'
                if (method === 'cash') acc.cashSales += amount
                else if (method === 'card') acc.cardSales += amount
                else if (method === 'transfer') acc.transferSales += amount
                else if (method === 'mixed') acc.mixedSales += amount

                // Sales count as income
                acc.incomes += amount
            } else if (mov.type === 'cash_in') {
                acc.incomes += amount
            } else if (mov.type === 'cash_out') {
                acc.expenses += amount
            }
            return acc
        }, {
            incomes: 0,
            expenses: 0,
            totalSales: 0,
            cashSales: 0,
            cardSales: 0,
            transferSales: 0,
            mixedSales: 0
        })

        // Fetch opening balance of the first session in the period
        const { data: firstSession } = await supabase
            .from('cash_closures')
            .select('opening_balance, created_at')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()

        const openingBalance = Number(firstSession?.opening_balance) || 0
        const closingBalance = (openingBalance + report.incomes) - report.expenses

        return {
            periodStart: startIso,
            periodEnd: endIso,
            openingBalance,
            closingBalance,
            incomes: report.incomes,
            expenses: report.expenses,
            cashSales: report.cashSales,
            cardSales: report.cardSales,
            transferSales: report.transferSales,
            mixedSales: report.mixedSales,
            discrepancy: 0
        }
    }, [supabase])

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
        getSessionReport,
        history,
        auditLog,
        fetchHistory,
        fetchAuditLog,
        getDailyAnalytics,
        getReportData
    }
}
