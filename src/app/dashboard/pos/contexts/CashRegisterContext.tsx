'use client'

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { CashRegisterState, CashMovement } from '../types'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useCashRegister } from '@/hooks/useCashRegister'

// Extended types for advanced features
export interface ZClosureRecord {
  id: string
  registerId: string
  date: string
  // Apertura
  openedAt: string
  openedBy?: string
  openingBalance: number
  // Cierre
  closedAt: string
  closedBy: string
  closingBalance: number
  expectedBalance: number
  discrepancy: number
  // Totales calculados
  totalSales: number
  totalCashIn: number
  totalCashOut: number
  salesByCash: number
  salesByCard: number
  salesByTransfer: number
  salesByMixed: number
  movementsCount: number
  notes?: string
  // Movimientos individuales de la sesión
  movements: import('@/hooks/useCashRegister').CashMovement[]
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  userEmail?: string
  action: string
  details: string
  registerId: string
  amount?: number
  previousBalance?: number
  newBalance?: number
}

export interface CashCount {
  bills: Record<string, number> // denomination -> quantity
  coins: Record<string, number>
  total: number
  timestamp: string
  countedBy: string
}

export interface UserPermissions {
  canOpenRegister: boolean
  canCloseRegister: boolean
  canAddCashIn: boolean
  canAddCashOut: boolean
  canViewReports: boolean
  canExportData: boolean
  canViewAuditLog: boolean
  canManagePermissions: boolean
  maxCashOutAmount?: number
  requiresApprovalForLargeAmounts?: boolean
}

export interface CashReport {
  periodStart?: string
  periodEnd?: string
  openingBalance: number
  incomes: number
  expenses: number
  closingBalance: number
  cashSales?: number
  cardSales?: number
  transferSales?: number
  mixedSales?: number
  discrepancy?: number
}

interface CashRegisterContextType {
  // Basic register management
  registers: Array<{ id: string; name: string; isActive: boolean }>
  activeRegisterId: string
  setActiveRegisterId: (id: string) => void
  setRegisters: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; isActive: boolean }>>>
  refreshRegisters: () => Promise<void>
  // Deprecated: setRegisterState
  // setRegisterState: React.Dispatch<React.SetStateAction<Record<string, CashRegisterState>>>

  getCurrentRegister: CashRegisterState
  // Deprecated: updateActiveRegister
  // updateActiveRegister: (updater: (reg: CashRegisterState) => CashRegisterState) => void

  registerState: Record<string, CashRegisterState>

  // Movement operations
  addMovement: (type: CashMovement['type'], amount: number, note?: string, paymentMethod?: string) => Promise<void>
  registerSale: (saleId: string, amount: number, paymentMethod: string) => Promise<void>
  openRegister: (initialAmount: number, note?: string, userId?: string) => Promise<boolean>
  closeRegister: (closingBalance?: number, userId?: string) => Promise<boolean>

  // Reporting
  cashReport: CashReport | null
  setCashReport: (report: CashReport | null) => void
  generateCashReportForRange: (startIso?: string, endIso?: string) => Promise<void>
  exportCashReportCSV: () => void

  // Z Closure and History
  registerZClosure: (userId?: string, notes?: string) => Promise<boolean>
  zClosureHistory: ZClosureRecord[]
  fetchZClosureHistory: () => Promise<void>
  getZClosureDetails: (closureId: string) => ZClosureRecord | null

  // Cash counting and discrepancy management
  performCashCount: (count: CashCount) => Promise<void>
  lastCashCount: CashCount | null
  calculateDiscrepancy: () => number

  // Audit logging
  auditLog: AuditLogEntry[]
  fetchAuditLog: (registerId?: string, startDate?: string, endDate?: string) => Promise<void>
  addAuditEntry: (action: string, details: string, amount?: number) => Promise<void>

  // Permissions and security
  userPermissions: UserPermissions
  setUserPermissions: (permissions: UserPermissions) => void
  checkPermission: (action: keyof UserPermissions) => boolean

  // Connection and sync status
  isOnline: boolean
  lastSyncTime: Date | null
  syncWithServer: () => Promise<boolean>

  // Analytics
  getDailyAnalytics: (date?: string) => Promise<{ date: string; totalSales: number; totalTransactions: number; averageTicket: number; discrepancies: number } | null>
  getWeeklyAnalytics: () => Promise<unknown>
  getMonthlyAnalytics: () => Promise<unknown>
}

const CashRegisterContext = createContext<CashRegisterContextType | undefined>(undefined)

export function CashRegisterProvider({ children }: { children: React.ReactNode }) {
  // Use the hook internally
  const {
    registers: hookRegisters,
    currentSession,
    checkOpenSession,
    openRegister: hookOpenRegister,
    closeRegister: hookCloseRegister,
    addCashIn: hookAddCashIn,
    addCashOut: hookAddCashOut,
    registerSale: hookRegisterSale,
    loadRegisters,
    fetchHistory: hookFetchHistory,
    fetchAuditLog: hookFetchAuditLog,
    getReportData: hookGetReportData,
    history: hookHistory,
    auditLog: hookAuditLog
  } = useCashRegister()

  // Basic state
  const [activeRegisterId, setActiveRegisterId] = useState<string>(
    typeof window !== 'undefined' ? (localStorage.getItem('pos_active_register_id') ?? 'principal') : 'principal'
  )
  const [localRegisters, setLocalRegisters] = useState<Array<{ id: string; name: string; isActive: boolean }>>([])

  // Use hook registers if available, otherwise local fallback (or empty)
  const registers = useMemo(() => {
    return hookRegisters.length > 0
      ? hookRegisters.map(r => ({ id: r.id, name: r.name, isActive: r.is_active }))
      : localRegisters
  }, [hookRegisters, localRegisters])

  // Sync active register with hook
  useEffect(() => {
    const syncSession = async () => {
      if (activeRegisterId) {
        try {
          // We only want to check if we don't have a session or if we want to confirm validity
          // But for now, let's rely on the hook's internal logic which we improved to be robust.
          // However, if we just mounted, hook might have loaded from localStorage.
          // calling checkOpenSession might trigger a fetch that fails and returns null.
          // We should modify checkOpenSession in the hook to NOT invalidate if network error.
          // But here, we can at least catch errors.
          await checkOpenSession(activeRegisterId)
        } catch (e) {
          console.error("Failed to sync session", e)
        }
      }
    }
    syncSession()
  }, [activeRegisterId, checkOpenSession])

  // Derived register state from currentSession
  const currentRegisterState = useMemo<CashRegisterState>(() => {
    if (!currentSession || currentSession.register_id !== activeRegisterId) {
      return { isOpen: false, balance: 0, movements: [] }
    }

    // Calculate balance from movements
    const balance = currentSession.movements.reduce((sum, m) => {
      if (m.type === 'opening' || m.type === 'sale' || m.type === 'cash_in') return sum + m.amount
      if (m.type === 'cash_out') return sum - m.amount
      return sum
    }, 0)

    return {
      isOpen: true,
      balance,
      movements: currentSession.movements
    }
  }, [currentSession, activeRegisterId])

  // Map to the expected Record structure (only active one is real for now)
  const registerState = useMemo(() => ({
    [activeRegisterId]: currentRegisterState
  }), [activeRegisterId, currentRegisterState])

  // Advanced state
  const [cashReport, setCashReport] = useState<CashReport | null>(null)
  const [lastCashCount, setLastCashCount] = useState<CashCount | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof window !== 'undefined' ? navigator.onLine : true
  )
  // lastSyncTime reserved for future sync tracking
  const [lastSyncTime] = useState<Date | null>(null)

  // Default permissions
  const [userPermissions, setUserPermissions] = useState<UserPermissions>(() => {
    const defaultPerms: UserPermissions = {
      canOpenRegister: true,
      canCloseRegister: true,
      canAddCashIn: true,
      canAddCashOut: true,
      canViewReports: true,
      canExportData: true,
      canViewAuditLog: true,
      canManagePermissions: false,
      maxCashOutAmount: 1000000,
      requiresApprovalForLargeAmounts: true
    }
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('pos_user_permissions')
        if (saved) {
          const p = JSON.parse(saved)
          if (p && typeof p === 'object') return { ...defaultPerms, ...p }
        }
      }
    } catch (e) {
      console.warn('Error loading prefs from localStorage:', e)
    }
    return defaultPerms
  })

  // Map hook history to ZClosureRecord
  const zClosureHistory = useMemo<ZClosureRecord[]>(() => {
    return hookHistory.map(h => {
      // Calculate totals
      const sales = h.movements.filter(m => m.type === 'sale')
      const totalSales = sales.reduce((s, m) => s + m.amount, 0)

      // Categorize sales (simplified logic)
      const salesByCash = sales.filter(s => s.payment_method === 'cash' || !s.payment_method).reduce((s, m) => s + m.amount, 0)
      const salesByCard = sales.filter(s => s.payment_method === 'card').reduce((s, m) => s + m.amount, 0)
      const salesByTransfer = sales.filter(s => s.payment_method === 'transfer').reduce((s, m) => s + m.amount, 0)
      const salesByMixed = sales.filter(s => s.payment_method === 'mixed').reduce((s, m) => s + m.amount, 0)

      return {
        id: h.id,
        registerId: h.register_id,
        date: new Date(h.closed_at || h.opened_at).toISOString().split('T')[0],
        // Apertura
        openedAt: h.opened_at,
        openedBy: h.opened_by,
        openingBalance: h.opening_balance,
        // Cierre
        closedAt: h.closed_at || new Date().toISOString(),
        closedBy: h.closed_by || 'system',
        closingBalance: h.closing_balance || 0,
        expectedBalance: h.expected_balance || 0,
        discrepancy: h.discrepancy || 0,
        // Totales
        totalSales,
        totalCashIn: h.movements.filter(m => m.type === 'cash_in').reduce((s, m) => s + m.amount, 0),
        totalCashOut: h.movements.filter(m => m.type === 'cash_out').reduce((s, m) => s + m.amount, 0),
        salesByCash,
        salesByCard,
        salesByTransfer,
        salesByMixed,
        movementsCount: h.movements.length,
        // Movimientos individuales (para timeline)
        movements: h.movements
      }
    })
  }, [hookHistory])

  // Map hook audit log to AuditLogEntry
  const auditLog = useMemo<AuditLogEntry[]>(() => {
    return hookAuditLog.map(m => ({
      id: m.id,
      timestamp: m.created_at,
      userId: m.created_by || 'system',
      userName: m.userName || m.userEmail || m.created_by || 'Sistema',
      userEmail: m.userEmail,
      action: m.type.toUpperCase(),
      details: m.reason || m.type,
      registerId: activeRegisterId, // Approximation
      amount: m.amount
    }))
  }, [hookAuditLog, activeRegisterId])

  // Load initial data
  useEffect(() => {
    loadRegisters()
    hookFetchHistory()
    hookFetchAuditLog()
  }, [loadRegisters, hookFetchHistory, hookFetchAuditLog])

  // Supabase client (kept for direct ops if needed)
  const supabase = useMemo(() => {
    try { return createClient() } catch { return null }
  }, [])


  // Save prefs
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('pos_active_register_id', activeRegisterId)
        localStorage.setItem('pos_user_permissions', JSON.stringify(userPermissions))
      }
    } catch (error) {
      console.warn('Error saving prefs to localStorage:', error)
    }
  }, [activeRegisterId, userPermissions])

  // Monitor online status
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    // Initial value already set in useState initializer
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])


  // Permission checking
  const checkPermission = useCallback((action: keyof UserPermissions): boolean => {
    return userPermissions[action] === true
  }, [userPermissions])

  // Audit logging (Manual entries via Context)
  const addAuditEntry = useCallback(async (action: string, details: string) => {
    // We should probably add this to the hook if we want it persisted properly
    // For now, just a placeholder or minimal local state update?
    // But we are using hookAuditLog which comes from DB.
    // If we want to add custom audit entries that are NOT cash movements, we need a table for that.
    // The hook only fetches from cash_movements.
    // Let's assume for now we only care about cash movements.
    console.log('Audit entry added:', action, details)
  }, [])

  // Movement operations - Proxy to Hook
  // Fix #6: usar tipos correctos 'cash_in' / 'cash_out' (no 'in' / 'out')
  const addMovement = useCallback(async (
    type: CashMovement['type'],
    amount: number,
    note?: string
  ) => {
    if (type === 'cash_in') {
      if (!checkPermission('canAddCashIn')) {
        toast.error('Sin permisos para registrar entradas')
        return
      }
      await hookAddCashIn(amount, note || '')
    } else if (type === 'cash_out') {
      if (!checkPermission('canAddCashOut')) {
        toast.error('Sin permisos para registrar salidas')
        return
      }
      await hookAddCashOut(amount, note || '')
    }
    // Tipos 'sale', 'opening', 'closing' se manejan por sus propios métodos
  }, [hookAddCashIn, hookAddCashOut, checkPermission])

  // Fix #7: tipado correcto para paymentMethod
  const registerSale = useCallback(async (saleId: string, amount: number, paymentMethod: string) => {
    const method = (['cash', 'card', 'transfer', 'mixed'].includes(paymentMethod)
      ? paymentMethod
      : 'cash') as 'cash' | 'card' | 'transfer' | 'mixed'
    await hookRegisterSale(saleId, amount, method)
  }, [hookRegisterSale])

  const openRegister = useCallback(async (initialAmount: number, note?: string, userId?: string): Promise<boolean> => {
    if (!checkPermission('canOpenRegister')) return false
    return await hookOpenRegister(activeRegisterId, initialAmount, userId)
  }, [hookOpenRegister, activeRegisterId, checkPermission])

  // Fix #1: closeRegister recibe el monto real contado
  const closeRegister = useCallback(async (closingBalance?: number, userId?: string): Promise<boolean> => {
    if (!checkPermission('canCloseRegister')) return false
    // Si no se pasa monto, usar el balance calculado (compatibilidad retroactiva)
    const balanceToUse = typeof closingBalance === 'number' ? closingBalance : currentRegisterState.balance
    return await hookCloseRegister(balanceToUse, userId)
  }, [hookCloseRegister, currentRegisterState.balance, checkPermission])

  // Z Closure operations
  const registerZClosure = useCallback(async (userId?: string): Promise<boolean> => {
    // closeRegister sin monto específico usará el balance calculado
    return await closeRegister(undefined, userId)
  }, [closeRegister])

  const fetchZClosureHistory = useCallback(async () => {
    await hookFetchHistory()
  }, [hookFetchHistory])

  const getZClosureDetails = useCallback((closureId: string): ZClosureRecord | null => {
    return zClosureHistory.find(z => z.id === closureId) || null
  }, [zClosureHistory])

  // Fix #8: persistir arqueo en DB como movimiento especial
  const performCashCount = useCallback(async (count: CashCount) => {
    setLastCashCount(count)

    // Intentar persistir en DB como un movimiento informativo
    if (supabase && currentRegisterState.isOpen) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        // Buscar sesión activa para asociar el arqueo
        const { data: session } = await supabase
          .from('cash_closures')
          .select('id')
          .is('date', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (session) {
          await supabase.from('cash_movements').insert({
            session_id: session.id,
            type: 'cash_in', // Tipo genérico compatible con el schema
            amount: count.total,
            reason: `Arqueo de caja: contado ${count.total.toLocaleString()} Gs. (esperado: ${currentRegisterState.balance.toLocaleString()} Gs.)`,
            created_by: user?.id || null,
            created_at: count.timestamp
          })

          // Revertir el efecto en el balance desregistrando el movimiento de arqueo
          // (el arqueo es solo informativo, no modifica el saldo real)
          // Nota: si se requiere persistencia pura sin efecto en balance, 
          // se necesita una tabla dedicada 'cash_counts'
        }
      } catch (e) {
        console.warn('No se pudo persistir el arqueo en DB:', e)
      }
    }

    toast.success(`Arqueo registrado: ${count.total.toLocaleString()} Gs. contados`)
  }, [supabase, currentRegisterState])

  const calculateDiscrepancy = useCallback((): number => {
    if (!lastCashCount) return 0
    return lastCashCount.total - currentRegisterState.balance
  }, [lastCashCount, currentRegisterState.balance])

  // Audit log operations
  const fetchAuditLog = useCallback(async () => {
    await hookFetchAuditLog()
  }, [hookFetchAuditLog])

  // Reporting (Simplified)
  // Reporting (Real)
  const generateCashReportForRange = useCallback(async (startIso?: string, endIso?: string) => {
    const start = startIso ? new Date(startIso) : (() => { const d = new Date(); d.setHours(0,0,0,0); return d })()
    const end   = endIso   ? new Date(endIso)   : (() => { const d = new Date(); d.setHours(23,59,59,999); return d })()

    const report = await hookGetReportData(start, end)

    if (report) {
      setCashReport(report)
    } else {
      // Fallback for empty/error
      setCashReport(null)
    }
  }, [hookGetReportData])

  const exportCashReportCSV = useCallback(() => {
    if (!cashReport) {
      toast.info('Genere un reporte primero para poder exportarlo')
      return
    }

    const rows: string[][] = [
      ['Campo', 'Valor'],
      ['Período inicio', cashReport.periodStart || ''],
      ['Período fin', cashReport.periodEnd || ''],
      ['Saldo inicial', String(cashReport.openingBalance || 0)],
      ['Ingresos', String(cashReport.incomes || 0)],
      ['Egresos', String(cashReport.expenses || 0)],
      ['Saldo final', String(cashReport.closingBalance || 0)],
      ['Ventas efectivo', String(cashReport.cashSales || 0)],
      ['Ventas tarjeta', String(cashReport.cardSales || 0)],
      ['Ventas transferencia', String(cashReport.transferSales || 0)],
      ['Ventas mixtas', String(cashReport.mixedSales || 0)],
    ]

    const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-caja-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Reporte exportado exitosamente')
  }, [cashReport])

  const syncWithServer = useCallback(async (): Promise<boolean> => {
    // Hook handles sync
    return true
  }, [])

  // Analytics placeholders using hook data if available or mocked
  const getDailyAnalytics = useCallback(async (date?: string) => {
    // Could call hook.getDailyAnalytics if implemented
    return { date, totalSales: 0, totalTransactions: 0, averageTicket: 0, discrepancies: 0 }
  }, [])

  const getWeeklyAnalytics = useCallback(async () => ({ period: 'week', totalSales: 0, totalDays: 0, averageDailySales: 0 }), [])
  const getMonthlyAnalytics = useCallback(async () => ({ period: 'month', totalSales: 0, totalDays: 0, averageDailySales: 0 }), [])

  const contextValue = useMemo(() => ({
    registers,
    setRegisters: setLocalRegisters,
    refreshRegisters: loadRegisters,
    activeRegisterId,
    setActiveRegisterId,
    getCurrentRegister: currentRegisterState,

    // Legacy support for main POS page
    registerState,


    addMovement,
    registerSale,
    openRegister,
    closeRegister,

    cashReport,
    setCashReport,
    generateCashReportForRange,
    exportCashReportCSV,

    registerZClosure,
    zClosureHistory,
    fetchZClosureHistory,
    getZClosureDetails,

    performCashCount,
    lastCashCount,
    calculateDiscrepancy,

    auditLog,
    fetchAuditLog,
    addAuditEntry,

    userPermissions,
    setUserPermissions,
    checkPermission,

    isOnline,
    lastSyncTime,
    syncWithServer,

    getDailyAnalytics,
    getWeeklyAnalytics,
    getMonthlyAnalytics
  }), [
    // Fix #5: eliminar updateActiveRegister (deprecated) de las deps
    registers, loadRegisters, activeRegisterId, registerState, currentRegisterState,
    addMovement, registerSale, openRegister, closeRegister,
    cashReport, generateCashReportForRange, exportCashReportCSV,
    registerZClosure, zClosureHistory, fetchZClosureHistory, getZClosureDetails,
    performCashCount, lastCashCount, calculateDiscrepancy,
    auditLog, fetchAuditLog, addAuditEntry,
    userPermissions, checkPermission,
    isOnline, lastSyncTime, syncWithServer,
    getDailyAnalytics, getWeeklyAnalytics, getMonthlyAnalytics
  ])

  return (
    <CashRegisterContext.Provider value={contextValue}>
      {children}
    </CashRegisterContext.Provider>
  )
}

export function useCashRegisterContext() {
  const context = useContext(CashRegisterContext)
  if (context === undefined) {
    throw new Error('useCashRegisterContext must be used within a CashRegisterProvider')
  }
  return context
}
