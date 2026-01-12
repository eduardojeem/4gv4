'use client'

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { CashRegisterState, CashMovement } from '../types'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { useCashRegister, CashRegisterSession } from '@/hooks/useCashRegister'

// Extended types for advanced features
export interface ZClosureRecord {
  id: string
  registerId: string
  date: string
  openingBalance: number
  closingBalance: number
  expectedBalance: number
  discrepancy: number
  totalSales: number
  totalCashIn: number
  totalCashOut: number
  salesByCash: number
  salesByCard: number
  salesByTransfer: number
  salesByMixed: number
  movementsCount: number
  notes?: string
  closedBy: string
  closedAt: string
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
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
  closeRegister: (note?: string, userId?: string) => Promise<boolean>

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
  getDailyAnalytics: (date?: string) => Promise<any>
  getWeeklyAnalytics: () => Promise<any>
  getMonthlyAnalytics: () => Promise<any>
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
    fetchHistory: hookFetchHistory,
    fetchAuditLog: hookFetchAuditLog,
    getDailyAnalytics: hookGetDailyAnalytics,
    getReportData: hookGetReportData,
    history: hookHistory,
    auditLog: hookAuditLog
  } = useCashRegister()

  // Basic state
  const [activeRegisterId, setActiveRegisterId] = useState<string>('principal')
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
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // Default permissions
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({
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
        openingBalance: h.opening_balance,
        closingBalance: h.closing_balance || 0,
        expectedBalance: h.expected_balance || 0,
        discrepancy: h.discrepancy || 0,
        totalSales,
        totalCashIn: h.movements.filter(m => m.type === 'cash_in').reduce((s, m) => s + m.amount, 0),
        totalCashOut: h.movements.filter(m => m.type === 'cash_out').reduce((s, m) => s + m.amount, 0),
        salesByCash,
        salesByCard,
        salesByTransfer,
        salesByMixed,
        movementsCount: h.movements.length,
        closedBy: h.closed_by || 'system',
        closedAt: h.closed_at || new Date().toISOString()
      }
    })
  }, [hookHistory])

  // Map hook audit log to AuditLogEntry
  const auditLog = useMemo<AuditLogEntry[]>(() => {
    return hookAuditLog.map(m => ({
      id: m.id,
      timestamp: m.created_at,
      userId: m.created_by || 'system',
      userName: m.created_by || 'Sistema',
      action: m.type.toUpperCase(),
      details: m.reason || m.type,
      registerId: activeRegisterId, // Approximation
      amount: m.amount
    }))
  }, [hookAuditLog, activeRegisterId])

  // Load initial data
  useEffect(() => {
    hookFetchHistory()
    hookFetchAuditLog()
  }, [hookFetchHistory, hookFetchAuditLog])

  // Supabase client (kept for direct ops if needed)
  let supabase: ReturnType<typeof createClient> | null = null
  try {
    supabase = createClient()
  } catch (e) {
    supabase = null
  }

  // Load permissions and local prefs
  useEffect(() => {
    try {
      const savedActive = typeof window !== 'undefined' ? localStorage.getItem('pos_active_register_id') : null
      const savedPermissions = typeof window !== 'undefined' ? localStorage.getItem('pos_user_permissions') : null

      if (savedActive && typeof savedActive === 'string') {
        setActiveRegisterId(savedActive)
      }
      if (savedPermissions) {
        const p = JSON.parse(savedPermissions)
        if (p && typeof p === 'object') setUserPermissions(prev => ({ ...prev, ...p }))
      }
    } catch (error) {
      console.warn('Error loading prefs from localStorage:', error)
    }
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
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      setIsOnline(navigator.onLine)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  const getCurrentRegister = currentRegisterState

  const updateActiveRegister = useCallback((updater: (reg: CashRegisterState) => CashRegisterState) => {
    // This function is tricky because state is managed by hook now.
    // We can't easily update it optimistically without hook support.
    // For now, we'll ignore it or log warning as we are moving to single source of truth.
    console.warn('updateActiveRegister is deprecated in favor of direct hook actions')
  }, [])

  // Permission checking
  const checkPermission = useCallback((action: keyof UserPermissions): boolean => {
    return userPermissions[action] === true
  }, [userPermissions])

  // Audit logging (Manual entries via Context)
  const addAuditEntry = useCallback(async (action: string, details: string, amount?: number) => {
    // We should probably add this to the hook if we want it persisted properly
    // For now, just a placeholder or minimal local state update?
    // But we are using hookAuditLog which comes from DB.
    // If we want to add custom audit entries that are NOT cash movements, we need a table for that.
    // The hook only fetches from cash_movements.
    // Let's assume for now we only care about cash movements.
    console.log('Audit entry added:', action, details)
  }, [])

  // Movement operations - Proxy to Hook
  const addMovement = useCallback(async (
    type: CashMovement['type'],
    amount: number,
    note?: string,
    paymentMethod?: string
  ) => {
    if (type === 'in') {
      if (!checkPermission('canAddCashIn')) {
        toast.error('Sin permisos')
        return
      }
      await hookAddCashIn(amount, note || '')
    } else if (type === 'out') {
      if (!checkPermission('canAddCashOut')) {
        toast.error('Sin permisos')
        return
      }
      await hookAddCashOut(amount, note || '')
    }
    // Sales are handled separately
  }, [hookAddCashIn, hookAddCashOut, checkPermission])

  const registerSale = useCallback(async (saleId: string, amount: number, paymentMethod: string) => {
    await hookRegisterSale(saleId, amount, paymentMethod as any)
  }, [hookRegisterSale])

  const openRegister = useCallback(async (initialAmount: number, note?: string, userId?: string): Promise<boolean> => {
    if (!checkPermission('canOpenRegister')) return false
    return await hookOpenRegister(activeRegisterId, initialAmount, userId)
  }, [hookOpenRegister, activeRegisterId, checkPermission])

  const closeRegister = useCallback(async (note?: string, userId?: string): Promise<boolean> => {
    if (!checkPermission('canCloseRegister')) return false
    // Note: hookCloseRegister requires closingBalance. We need to calculate it.
    const currentBalance = currentRegisterState.balance
    return await hookCloseRegister(currentBalance, userId)
  }, [hookCloseRegister, currentRegisterState.balance, checkPermission])

  // Z Closure operations
  const registerZClosure = useCallback(async (userId?: string, notes?: string): Promise<boolean> => {
    // In new model, closeRegister IS the Z Closure roughly.
    // But if we want specific logic for Z Closure (like discrepancy calculation),
    // logic is in hookCloseRegister.
    return await closeRegister(notes, userId)
  }, [closeRegister])

  const fetchZClosureHistory = useCallback(async () => {
    await hookFetchHistory()
  }, [hookFetchHistory])

  const getZClosureDetails = useCallback((closureId: string): ZClosureRecord | null => {
    return zClosureHistory.find(z => z.id === closureId) || null
  }, [zClosureHistory])

  // Cash counting
  const performCashCount = useCallback(async (count: CashCount) => {
    setLastCashCount(count)
    toast.success('Arqueo de caja registrado')
  }, [])

  const calculateDiscrepancy = useCallback((): number => {
    if (!lastCashCount) return 0
    return lastCashCount.total - currentRegisterState.balance
  }, [lastCashCount, currentRegisterState.balance])

  // Audit log operations
  const fetchAuditLog = useCallback(async (registerId?: string, startDate?: string, endDate?: string) => {
    await hookFetchAuditLog()
  }, [hookFetchAuditLog])

  // Reporting (Simplified)
  // Reporting (Real)
  const generateCashReportForRange = useCallback(async (startIso?: string, endIso?: string) => {
    let start = startIso ? new Date(startIso) : new Date()
    let end = endIso ? new Date(endIso) : new Date()

    // Default to today if no range
    if (!startIso) start.setHours(0, 0, 0, 0)
    if (!endIso) end.setHours(23, 59, 59, 999)

    const report = await hookGetReportData(start, end)

    if (report) {
      setCashReport(report)
    } else {
      // Fallback for empty/error
      setCashReport(null)
    }
  }, [hookGetReportData])

  const exportCashReportCSV = useCallback(() => {
    // ... same implementation as before or simplified
    toast.info('Exportar CSV no implementado en refactor')
  }, [])

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
    registers, activeRegisterId, registerState, currentRegisterState, updateActiveRegister,
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
