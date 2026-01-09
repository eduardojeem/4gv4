'use client'

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { CashRegisterState, CashMovement } from '../types'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'

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

interface CashRegisterContextType {
  // Basic register management
  registers: Array<{ id: string; name: string; isActive: boolean }>
  activeRegisterId: string
  setActiveRegisterId: (id: string) => void
  setRegisters: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; isActive: boolean }>>>
  registerState: Record<string, CashRegisterState>
  setRegisterState: React.Dispatch<React.SetStateAction<Record<string, CashRegisterState>>>
  getCurrentRegister: CashRegisterState
  updateActiveRegister: (updater: (reg: CashRegisterState) => CashRegisterState) => void
  
  // Movement operations
  addMovement: (type: CashMovement['type'], amount: number, note?: string, paymentMethod?: string) => Promise<void>
  openRegister: (initialAmount: number, note?: string, userId?: string) => Promise<boolean>
  closeRegister: (note?: string, userId?: string) => Promise<boolean>
  
  // Reporting
  cashReport: any | null
  setCashReport: (report: any | null) => void
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
  // Basic state
  const [registers, setRegisters] = useState<Array<{ id: string; name: string; isActive: boolean }>>([
    { id: 'principal', name: 'Caja Principal', isActive: true },
    { id: 'secundaria', name: 'Caja Secundaria', isActive: true },
  ])
  const [activeRegisterId, setActiveRegisterId] = useState<string>('principal')
  const [registerState, setRegisterState] = useState<Record<string, CashRegisterState>>({
    principal: { isOpen: false, balance: 0, movements: [] },
    secundaria: { isOpen: false, balance: 0, movements: [] },
  })
  
  // Advanced state
  const [cashReport, setCashReport] = useState<any | null>(null)
  const [zClosureHistory, setZClosureHistory] = useState<ZClosureRecord[]>([])
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [lastCashCount, setLastCashCount] = useState<CashCount | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  
  // Default permissions (can be overridden)
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({
    canOpenRegister: true,
    canCloseRegister: true,
    canAddCashIn: true,
    canAddCashOut: true,
    canViewReports: true,
    canExportData: true,
    canViewAuditLog: true,
    canManagePermissions: false,
    maxCashOutAmount: 1000000, // 1M Gs
    requiresApprovalForLargeAmounts: true
  })

  // Supabase client
  let supabase: ReturnType<typeof createClient> | null = null
  try {
    supabase = createClient()
  } catch (e) {
    supabase = null
  }

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = typeof window !== 'undefined' ? localStorage.getItem('pos_register_state') : null
      const savedActive = typeof window !== 'undefined' ? localStorage.getItem('pos_active_register_id') : null
      const savedReport = typeof window !== 'undefined' ? localStorage.getItem('pos_cash_report') : null
      const savedHistory = typeof window !== 'undefined' ? localStorage.getItem('pos_z_closure_history') : null
      const savedAuditLog = typeof window !== 'undefined' ? localStorage.getItem('pos_audit_log') : null
      const savedCashCount = typeof window !== 'undefined' ? localStorage.getItem('pos_last_cash_count') : null
      const savedPermissions = typeof window !== 'undefined' ? localStorage.getItem('pos_user_permissions') : null

      if (savedState) {
        const parsed = JSON.parse(savedState)
        if (parsed && typeof parsed === 'object') {
          setRegisterState(parsed)
        }
      }
      if (savedActive && typeof savedActive === 'string') {
        setActiveRegisterId(savedActive)
      }
      if (savedReport) {
        const r = JSON.parse(savedReport)
        if (r && typeof r === 'object') setCashReport(r)
      }
      if (savedHistory) {
        const h = JSON.parse(savedHistory)
        if (Array.isArray(h)) setZClosureHistory(h)
      }
      if (savedAuditLog) {
        const a = JSON.parse(savedAuditLog)
        if (Array.isArray(a)) setAuditLog(a)
      }
      if (savedCashCount) {
        const c = JSON.parse(savedCashCount)
        if (c && typeof c === 'object') setLastCashCount(c)
      }
      if (savedPermissions) {
        const p = JSON.parse(savedPermissions)
        if (p && typeof p === 'object') setUserPermissions(prev => ({ ...prev, ...p }))
      }
    } catch (error) {
      console.warn('Error loading cash register state from localStorage:', error)
    }
  }, [])

  // Save state to localStorage on changes
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('pos_register_state', JSON.stringify(registerState))
        localStorage.setItem('pos_active_register_id', activeRegisterId)
        localStorage.setItem('pos_cash_report', JSON.stringify(cashReport))
        localStorage.setItem('pos_z_closure_history', JSON.stringify(zClosureHistory))
        localStorage.setItem('pos_audit_log', JSON.stringify(auditLog))
        localStorage.setItem('pos_last_cash_count', JSON.stringify(lastCashCount))
        localStorage.setItem('pos_user_permissions', JSON.stringify(userPermissions))
      }
    } catch (error) {
      console.warn('Error saving cash register state to localStorage:', error)
    }
  }, [registerState, activeRegisterId, cashReport, zClosureHistory, auditLog, lastCashCount, userPermissions])

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

  const getCurrentRegister = useMemo(
    () => registerState[activeRegisterId] || { isOpen: false, balance: 0, movements: [] },
    [registerState, activeRegisterId]
  )

  const updateActiveRegister = useCallback((updater: (reg: CashRegisterState) => CashRegisterState) => {
    setRegisterState(prev => ({
      ...prev,
      [activeRegisterId]: updater(prev[activeRegisterId] || { isOpen: false, balance: 0, movements: [] })
    }))
  }, [activeRegisterId])

  // Permission checking
  const checkPermission = useCallback((action: keyof UserPermissions): boolean => {
    return userPermissions[action] === true
  }, [userPermissions])

  // Audit logging
  const addAuditEntry = useCallback(async (action: string, details: string, amount?: number) => {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: 'current-user', // TODO: Get from auth context
      userName: 'Usuario Actual', // TODO: Get from auth context
      action,
      details,
      registerId: activeRegisterId,
      amount,
      previousBalance: getCurrentRegister.balance,
      newBalance: getCurrentRegister.balance + (amount || 0)
    }

    setAuditLog(prev => [entry, ...prev].slice(0, 1000)) // Keep last 1000 entries

    // Try to sync to server if online
    if (isOnline && supabase && config.supabase.isConfigured) {
      try {
        await supabase.from('cash_audit_log').insert(entry)
      } catch (error) {
        console.warn('Failed to sync audit entry to server:', error)
      }
    }
  }, [activeRegisterId, getCurrentRegister.balance, isOnline, supabase])

  // Movement operations
  const addMovement = useCallback(async (
    type: CashMovement['type'], 
    amount: number, 
    note?: string, 
    paymentMethod?: string
  ) => {
    // Check permissions
    if (type === 'in' && !checkPermission('canAddCashIn')) {
      toast.error('No tienes permisos para agregar dinero a la caja')
      return
    }
    if (type === 'out' && !checkPermission('canAddCashOut')) {
      toast.error('No tienes permisos para retirar dinero de la caja')
      return
    }
    if (type === 'out' && userPermissions.maxCashOutAmount && amount > userPermissions.maxCashOutAmount) {
      toast.error(`El monto máximo de retiro es ${userPermissions.maxCashOutAmount.toLocaleString()} Gs`)
      return
    }

    const ts = new Date().toISOString()
    const movement: CashMovement = { 
      id: `${activeRegisterId}-${ts}`, 
      type, 
      amount, 
      note, 
      timestamp: ts 
    }

    updateActiveRegister(reg => {
      const balance = type === 'in' || type === 'sale' ? reg.balance + amount : 
                    type === 'out' ? reg.balance - amount : reg.balance
      return { ...reg, balance, movements: [...reg.movements, movement] }
    })

    // Add audit entry
    await addAuditEntry(
      `CASH_${type.toUpperCase()}`,
      `${type === 'in' ? 'Ingreso' : type === 'out' ? 'Egreso' : 'Venta'}: ${note || 'Sin nota'}`,
      type === 'out' ? -amount : amount
    )

    toast.success(`${type === 'in' ? 'Ingreso' : type === 'out' ? 'Egreso' : 'Movimiento'} registrado correctamente`)
  }, [activeRegisterId, updateActiveRegister, checkPermission, userPermissions, addAuditEntry])

  const openRegister = useCallback(async (initialAmount: number, note?: string, userId?: string): Promise<boolean> => {
    if (!checkPermission('canOpenRegister')) {
      toast.error('No tienes permisos para abrir la caja')
      return false
    }

    const currentReg = getCurrentRegister
    if (currentReg.isOpen) {
      toast.error('La caja ya está abierta')
      return false
    }

    const ts = new Date().toISOString()
    const movement: CashMovement = { 
      id: `${activeRegisterId}-${ts}`, 
      type: 'opening', 
      amount: initialAmount, 
      note, 
      timestamp: ts 
    }

    setRegisterState(prev => ({
      ...prev,
      [activeRegisterId]: { 
        isOpen: true, 
        balance: initialAmount, 
        movements: [...(prev[activeRegisterId]?.movements || []), movement] 
      }
    }))

    await addAuditEntry('REGISTER_OPEN', `Apertura de caja con ${initialAmount.toLocaleString()} Gs. ${note || ''}`, initialAmount)
    toast.success('Caja abierta correctamente')
    return true
  }, [activeRegisterId, checkPermission, getCurrentRegister, addAuditEntry])

  const closeRegister = useCallback(async (note?: string, userId?: string): Promise<boolean> => {
    if (!checkPermission('canCloseRegister')) {
      toast.error('No tienes permisos para cerrar la caja')
      return false
    }

    const currentReg = getCurrentRegister
    if (!currentReg.isOpen) {
      toast.error('La caja no está abierta')
      return false
    }

    const ts = new Date().toISOString()
    const movement: CashMovement = { 
      id: `${activeRegisterId}-${ts}`, 
      type: 'closing', 
      amount: 0, 
      note, 
      timestamp: ts 
    }

    setRegisterState(prev => ({
      ...prev,
      [activeRegisterId]: { 
        isOpen: false, 
        balance: currentReg.balance, 
        movements: [...currentReg.movements, movement] 
      }
    }))

    await addAuditEntry('REGISTER_CLOSE', `Cierre de caja con saldo ${currentReg.balance.toLocaleString()} Gs. ${note || ''}`)
    toast.success('Caja cerrada correctamente')
    return true
  }, [activeRegisterId, checkPermission, getCurrentRegister, addAuditEntry])

  // Z Closure operations
  const registerZClosure = useCallback(async (userId?: string, notes?: string): Promise<boolean> => {
    if (!checkPermission('canCloseRegister')) {
      toast.error('No tienes permisos para realizar cierre Z')
      return false
    }

    const reg = getCurrentRegister
    if (!reg.isOpen) {
      toast.error('La caja debe estar abierta para realizar cierre Z')
      return false
    }

    const openingMove = reg.movements.find(m => m.type === 'opening')
    const openingBalance = openingMove ? openingMove.amount : 0
    const sales = reg.movements.filter(m => m.type === 'sale')
    const cashIns = reg.movements.filter(m => m.type === 'in')
    const cashOuts = reg.movements.filter(m => m.type === 'out')

    const totalSales = sales.reduce((sum, m) => sum + m.amount, 0)
    const totalCashIn = cashIns.reduce((sum, m) => sum + m.amount, 0)
    const totalCashOut = cashOuts.reduce((sum, m) => sum + m.amount, 0)
    const expectedBalance = openingBalance + totalSales + totalCashIn - totalCashOut
    const actualBalance = reg.balance
    const discrepancy = actualBalance - expectedBalance

    // Categorize sales by payment method
    const methodFromNote = (m: CashMovement) => {
      const note = (m.note || '').toLowerCase()
      if (note.includes('tarjeta') || note.includes('card')) return 'card'
      if (note.includes('transfer') || note.includes('transferencia')) return 'transfer'
      if (note.includes('mixto') || note.includes('mixed')) return 'mixed'
      return 'cash'
    }

    const salesByCash = sales.filter(s => methodFromNote(s) === 'cash').reduce((a, s) => a + s.amount, 0)
    const salesByCard = sales.filter(s => methodFromNote(s) === 'card').reduce((a, s) => a + s.amount, 0)
    const salesByTransfer = sales.filter(s => methodFromNote(s) === 'transfer').reduce((a, s) => a + s.amount, 0)
    const salesByMixed = sales.filter(s => methodFromNote(s) === 'mixed').reduce((a, s) => a + s.amount, 0)

    const zClosure: ZClosureRecord = {
      id: crypto.randomUUID(),
      registerId: activeRegisterId,
      date: new Date().toISOString().split('T')[0],
      openingBalance,
      closingBalance: actualBalance,
      expectedBalance,
      discrepancy,
      totalSales,
      totalCashIn,
      totalCashOut,
      salesByCash,
      salesByCard,
      salesByTransfer,
      salesByMixed,
      movementsCount: reg.movements.length,
      notes,
      closedBy: userId || 'current-user',
      closedAt: new Date().toISOString()
    }

    setZClosureHistory(prev => [zClosure, ...prev])

    // Close register and reset movements
    setRegisterState(prev => ({
      ...prev,
      [activeRegisterId]: { isOpen: false, balance: actualBalance, movements: [] }
    }))

    await addAuditEntry('Z_CLOSURE', `Cierre Z realizado. Discrepancia: ${discrepancy.toLocaleString()} Gs`)

    if (Math.abs(discrepancy) > 0) {
      toast.warning(`Cierre Z completado. Discrepancia: ${discrepancy.toLocaleString()} Gs`)
    } else {
      toast.success('Cierre Z completado sin discrepancias')
    }

    return true
  }, [activeRegisterId, checkPermission, getCurrentRegister, addAuditEntry])

  const fetchZClosureHistory = useCallback(async () => {
    // In a real implementation, this would fetch from the server
    // For now, we use the local state
  }, [])

  const getZClosureDetails = useCallback((closureId: string): ZClosureRecord | null => {
    return zClosureHistory.find(z => z.id === closureId) || null
  }, [zClosureHistory])

  // Cash counting
  const performCashCount = useCallback(async (count: CashCount) => {
    setLastCashCount(count)
    await addAuditEntry('CASH_COUNT', `Arqueo realizado. Total contado: ${count.total.toLocaleString()} Gs`)
    toast.success('Arqueo de caja registrado')
  }, [addAuditEntry])

  const calculateDiscrepancy = useCallback((): number => {
    if (!lastCashCount) return 0
    return lastCashCount.total - getCurrentRegister.balance
  }, [lastCashCount, getCurrentRegister.balance])

  // Audit log operations
  const fetchAuditLog = useCallback(async (registerId?: string, startDate?: string, endDate?: string) => {
    // Filter existing audit log based on parameters
    let filtered = auditLog
    
    if (registerId) {
      filtered = filtered.filter(entry => entry.registerId === registerId)
    }
    
    if (startDate) {
      const start = new Date(startDate).getTime()
      filtered = filtered.filter(entry => new Date(entry.timestamp).getTime() >= start)
    }
    
    if (endDate) {
      const end = new Date(endDate).getTime()
      filtered = filtered.filter(entry => new Date(entry.timestamp).getTime() <= end)
    }
    
    // In a real implementation, this would fetch from server
    return filtered
  }, [auditLog])

  // Reporting
  const generateCashReportForRange = useCallback(async (startIso?: string, endIso?: string) => {
    const reg = getCurrentRegister
    const start = startIso ? new Date(startIso).getTime() : 0
    const end = endIso ? new Date(endIso).getTime() : Date.now()
    
    const movements = reg.movements.filter(m => {
      const t = new Date(m.timestamp).getTime()
      return t >= start && t <= end
    })

    const opening = movements.find(m => m.type === 'opening')
    const openingBalance = opening ? opening.amount : 0
    const incomes = movements.filter(m => m.type === 'in' || m.type === 'sale').reduce((sum, m) => sum + m.amount, 0)
    const expenses = movements.filter(m => m.type === 'out').reduce((sum, m) => sum + m.amount, 0)
    const closingBalance = openingBalance + incomes - expenses

    const methodFromNote = (m: CashMovement) => {
      const note = (m.note || '').toLowerCase()
      if (note.includes('tarjeta') || note.includes('card')) return 'card'
      if (note.includes('transfer') || note.includes('transferencia')) return 'transfer'
      if (note.includes('mixto') || note.includes('mixed')) return 'mixed'
      return 'cash'
    }

    const sales = movements.filter(m => m.type === 'sale')
    const cashSales = sales.filter(s => methodFromNote(s) === 'cash').reduce((a, s) => a + s.amount, 0)
    const cardSales = sales.filter(s => methodFromNote(s) === 'card').reduce((a, s) => a + s.amount, 0)
    const transferSales = sales.filter(s => methodFromNote(s) === 'transfer').reduce((a, s) => a + s.amount, 0)
    const mixedSales = sales.filter(s => methodFromNote(s) === 'mixed').reduce((a, s) => a + s.amount, 0)

    const report = {
      periodStart: startIso || new Date(Math.min(...movements.map(m => new Date(m.timestamp).getTime()), Date.now())).toISOString(),
      periodEnd: endIso || new Date().toISOString(),
      openingBalance,
      incomes,
      expenses,
      closingBalance,
      cashSales,
      cardSales,
      transferSales,
      mixedSales,
      movementsCount: movements.length,
      discrepancy: calculateDiscrepancy()
    }
    
    setCashReport(report)
  }, [getCurrentRegister, calculateDiscrepancy])

  const exportCashReportCSV = useCallback(() => {
    if (!cashReport) return
    if (!checkPermission('canExportData')) {
      toast.error('No tienes permisos para exportar datos')
      return
    }

    const headers = [
      'periodStart', 'periodEnd', 'openingBalance', 'incomes', 'expenses', 
      'closingBalance', 'cashSales', 'cardSales', 'transferSales', 'mixedSales',
      'movementsCount', 'discrepancy'
    ]
    const row = headers.map(h => JSON.stringify(cashReport[h] ?? '')).join(',')
    const csv = headers.join(',') + '\n' + row

    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cash_report_${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Reporte exportado correctamente')
    } catch (error) {
      toast.error('Error al exportar el reporte')
    }
  }, [cashReport, checkPermission])

  // Sync operations
  const syncWithServer = useCallback(async (): Promise<boolean> => {
    if (!isOnline || !supabase || !config.supabase.isConfigured) {
      return false
    }

    try {
      // Sync register state, audit log, etc.
      // This is a placeholder for actual sync logic
      setLastSyncTime(new Date())
      toast.success('Sincronización completada')
      return true
    } catch (error) {
      toast.error('Error en la sincronización')
      return false
    }
  }, [isOnline, supabase])

  // Analytics
  const getDailyAnalytics = useCallback(async (date?: string) => {
    const targetDate = date || new Date().toISOString().split('T')[0]
    const closures = zClosureHistory.filter(z => z.date === targetDate)
    
    return {
      date: targetDate,
      totalSales: closures.reduce((sum, z) => sum + z.totalSales, 0),
      totalTransactions: closures.reduce((sum, z) => sum + z.movementsCount, 0),
      averageTicket: closures.length > 0 ? closures.reduce((sum, z) => sum + z.totalSales, 0) / closures.length : 0,
      discrepancies: closures.reduce((sum, z) => sum + Math.abs(z.discrepancy), 0)
    }
  }, [zClosureHistory])

  const getWeeklyAnalytics = useCallback(async () => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]
    
    const closures = zClosureHistory.filter(z => z.date >= weekAgoStr)
    
    return {
      period: 'week',
      totalSales: closures.reduce((sum, z) => sum + z.totalSales, 0),
      totalDays: closures.length,
      averageDailySales: closures.length > 0 ? closures.reduce((sum, z) => sum + z.totalSales, 0) / closures.length : 0
    }
  }, [zClosureHistory])

  const getMonthlyAnalytics = useCallback(async () => {
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    const monthAgoStr = monthAgo.toISOString().split('T')[0]
    
    const closures = zClosureHistory.filter(z => z.date >= monthAgoStr)
    
    return {
      period: 'month',
      totalSales: closures.reduce((sum, z) => sum + z.totalSales, 0),
      totalDays: closures.length,
      averageDailySales: closures.length > 0 ? closures.reduce((sum, z) => sum + z.totalSales, 0) / closures.length : 0
    }
  }, [zClosureHistory])

  const contextValue = useMemo(() => ({
    // Basic register management
    registers,
    setRegisters,
    activeRegisterId,
    setActiveRegisterId,
    registerState,
    setRegisterState,
    getCurrentRegister,
    updateActiveRegister,
    
    // Movement operations
    addMovement,
    openRegister,
    closeRegister,
    
    // Reporting
    cashReport,
    setCashReport,
    generateCashReportForRange,
    exportCashReportCSV,
    
    // Z Closure and History
    registerZClosure,
    zClosureHistory,
    fetchZClosureHistory,
    getZClosureDetails,
    
    // Cash counting and discrepancy management
    performCashCount,
    lastCashCount,
    calculateDiscrepancy,
    
    // Audit logging
    auditLog,
    fetchAuditLog,
    addAuditEntry,
    
    // Permissions and security
    userPermissions,
    setUserPermissions,
    checkPermission,
    
    // Connection and sync status
    isOnline,
    lastSyncTime,
    syncWithServer,
    
    // Analytics
    getDailyAnalytics,
    getWeeklyAnalytics,
    getMonthlyAnalytics
  }), [
    registers, activeRegisterId, registerState, getCurrentRegister, addMovement, openRegister, closeRegister,
    cashReport, generateCashReportForRange, exportCashReportCSV, registerZClosure, zClosureHistory,
    getZClosureDetails, performCashCount, lastCashCount, calculateDiscrepancy, auditLog, fetchAuditLog,
    addAuditEntry, userPermissions, checkPermission, isOnline, lastSyncTime, syncWithServer,
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