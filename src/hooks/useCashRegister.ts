'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { toast } from 'sonner'
import { useBranch } from '@/contexts/branch-context'
import { branchHeaders, withBranchFilter } from '@/lib/branches/client'
import { calculateExpectedCashBalance, isPhysicalManualMovement } from '@/app/dashboard/pos/lib/cash-balance'

export interface CashMovement {
    id: string
    type: 'sale' | 'cash_in' | 'cash_out' | 'opening' | 'closing'
    amount: number
    reason?: string
    payment_method?: 'cash' | 'card' | 'transfer' | 'mixed'
    created_at: string
    created_by?: string
    userName?: string
    userEmail?: string
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
    branch_id?: string
}

export function useCashRegister() {
    const [currentSession, setCurrentSession] = useState<CashRegisterSession | null>(null)
    const [loading, setLoading] = useState(false)
    const [registers, setRegisters] = useState<CashRegister[]>([])

    const [history, setHistory] = useState<CashRegisterSession[]>([])
    const [auditLog, setAuditLog] = useState<CashMovement[]>([])
    const { selectedBranchId } = useBranch()

    // Fix #4: memoize Supabase client — no instanciar en cada render
    const supabase = useMemo(() => {
        try { return createClient() } catch { return null }
    }, [])

    const resolveActorId = useCallback(async (explicitUserId?: string) => {
        if (explicitUserId) return explicitUserId
        if (!supabase) return undefined
        try {
            const { data } = await supabase.auth.getUser()
            return data.user?.id
        } catch {
            return undefined
        }
    }, [supabase])

    // Always sync state to localStorage


    // Load available registers
    const loadRegisters = useCallback(async () => {
        if (!config.supabase.isConfigured || !supabase) {
            setRegisters([])
            return []
        }

        let query = supabase
            .from('cash_registers')
            .select('*')
            .order('name')

        query = withBranchFilter(query, selectedBranchId)
        const { data, error } = await query

        if (error) {
            throw new Error(error.message || 'No se pudieron cargar las cajas de la sucursal.')
        }

        const nextRegisters = (data || []).map(register => ({
            ...register,
            is_active: true
        }))
        setRegisters(nextRegisters)
        return nextRegisters
    }, [selectedBranchId, supabase])

    // Fetch history (closed sessions)
    const fetchHistory = useCallback(async (limit = 20) => {
        if (!config.supabase.isConfigured || !supabase) {
            return []
        }

        // Fetch sessions first (avoiding join to prevent relationship errors)
        let sessionsQuery = supabase
            .from('cash_closures')
            .select('*')
            .not('date', 'is', null) // Closed sessions
            .order('date', { ascending: false })
            .limit(limit)

        sessionsQuery = withBranchFilter(sessionsQuery, selectedBranchId)
        const { data: sessions, error: sessionsError } = await sessionsQuery

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
        let movementsQuery = supabase
            .from('cash_movements')
            .select('*')
            .in('session_id', sessionIds)
            .order('created_at', { ascending: true })

        movementsQuery = withBranchFilter(movementsQuery, selectedBranchId)
        const { data: movements, error: movementsError } = await movementsQuery

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
    }, [selectedBranchId, supabase])

    // Fetch audit log (all movements)
    const fetchAuditLog = useCallback(async (limit = 100) => {
        if (!config.supabase.isConfigured || !supabase) {
            return []
        }

        let query = supabase
            .from('cash_movements')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit)

        query = withBranchFilter(query, selectedBranchId)
        const { data, error } = await query

        if (error) {
            console.error('Error fetching audit log:', error)
            return []
        }

        // Fetch user names
        const movements = data || []
        const userIds = [...new Set(movements.map(m => m.created_by).filter(Boolean))] as string[]
        let userMap: Record<string, string> = {}
        
        let emailMap: Record<string, string> = {}
        if (userIds.length > 0) {
            const { data: profilesWithEmail, error: profilesWithEmailError } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds)

            if (profilesWithEmailError) {
                const { data: profilesFallback } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds)

                if (profilesFallback) {
                    userMap = profilesFallback.reduce((acc, p) => {
                        acc[p.id] = p.full_name || 'Usuario'
                        return acc
                    }, {} as Record<string, string>)
                }
            } else if (profilesWithEmail) {
                userMap = profilesWithEmail.reduce((acc, p) => {
                    acc[p.id] = p.full_name || ''
                    return acc
                }, {} as Record<string, string>)

                emailMap = profilesWithEmail.reduce((acc, p) => {
                    acc[p.id] = p.email || ''
                    return acc
                }, {} as Record<string, string>)
            }
        }

        const formatted = movements.map(item => {
            const userId = item.created_by || ''
            const userName = userId ? (userMap[userId] || '') : ''
            const userEmail = userId ? (emailMap[userId] || '') : ''
            return {
                ...item,
                userName: userName || userEmail || (userId ? 'Usuario Desconocido' : 'Usuario no identificado'),
                userEmail
            }
        })

        setAuditLog(formatted)
        return formatted
    }, [selectedBranchId, supabase])

    // Analytics — Fix #10: calcular datos reales desde movimientos
    const getDailyAnalytics = useCallback(async (date?: string) => {
        if (!config.supabase.isConfigured || !supabase) return null

        const targetDate = date || new Date().toISOString().split('T')[0]
        const startIso = `${targetDate}T00:00:00.000Z`
        const endIso = `${targetDate}T23:59:59.999Z`

        let movementQuery = supabase
            .from('cash_movements')
            .select('type, amount, payment_method')
            .gte('created_at', startIso)
            .lte('created_at', endIso)

        movementQuery = withBranchFilter(movementQuery, selectedBranchId)
        const { data: movements, error } = await movementQuery

        if (error) return null

        const safeMovements = movements || []
        const sales = safeMovements.filter(m => m.type === 'sale')
        const totalSales = sales.reduce((s, m) => s + (Number(m.amount) || 0), 0)
        const totalTransactions = sales.length
        const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0

        // Contar cierres con discrepancia (desde cash_closures)
        let closureQuery = supabase
            .from('cash_closures')
            .select('discrepancy')
            .not('date', 'is', null)
            .gte('date', startIso)
            .lte('date', endIso)

        closureQuery = withBranchFilter(closureQuery, selectedBranchId)
        const { data: closures } = await closureQuery

        const discrepancies = (closures || []).filter(c => Math.abs(Number(c.discrepancy)) > 0).length

        return {
            date: targetDate,
            totalSales,
            totalTransactions,
            averageTicket,
            discrepancies
        }
    }, [selectedBranchId, supabase])

    // Check for open session
    const checkOpenSession = useCallback(async (registerId?: string) => {
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

            let session = null

            // 1. Check for explicit registerId first (if not 'principal')
            if (registerId && registerId !== 'principal') {
                let sessionQuery = supabase
                    .from('cash_closures')
                    .select('*')
                    .eq('register_id', registerId)
                    .is('date', null)
                    .order('created_at', { ascending: false })
                    .limit(1)

                sessionQuery = withBranchFilter(sessionQuery, selectedBranchId)
                const { data, error } = await sessionQuery.maybeSingle()
                if (!error && data) {
                    session = data
                }
            }

            // 2. Fallback: Search for ANY open session in the current branch
            if (!session) {
                let branchSessionQuery = supabase
                    .from('cash_closures')
                    .select('*')
                    .is('date', null)
                    .order('created_at', { ascending: false })
                    .limit(1)

                branchSessionQuery = withBranchFilter(branchSessionQuery, selectedBranchId)
                const { data: branchSession, error: branchError } = await branchSessionQuery.maybeSingle()
                if (!branchError && branchSession) {
                    session = branchSession
                }
            }

            if (session) {
                // Fetch movements separately
                let movementsQuery = supabase
                    .from('cash_movements')
                    .select('*')
                    .eq('session_id', session.id)
                    .order('created_at', { ascending: true })

                movementsQuery = withBranchFilter(movementsQuery, selectedBranchId)
                const { data: movements, error: movementsError } = await movementsQuery

                if (movementsError) {
                    console.error('Error fetching session movements:', movementsError)
                }

                const fullSession = {
                    ...session,
                    movements: movements || []
                }
                setCurrentSession(fullSession)
                return fullSession
            }

            setCurrentSession(null)
            return null
        } catch (error: unknown) {
            // Check if error is due to network/fetch failure
            const isNetworkError = error instanceof TypeError && error.message.includes('Failed to fetch')
            
            if (!isNetworkError) {
                 console.error('Error checking open session:', error, JSON.stringify(error))
            } else {
                 console.warn('Network error checking open session, using local fallback if available')
            }

            // On error (e.g. network), if we have a valid local session, keep it alive
            if (currentSession && (!registerId || currentSession.register_id === registerId || registerId === 'principal')) {
                console.warn('Using local session as fallback due to check error')
                return currentSession
            }
            return null
        }
    }, [selectedBranchId, supabase, currentSession])

    // Open cash register
    const openRegister = useCallback(async (registerId: string, openingBalance: number, userId?: string, note?: string) => {
        try {
            setLoading(true)
            if (!config.supabase.isConfigured || !supabase) {
                toast.error('Error: Conexión a base de datos no disponible')
                return false
            }

            if (!registerId.trim()) {
                toast.error('Selecciona una caja antes de abrirla')
                return false
            }

            let normalizedRegisterId = registerId.trim()

            // `principal` is a UI alias used by payment dialogs. The atomic RPC
            // only accepts a real register id belonging to the active branch.
            if (normalizedRegisterId === 'principal') {
                if (!selectedBranchId || selectedBranchId === 'all') {
                    throw new Error('Selecciona una sucursal antes de abrir la caja.')
                }

                const availableRegisters = await loadRegisters()
                normalizedRegisterId = availableRegisters[0]?.id || ''

                if (!normalizedRegisterId) {
                    const createResponse = await fetch('/api/pos/cash-registers', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...branchHeaders(selectedBranchId),
                        },
                        body: JSON.stringify({
                            name: 'Caja Principal',
                            branch_id: selectedBranchId,
                        }),
                    })
                    const createPayload = await createResponse.json().catch(() => null) as {
                        success?: boolean
                        error?: string
                        data?: { id?: string }
                    } | null

                    if (!createResponse.ok || !createPayload?.success || !createPayload.data?.id) {
                        throw new Error(createPayload?.error || 'No se pudo preparar la caja principal.')
                    }

                    normalizedRegisterId = createPayload.data.id
                }
            }

            // Check if already open
            const existingSession = await checkOpenSession(normalizedRegisterId)
            if (existingSession) {
                toast.error('Esta caja ya está abierta')
                return false
            }

            const actorId = await resolveActorId(userId)
            const response = await fetch('/api/pos/cash-register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...branchHeaders(selectedBranchId),
                },
                body: JSON.stringify({
                    registerId: normalizedRegisterId,
                    openingBalance,
                    note,
                    branchId: selectedBranchId,
                }),
            })
            const payload = await response.json() as {
                success?: boolean
                error?: string
                code?: string
                data?: {
                    id: string
                    register_id: string
                    opening_balance: number
                    opened_by?: string | null
                    opened_at?: string
                }
            }

            if (!response.ok || !payload.success || !payload.data) {
                throw new Error(payload.error || 'No se pudo abrir la caja.')
            }

            const openingReason = note?.trim() ? `Apertura de caja — ${note.trim()}` : 'Apertura de caja'
            const session = payload.data

            const nextSession: CashRegisterSession = {
                ...session,
                id: session.id,
                register_id: session.register_id,
                opened_by: session.opened_by || actorId || 'system',
                opening_balance: session.opening_balance,
                status: 'open',
                opened_at: session.opened_at || new Date().toISOString(),
                movements: [{
                    id: crypto.randomUUID(),
                    type: 'opening',
                    amount: openingBalance,
                    reason: openingReason,
                    created_at: new Date().toISOString()
                }]
            }

            setCurrentSession(nextSession)

            toast.success('Caja abierta exitosamente')
            return true
        } catch (error: unknown) {
            const e = error as { message?: string; details?: string; hint?: string; code?: string } | null
            const message = error instanceof Error
                ? error.message
                : (e?.message || e?.details || e?.hint || (e?.code ? `Código ${e.code}` : 'Desconocido'))
            console.warn(`No se pudo abrir la caja: ${message}`)
            toast.error(`Error al abrir caja: ${message}`)
            return false
        } finally {
            setLoading(false)
        }
    }, [checkOpenSession, loadRegisters, resolveActorId, selectedBranchId, supabase])

    // Close cash register
    const closeRegister = useCallback(async (closingBalance: number, userId?: string) => {
        if (!currentSession) {
            toast.error('No hay sesión activa')
            return false
        }

        try {
            setLoading(true)

            if (!config.supabase.isConfigured || !supabase) {
                // Sin DB configurada: solo modo local (desarrollo/demo)
                setCurrentSession(null)
                toast.success('Caja cerrada correctamente (modo local)')
                return true
            }

            await resolveActorId(userId)
            const response = await fetch('/api/pos/cash-register', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...branchHeaders(selectedBranchId),
                },
                body: JSON.stringify({
                    sessionId: currentSession.id,
                    closingBalance,
                    branchId: selectedBranchId,
                }),
            })
            const payload = await response.json() as {
                success?: boolean
                error?: string
                code?: string
                data?: { discrepancy?: number }
            }

            if (!response.ok || !payload.success) {
                throw new Error(payload.error || 'No se pudo cerrar la caja.')
            }

            const discrepancy = Number(payload.data?.discrepancy || 0)

            // Solo limpiar estado local DESPUÉS de confirmar éxito en DB
            setCurrentSession(null)

            if (Math.abs(discrepancy) > 0) {
                const sign = discrepancy > 0 ? '+' : ''
                toast.warning(`Caja cerrada. Diferencia: ${sign}${discrepancy.toLocaleString()} Gs.`)
            } else {
                toast.success('Caja cerrada correctamente')
            }

            return true
        } catch (error: unknown) {
            // Fix #3: NO limpiar sesión local si DB falló → evitar inconsistencia
            const message = error instanceof Error ? error.message : 'No se pudo cerrar la caja.'
            console.warn(`No se pudo cerrar la caja: ${message}`)
            toast.error(message)
            return false
        } finally {
            setLoading(false)
        }
    }, [currentSession, resolveActorId, selectedBranchId, supabase])

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
            await resolveActorId(userId)
            const response = await fetch('/api/pos/cash-movements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...branchHeaders(selectedBranchId) },
                body: JSON.stringify({
                    sessionId: currentSession.id,
                    type: 'cash_in',
                    amount,
                    reason,
                    branchId: selectedBranchId,
                }),
            })
            const payload = await response.json() as { success?: boolean; error?: string; data?: CashMovement }
            if (!response.ok || !payload.success || !payload.data) {
                throw new Error(payload.error || 'No se pudo registrar la entrada.')
            }

            setCurrentSession(prev => prev ? {
                ...prev,
                movements: [...prev.movements, payload.data as CashMovement]
            } : null)

            toast.success('Entrada de efectivo registrada')
            return true
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Desconocido'
            console.error('Error adding cash in:', error)
            toast.error(`Error al registrar entrada: ${message}`)
            return false
        }
    }, [currentSession, resolveActorId, selectedBranchId, supabase])

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
            await resolveActorId(userId)
            const response = await fetch('/api/pos/cash-movements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...branchHeaders(selectedBranchId) },
                body: JSON.stringify({
                    sessionId: currentSession.id,
                    type: 'cash_out',
                    amount,
                    reason,
                    branchId: selectedBranchId,
                }),
            })
            const payload = await response.json() as { success?: boolean; error?: string; data?: CashMovement }
            if (!response.ok || !payload.success || !payload.data) {
                throw new Error(payload.error || 'No se pudo registrar la salida.')
            }

            setCurrentSession(prev => prev ? {
                ...prev,
                movements: [...prev.movements, payload.data as CashMovement]
            } : null)

            toast.success('Salida de efectivo registrada')
            return true
        } catch (error: unknown) {
            console.error('Error adding cash out:', error)
            toast.error('Error al registrar salida de efectivo')
            return false
        }
    }, [currentSession, resolveActorId, selectedBranchId, supabase])

    // Register sale
    const registerSale = useCallback(async (
        _saleId?: string,
        _amount?: number,
        _method?: 'cash' | 'card' | 'transfer' | 'mixed'
    ) => {
        void _saleId
        void _amount
        void _method
        console.warn('registerSale is deprecated; process-sale records the movement atomically.')
        return false
    }, [])

    // Get current balance
    const getCurrentBalance = useCallback(() => {
        if (!currentSession) return 0

        return calculateExpectedCashBalance(currentSession.movements)
    }, [currentSession])

    // Get session report
    const getSessionReport = useCallback(() => {
        if (!currentSession) return null

        const sales = currentSession.movements.filter(m => m.type === 'sale')
        const cashIns = currentSession.movements.filter(m => m.type === 'cash_in' && isPhysicalManualMovement(m))
        const cashOuts = currentSession.movements.filter(m => m.type === 'cash_out' && isPhysicalManualMovement(m))

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
        let movementsQuery = supabase
            .from('cash_movements')
            .select('*')
            .gte('created_at', startIso)
            .lte('created_at', endIso)

        movementsQuery = withBranchFilter(movementsQuery, selectedBranchId)
        const { data: movements, error } = await movementsQuery

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
        let firstSessionQuery = supabase
            .from('cash_closures')
            .select('opening_balance, created_at')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
            .order('created_at', { ascending: true })
            .limit(1)

        firstSessionQuery = withBranchFilter(firstSessionQuery, selectedBranchId)
        const { data: firstSession } = await firstSessionQuery.maybeSingle()

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
    }, [selectedBranchId, supabase])

    // Realtime subscription: sync movements & session closures in real-time across terminals
    useEffect(() => {
        if (!config.supabase.isConfigured || !supabase || !currentSession) return

        const sessionId = currentSession.id
        const channelName = `cash_session_${sessionId}_${Date.now()}`

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'cash_movements',
                    filter: `session_id=eq.${sessionId}`
                },
                (payload) => {
                    const newMovement = payload.new as CashMovement
                    setCurrentSession(prev => {
                        if (!prev || prev.id !== sessionId) return prev
                        const exists = prev.movements.some(m => m.id === newMovement.id)
                        if (exists) return prev
                        return {
                            ...prev,
                            movements: [...prev.movements, newMovement]
                        }
                    })
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'cash_movements',
                    filter: `session_id=eq.${sessionId}`
                },
                (payload) => {
                    const oldId = payload.old?.id
                    if (!oldId) return
                    setCurrentSession(prev => {
                        if (!prev || prev.id !== sessionId) return prev
                        return {
                            ...prev,
                            movements: prev.movements.filter(m => m.id !== oldId)
                        }
                    })
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'cash_closures',
                    filter: `id=eq.${sessionId}`
                },
                (payload) => {
                    const updated = payload.new as { date?: string | null; closed_at?: string | null; closing_balance?: number }
                    if (updated && (updated.date || updated.closed_at)) {
                        setCurrentSession(null)
                        toast.info('El turno de caja ha sido cerrado.')
                    }
                }
            )
            .subscribe()

        return () => {
            supabase?.removeChannel(channel)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currentSession.id used via sessionId capture
    }, [selectedBranchId, supabase, currentSession?.id])

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
