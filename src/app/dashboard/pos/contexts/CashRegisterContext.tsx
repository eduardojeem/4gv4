'use client'

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { CashRegisterState, CashMovement } from '../types'
import { config } from '@/lib/config'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'

interface CashRegisterContextType {
  registers: Array<{ id: string; name: string }>
  activeRegisterId: string
  setActiveRegisterId: (id: string) => void
  setRegisters: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string }>>>
  registerState: Record<string, CashRegisterState>
  setRegisterState: React.Dispatch<React.SetStateAction<Record<string, CashRegisterState>>>
  getCurrentRegister: CashRegisterState
  updateActiveRegister: (updater: (reg: CashRegisterState) => CashRegisterState) => void
  addMovement: (type: CashMovement['type'], amount: number, note?: string) => void
  cashReport: CashReportData | null
  setCashReport: (report: CashReportData | null) => void
  generateCashReportForRange: (startIso?: string, endIso?: string) => Promise<void>
  exportCashReportCSV: () => void
  registerZClosure: () => Promise<void>
  cashHistory: any[]
  fetchHistory: () => Promise<void>
  openRegister: (initialAmount: number, note?: string) => void
}

export interface CashReportData {
  periodStart: string
  periodEnd: string
  openingBalance: number
  closingBalance: number
  incomes: number
  expenses: number
  cashSales: number
  cardSales: number
  transferSales: number
  mixedSales: number
  movementsCount: number
}

const CashRegisterContext = createContext<CashRegisterContextType | undefined>(undefined)

export function CashRegisterProvider({ children }: { children: React.ReactNode }) {
  const [registers, setRegisters] = useState<Array<{ id: string; name: string }>>([
    { id: 'principal', name: 'Caja Principal' },
    { id: 'secundaria', name: 'Caja Secundaria' },
  ])
  const [activeRegisterId, setActiveRegisterId] = useState<string>('principal')
  const [registerState, setRegisterState] = useState<Record<string, CashRegisterState>>({
    principal: { isOpen: false, balance: 0, movements: [] },
    secundaria: { isOpen: false, balance: 0, movements: [] },
  })

  const [cashReport, setCashReport] = useState<CashReportData | null>(null)
  const [cashHistory, setCashHistory] = useState<any[]>([])

  const fetchHistory = useCallback(async () => {
    if (config.supabase.isConfigured) {
      try {
        const supabase = createSupabaseClient()
        const { data, error } = await supabase
          .from('cash_closures')
          .select('*')
          .order('date', { ascending: false })
          .limit(50)
        
        if (error) throw error
        setCashHistory(data || [])
      } catch (e: any) {
        console.error('Error fetching cash history:', e)
        if (e?.code === '42P01') {
          console.warn('Table cash_closures does not exist. Please run migrations.')
        }
      }
    } else {
      // Demo mode
      try {
        const saved = localStorage.getItem('pos.cashClosures')
        if (saved) {
          setCashHistory(JSON.parse(saved))
        }
      } catch (e) {
        console.error('Error loading history from local storage', e)
      }
    }
  }, [])

  // Load history on mount
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Flag to track if local storage has been loaded
  const [isStateLoaded, setIsStateLoaded] = useState(false)

  // Load register state from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedState = localStorage.getItem('pos.registerState')
      if (savedState) {
        setRegisterState(JSON.parse(savedState))
      }
      const savedActiveId = localStorage.getItem('pos.activeRegisterId')
      if (savedActiveId) {
        setActiveRegisterId(savedActiveId)
      }
    } catch (e) {
      console.error('Error cargando estado de caja desde localStorage:', e)
    } finally {
      setIsStateLoaded(true)
    }
  }, [])

  // Save register state to localStorage on change (only after initial load)
  useEffect(() => {
    if (!isStateLoaded) return
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('pos.registerState', JSON.stringify(registerState))
      localStorage.setItem('pos.activeRegisterId', activeRegisterId)
    } catch (e) {
      console.error('Error guardando estado de caja en localStorage:', e)
    }
  }, [registerState, activeRegisterId, isStateLoaded])

  const getCurrentRegister = useMemo(
    () => registerState[activeRegisterId] || { isOpen: false, balance: 0, movements: [] },
    [registerState, activeRegisterId]
  )

  const updateActiveRegister = useCallback(
    (updater: (reg: CashRegisterState) => CashRegisterState) => {
      setRegisterState(prev => ({
        ...prev,
        [activeRegisterId]: updater(prev[activeRegisterId] || { isOpen: false, balance: 0, movements: [] }),
      }))
    },
    [activeRegisterId]
  )

  const addMovement = useCallback((type: CashMovement['type'], amount: number, note?: string) => {
    updateActiveRegister(prev => {
      const newBalance = type === 'out' ? prev.balance - amount : prev.balance + amount
      const newMovement: CashMovement = {
        id: crypto.randomUUID(),
        type,
        amount,
        note,
        timestamp: new Date().toISOString()
      }
      return {
        ...prev,
        balance: newBalance,
        movements: [...prev.movements, newMovement]
      }
    })
  }, [updateActiveRegister])

  const openRegister = useCallback((initialAmount: number, note?: string) => {
    updateActiveRegister(prev => {
      const newMovement: CashMovement = {
        id: crypto.randomUUID(),
        type: 'opening',
        amount: initialAmount,
        note: note || 'Apertura de caja',
        timestamp: new Date().toISOString()
      }
      return {
        ...prev,
        isOpen: true,
        balance: initialAmount,
        movements: [...prev.movements, newMovement]
      }
    })
    toast.success('Caja abierta exitosamente')
  }, [updateActiveRegister])

  const generateCashReportForRange = useCallback(async (startIso?: string, endIso?: string) => {
    try {
      const movements = getCurrentRegister.movements || []
      let lastOpeningIdx = -1
      for (let i = movements.length - 1; i >= 0; i--) {
        if (movements[i].type === 'opening') { lastOpeningIdx = i; break }
      }

      const now = endIso ? new Date(endIso) : new Date()
      const periodStartTs: Date = (() => {
        if (startIso) return new Date(startIso)
        if (lastOpeningIdx >= 0) return new Date(movements[lastOpeningIdx].timestamp)
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d
      })()

      const openingBalance = lastOpeningIdx >= 0 ? (movements[lastOpeningIdx].amount || 0) : 0
      const windowMovs = movements.filter(m => new Date(m.timestamp) >= periodStartTs)
      const incomes = windowMovs.reduce((sum, m) => sum + ((m.type === 'in' || m.type === 'sale') ? m.amount : 0), 0)
      const expenses = windowMovs.reduce((sum, m) => sum + (m.type === 'out' ? m.amount : 0), 0)
      const cashSales = windowMovs.reduce((sum, m) => sum + (m.type === 'sale' ? m.amount : 0), 0)

      // Totales por método de pago desde Supabase (día/turno actual)
      let cardSales = 0, transferSales = 0, mixedSales = 0
      if (config.supabase.isConfigured) {
        try {
          const supabase = createSupabaseClient()
          const startDate = periodStartTs.toISOString()
          const endDate = now.toISOString()
          const salesRes = await supabase
            .from('sales')
            .select('total:total_amount, payment_method, created_at')
            .gte('created_at', startDate)
            .lte('created_at', endDate)

          const rows = (salesRes.data ?? []) as Array<{ total: number | null; payment_method: string | null; created_at: string }>

          if (rows) {
            rows.forEach((r) => {
              const method = String(r.payment_method ?? '')
              const total = Number(r.total ?? 0) || 0
              if (method === 'tarjeta') cardSales += total
              else if (method === 'transferencia') transferSales += total
              else if (method === 'efectivo') { /* ya computado en cashSales */ }
              else if (method === 'mixed' || method === 'mixto' || method === 'multiple') mixedSales += total
            })
          }
        } catch (err) {
          console.error('Error fetching sales for report:', err)
        }
      }

      const closingBalance = openingBalance + incomes - expenses

      setCashReport({
        periodStart: periodStartTs.toISOString(),
        periodEnd: now.toISOString(),
        openingBalance,
        closingBalance,
        incomes,
        expenses,
        cashSales,
        cardSales,
        transferSales,
        mixedSales,
        movementsCount: windowMovs.length
      })
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Error al generar reporte')
    }
  }, [getCurrentRegister])

  const exportCashReportCSV = useCallback(() => {
    if (!cashReport) return
    const rows = [
      ['Reporte de Caja', 'Generated: ' + new Date().toLocaleString()],
      ['Periodo', `${new Date(cashReport.periodStart).toLocaleString()} - ${new Date(cashReport.periodEnd).toLocaleString()}`],
      [''],
      ['Concepto', 'Monto'],
      ['Saldo Inicial', formatCurrency(cashReport.openingBalance)],
      ['Ingresos Totales', formatCurrency(cashReport.incomes)],
      ['Egresos Totales', formatCurrency(cashReport.expenses)],
      ['Saldo Final', formatCurrency(cashReport.closingBalance)],
      [''],
      ['Detalle Ventas', ''],
      ['Efectivo', formatCurrency(cashReport.cashSales)],
      ['Tarjeta', formatCurrency(cashReport.cardSales)],
      ['Transferencia', formatCurrency(cashReport.transferSales)],
      ['Mixto', formatCurrency(cashReport.mixedSales)],
    ]

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `cierre_caja_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [cashReport])

  const registerZClosure = useCallback(async () => {
    if (!cashReport) {
      toast.error('Primero genere el reporte')
      return
    }
    
    // Persistir cierre Z en Supabase
    if (config.supabase.isConfigured) {
      try {
        const supabase = createSupabaseClient()
        await supabase.from('cash_closures').insert({
          type: 'z',
          register_id: activeRegisterId,
          date: new Date(cashReport.periodEnd).toISOString(),
          opening_balance: cashReport.openingBalance,
          closing_balance: cashReport.closingBalance,
          income_total: cashReport.incomes,
          expense_total: cashReport.expenses,
          sales_total_cash: cashReport.cashSales,
          sales_total_card: cashReport.cardSales,
          sales_total_transfer: cashReport.transferSales,
          sales_total_mixed: cashReport.mixedSales,
          movements_count: cashReport.movementsCount,
          notes: `Cierre Z: ${formatCurrency(cashReport.closingBalance)}`,
        })
      } catch (e: any) {
        toast.error(`No se pudo registrar cierre Z en BD: ${e?.message || e}`)
      }
    } else {
      // Modo demo: guardar en localStorage
      try {
        const key = 'pos.cashClosures'
        const saved = localStorage.getItem(key)
        const list = saved ? JSON.parse(saved) : []
        list.push({ ...cashReport, type: 'z', register_id: activeRegisterId, notes: `Cierre Z: ${formatCurrency(cashReport.closingBalance)}` })
        localStorage.setItem(key, JSON.stringify(list))
      } catch (e) {
        console.error('Error saving to localStorage:', e)
      }
    }

    updateActiveRegister(prev => {
      const closingMovement: CashMovement = {
        id: crypto.randomUUID(),
        type: 'closing',
        amount: cashReport.closingBalance,
        note: `Cierre Z: ${formatCurrency(cashReport.closingBalance)}`,
        timestamp: new Date().toISOString()
      }
      return {
        ...prev,
        isOpen: false,
        movements: [...prev.movements, closingMovement]
      }
    })

    toast.success('Cierre Z registrado exitosamente')
    setCashReport(null)
    fetchHistory()
  }, [cashReport, updateActiveRegister, fetchHistory])

  return (
    <CashRegisterContext.Provider value={{
      registers,
      setRegisters,
      activeRegisterId,
      setActiveRegisterId,
      registerState,
      setRegisterState,
      getCurrentRegister,
      updateActiveRegister,
      addMovement,
      cashReport,
      setCashReport,
      generateCashReportForRange,
      exportCashReportCSV,
      registerZClosure,
      cashHistory,
      fetchHistory,
      openRegister
    }}>
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
