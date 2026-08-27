'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import type {
  CashSession,
  CashMovementAdmin,
  CashAlert,
  AdminAuditEntry,
  CashMonitorMetrics,
  SessionFilter,
  RemoteActionPayload
} from '../types'

export function useCashMonitor() {
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [alerts, setAlerts] = useState<CashAlert[]>([])
  const [auditLog, setAuditLog] = useState<AdminAuditEntry[]>([])
  const [metrics, setMetrics] = useState<CashMonitorMetrics>({
    totalRegisters: 0,
    openSessions: 0,
    closedToday: 0,
    suspendedSessions: 0,
    blockedSessions: 0,
    totalBalance: 0,
    totalSales: 0,
    totalDiscrepancies: 0,
    totalOver: 0,
    totalShort: 0,
    perfectSessions: 0,
    sessionsWithDiff: 0,
    salesCash: 0,
    salesCard: 0,
    salesTransfer: 0,
    salesMixed: 0,
    unresolvedAlerts: 0,
    criticalAlerts: 0
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<SessionFilter>({ status: 'all', period: 'week', discrepancy: 'all' })
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const { selectedBranchId } = useBranch()

  let supabase: ReturnType<typeof createClient> | null = null
  try {
    supabase = createClient()
  } catch {
    supabase = null
  }

  // =========================================================================
  // FETCH SESSIONS
  // =========================================================================
  const fetchSessions = useCallback(async () => {
    if (!supabase) return

    try {
      let query = supabase
        .from('cash_closures')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      query = withBranchFilter(query, selectedBranchId)

      // Apply status filter
      if (filter.status && filter.status !== 'all') {
        switch (filter.status) {
          case 'open':
            query = query.is('date', null)
            break
          case 'closed':
            query = query.not('date', 'is', null)
            break
          case 'suspended':
            query = query.eq('status', 'suspended')
            break
          case 'blocked':
            query = query.eq('status', 'blocked')
            break
        }
      }
      if (filter.registerId) {
        query = query.eq('register_id', filter.registerId)
      }

      // Period filter calculation
      let periodCutoff: Date | null = null
      const now = new Date()
      if (filter.period === 'today') {
        periodCutoff = new Date(now)
        periodCutoff.setHours(0, 0, 0, 0)
      } else if (filter.period === 'week' || !filter.period) {
        periodCutoff = new Date(now)
        periodCutoff.setDate(now.getDate() - 7)
      } else if (filter.period === 'month') {
        periodCutoff = new Date(now)
        periodCutoff.setMonth(now.getMonth() - 1)
      } else if (filter.period === 'year') {
        periodCutoff = new Date(now)
        periodCutoff.setFullYear(now.getFullYear() - 1)
      }

      if (filter.dateFrom) {
        query = query.gte('created_at', filter.dateFrom)
      } else if (periodCutoff && filter.period !== 'all') {
        query = query.gte('created_at', periodCutoff.toISOString())
      }

      if (filter.dateTo) {
        query = query.lte('created_at', filter.dateTo)
      }

      const { data, error } = await query

      if (error) throw error

      // Fetch movement counts and breakdowns per session
      const sessionIds = data?.map(s => s.id) || []
      const movementCounts: Record<string, {
        total: number
        sales: number
        salesCash: number
        salesCard: number
        salesTransfer: number
        salesMixed: number
        totalSales: number
        cashIn: number
        cashOut: number
        lastMovement: CashMovementAdmin | null
      }> = {}
      const sessionOpenerMap: Record<string, string> = {}

      if (sessionIds.length > 0) {
        let movementsQuery = supabase
          .from('cash_movements')
          .select('id, session_id, type, amount, reason, payment_method, created_by, created_at')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: true })

        movementsQuery = withBranchFilter(movementsQuery, selectedBranchId)
        const { data: movements } = await movementsQuery

        if (movements) {
          movements.forEach(m => {
            if (!movementCounts[m.session_id]) {
              movementCounts[m.session_id] = {
                total: 0,
                sales: 0,
                salesCash: 0,
                salesCard: 0,
                salesTransfer: 0,
                salesMixed: 0,
                totalSales: 0,
                cashIn: 0,
                cashOut: 0,
                lastMovement: m
              }
            } else {
              movementCounts[m.session_id].lastMovement = m
            }

            const amt = Number(m.amount) || 0
            movementCounts[m.session_id].total++

            if (m.type === 'sale' || (m.type as string) === 'venta') {
              movementCounts[m.session_id].sales++
              movementCounts[m.session_id].totalSales += amt

              const pm = m.payment_method || 'cash'
              if (pm === 'cash' || pm === 'efectivo') movementCounts[m.session_id].salesCash += amt
              else if (pm === 'card' || pm === 'tarjeta') movementCounts[m.session_id].salesCard += amt
              else if (pm === 'transfer' || pm === 'transferencia' || pm === 'qr') movementCounts[m.session_id].salesTransfer += amt
              else if (pm === 'mixed' || pm === 'mixto') movementCounts[m.session_id].salesMixed += amt
            } else if (m.type === 'cash_in' || (m.type as string) === 'ingreso') {
              movementCounts[m.session_id].cashIn += amt
            } else if (m.type === 'cash_out' || (m.type as string) === 'egreso') {
              movementCounts[m.session_id].cashOut += amt
            }

            if (m.created_by) {
              if (m.type === 'opening') {
                sessionOpenerMap[m.session_id] = m.created_by
              } else if (!sessionOpenerMap[m.session_id]) {
                sessionOpenerMap[m.session_id] = m.created_by
              }
            }
          })
        }
      }

      let currentUserId: string | null = null
      const { data: userData } = await supabase.auth.getUser()
      currentUserId = userData.user?.id || null

      const userIds = new Set<string>()
      data?.forEach(s => {
        if (s.opened_by) userIds.add(s.opened_by)
        if (s.closed_by) userIds.add(s.closed_by)
      })
      Object.values(sessionOpenerMap).forEach(uid => userIds.add(uid))
      if (currentUserId) userIds.add(currentUserId)

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const validUserIds = Array.from(userIds).filter(id => uuidRegex.test(id))

      let userMap: Record<string, string> = {}
      if (validUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', validUserIds)

        if (profiles) {
          userMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || p.email || 'Usuario'
            return acc
          }, {} as Record<string, string>)
        }
      }

      userIds.forEach(id => {
        if (!uuidRegex.test(id)) {
          userMap[id] = id === 'system' ? 'Sistema' : id
        }
      })

      let mapped: CashSession[] = (data || []).map(s => {
        const mc = movementCounts[s.id] || {
          total: 0,
          sales: 0,
          salesCash: 0,
          salesCard: 0,
          salesTransfer: 0,
          salesMixed: 0,
          totalSales: 0,
          cashIn: 0,
          cashOut: 0,
          lastMovement: null
        }
        const openedAt = new Date(s.created_at)
        const now = new Date()
        const durationHours = (now.getTime() - openedAt.getTime()) / (1000 * 60 * 60)
        const effectiveOpenedBy = s.opened_by || sessionOpenerMap[s.id] || currentUserId || null
        const discrepancy = Number(s.discrepancy) || 0

        const totalSalesDb = Number(s.total_sales) || Number(s.sales_total) || 0
        const salesCashDb = Number(s.sales_total_cash) || 0
        const salesCardDb = Number(s.sales_total_card) || 0
        const salesTransferDb = Number(s.sales_total_transfer) || 0
        const salesMixedDb = Number(s.sales_total_mixed) || 0
        const incomeTotalDb = Number(s.income_total) || 0
        const expenseTotalDb = Number(s.expense_total) || 0

        const totalSales = totalSalesDb > 0 ? totalSalesDb : (mc.totalSales > 0 ? mc.totalSales : (salesCashDb + salesCardDb + salesTransferDb + salesMixedDb))
        const salesCash = salesCashDb > 0 ? salesCashDb : mc.salesCash
        const salesCard = salesCardDb > 0 ? salesCardDb : mc.salesCard
        const salesTransfer = salesTransferDb > 0 ? salesTransferDb : mc.salesTransfer
        const salesMixed = salesMixedDb > 0 ? salesMixedDb : mc.salesMixed

        const openingBal = Number(s.opening_balance) || 0
        const incomeTotal = incomeTotalDb > 0 ? incomeTotalDb : mc.cashIn
        const expenseTotal = expenseTotalDb > 0 ? expenseTotalDb : mc.cashOut
        const currentBalance = s.closing_balance !== null && s.closing_balance !== undefined
          ? Number(s.closing_balance)
          : (openingBal + totalSales + incomeTotal - expenseTotal)

        return {
          id: s.id,
          register_id: s.register_id,
          status: (s.status === 'suspended' || s.status === 'blocked')
            ? s.status
            : (s.date ? 'closed' : 'open'),
          opened_by: effectiveOpenedBy,
          opened_by_name: effectiveOpenedBy ? userMap[effectiveOpenedBy] : undefined,
          closed_by: s.closed_by,
          closed_by_name: s.closed_by ? userMap[s.closed_by] : undefined,
          opening_balance: openingBal,
          closing_balance: s.closing_balance,
          current_balance: currentBalance,
          expected_balance: Number(s.expected_balance) || currentBalance,
          discrepancy,
          total_sales: totalSales,
          sales_by_cash: salesCash,
          sales_by_card: salesCard,
          sales_by_transfer: salesTransfer,
          sales_by_mixed: salesMixed,
          income_total: incomeTotal,
          expense_total: expenseTotal,
          branch_id: s.branch_id || selectedBranchId || 'principal',
          created_at: s.created_at,
          date: s.date,
          last_activity_at: s.last_activity_at || s.created_at,
          suspended_by: s.suspended_by,
          suspended_at: s.suspended_at,
          blocked_by: s.blocked_by,
          blocked_at: s.blocked_at,
          movements_count: mc.total,
          sales_count: mc.sales,
          last_movement: mc.lastMovement,
          duration_hours: s.status === 'open' ? Math.round(durationHours * 10) / 10 : undefined
        }
      })

      // Apply discrepancy filter in memory
      if (filter.discrepancy && filter.discrepancy !== 'all') {
        mapped = mapped.filter(s => {
          if (s.status === 'open') return true
          if (filter.discrepancy === 'perfect') return Math.abs(s.discrepancy) < 1
          if (filter.discrepancy === 'with_diff') return Math.abs(s.discrepancy) >= 1
          if (filter.discrepancy === 'over') return s.discrepancy > 0.5
          if (filter.discrepancy === 'short') return s.discrepancy < -0.5
          return true
        })
      }

      setSessions(mapped)
    } catch (error) {
      console.error('Error fetching sessions:', error)
      toast.error('Error al cargar sesiones de caja')
    }
  }, [filter, selectedBranchId, supabase])

  // =========================================================================
  // FETCH ALERTS
  // =========================================================================
  const fetchAlerts = useCallback(async () => {
    if (!supabase) return

    try {
      let query = supabase
        .from('cash_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (selectedBranchId) {
        const { data: branchSessions, error: sessionsError } = await supabase
          .from('cash_closures')
          .select('id')
          .eq('branch_id', selectedBranchId)
          .limit(500)

        if (sessionsError) throw sessionsError

        const sessionIds = (branchSessions || []).map((session) => session.id)
        if (sessionIds.length === 0) {
          setAlerts([])
          return
        }

        query = query.in('session_id', sessionIds)
      }

      const { data, error } = await query

      if (error) throw error
      setAlerts(data || [])
    } catch (error) {
      console.error('Error fetching alerts:', error)
    }
  }, [selectedBranchId, supabase])

  // =========================================================================
  // FETCH AUDIT LOG
  // =========================================================================
  const fetchAuditLog = useCallback(async () => {
    if (!supabase) return

    try {
      let query = supabase
        .from('cash_admin_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (selectedBranchId) {
        const { data: branchSessions, error: sessionsError } = await supabase
          .from('cash_closures')
          .select('id')
          .eq('branch_id', selectedBranchId)
          .limit(500)

        if (sessionsError) throw sessionsError

        const sessionIds = (branchSessions || []).map((session) => session.id)
        if (sessionIds.length === 0) {
          setAuditLog([])
          return
        }

        query = query.in('session_id', sessionIds)
      }

      const { data, error } = await query

      if (error) throw error

      // Resolve user names
      const userIds = new Set<string>()
      data?.forEach(a => { if (a.performed_by) userIds.add(a.performed_by) })

      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const validIds = Array.from(userIds).filter(id => uuidPattern.test(id))

      let userMap: Record<string, string> = {}
      if (validIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', validIds)

        if (profiles) {
          userMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || p.email || 'Admin'
            return acc
          }, {} as Record<string, string>)
        }
      }

      const mapped: AdminAuditEntry[] = (data || []).map(a => ({
        ...a,
        performed_by_name: userMap[a.performed_by] || 'Admin'
      }))

      setAuditLog(mapped)
    } catch (error) {
      console.error('Error fetching audit log:', error)
    }
  }, [selectedBranchId, supabase])

  // =========================================================================
  // COMPUTE METRICS
  // =========================================================================
  const computeMetrics = useCallback(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const open = sessions.filter(s => s.status === 'open')
    const closedToday = sessions.filter(s =>
      s.status === 'closed' && s.date && new Date(s.date) >= today
    )
    const suspended = sessions.filter(s => s.status === 'suspended')
    const blocked = sessions.filter(s => s.status === 'blocked')

    const totalBalance = open.reduce((sum, s) => sum + (s.current_balance || s.opening_balance || 0), 0)
    const totalSales = sessions.reduce((sum, s) => sum + (s.total_sales || 0), 0)
    const salesCash = sessions.reduce((sum, s) => sum + (s.sales_by_cash || 0), 0)
    const salesCard = sessions.reduce((sum, s) => sum + (s.sales_by_card || 0), 0)
    const salesTransfer = sessions.reduce((sum, s) => sum + (s.sales_by_transfer || 0), 0)
    const salesMixed = sessions.reduce((sum, s) => sum + (s.sales_by_mixed || 0), 0)

    const closedSessions = sessions.filter(s => s.status !== 'open')
    const totalOver = closedSessions
      .filter(s => s.discrepancy > 0.5)
      .reduce((sum, s) => sum + s.discrepancy, 0)

    const totalShort = closedSessions
      .filter(s => s.discrepancy < -0.5)
      .reduce((sum, s) => sum + Math.abs(s.discrepancy), 0)

    const totalDiscrepancies = closedSessions.reduce((sum, s) => sum + (s.discrepancy || 0), 0)
    const perfectSessions = closedSessions.filter(s => Math.abs(s.discrepancy) < 1).length
    const sessionsWithDiff = closedSessions.filter(s => Math.abs(s.discrepancy) >= 1).length

    const unresolvedAlerts = alerts.filter(a => !a.is_resolved).length
    const criticalAlerts = alerts.filter(a => !a.is_resolved && a.severity === 'critical').length

    setMetrics({
      totalRegisters: new Set(sessions.map(s => s.register_id)).size,
      openSessions: open.length,
      closedToday: closedToday.length,
      suspendedSessions: suspended.length,
      blockedSessions: blocked.length,
      totalBalance,
      totalSales,
      totalDiscrepancies,
      totalOver,
      totalShort,
      perfectSessions,
      sessionsWithDiff,
      salesCash,
      salesCard,
      salesTransfer,
      salesMixed,
      unresolvedAlerts,
      criticalAlerts
    })
  }, [sessions, alerts])

  useEffect(() => {
    computeMetrics()
  }, [computeMetrics])

  // =========================================================================
  // ADMIN ACTIONS
  // =========================================================================

  const performAdminAction = useCallback(async (
    action: string,
    payload: RemoteActionPayload
  ) => {
    if (!supabase) return false

    try {
      const response = await fetch('/api/admin/cash-monitor/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: payload.sessionId,
          action,
          reason: payload.reason,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Acción fallida')
      }

      toast.success(`Acción "${action}" ejecutada correctamente`)
      await fetchSessions()
      await fetchAuditLog()
      return true
    } catch (error: unknown) {
      console.error('Error performing admin action:', error)
      const msg = error instanceof Error ? error.message : 'Acción fallida'
      toast.error(`Error: ${msg}`)
      return false
    }
  }, [supabase, fetchSessions, fetchAuditLog])

  // Specific action shortcuts
  const remoteClose = useCallback((payload: RemoteActionPayload) =>
    performAdminAction('remote_close', payload), [performAdminAction])

  const suspendSession = useCallback((payload: RemoteActionPayload) =>
    performAdminAction('suspend', payload), [performAdminAction])

  const unsuspendSession = useCallback((payload: RemoteActionPayload) =>
    performAdminAction('unsuspend', payload), [performAdminAction])

  const blockSession = useCallback((payload: RemoteActionPayload) =>
    performAdminAction('block', payload), [performAdminAction])

  const unblockSession = useCallback((payload: RemoteActionPayload) =>
    performAdminAction('unblock', payload), [performAdminAction])

  const reopenSession = useCallback((payload: RemoteActionPayload) =>
    performAdminAction('reopen', payload), [performAdminAction])

  // =========================================================================
  // RESOLVE ALERT
  // =========================================================================
  const resolveAlert = useCallback(async (alertId: string, note: string) => {
    if (!supabase) return false

    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      const { error } = await supabase
        .from('cash_alerts')
        .update({
          is_resolved: true,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
          resolution_note: note
        })
        .eq('id', alertId)

      if (error) throw error

      toast.success('Alerta resuelta')
      await fetchAlerts()
      return true
    } catch (error) {
      console.error('Error resolving alert:', error)
      toast.error('Error al resolver alerta')
      return false
    }
  }, [supabase, fetchAlerts])

  // Mark alert as read
  const markAlertRead = useCallback(async (alertId: string) => {
    if (!supabase) return

    await supabase
      .from('cash_alerts')
      .update({ is_read: true })
      .eq('id', alertId)

    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a))
  }, [supabase])

  // =========================================================================
  // FETCH SESSION MOVEMENTS (for detail view)
  // =========================================================================
  const fetchSessionMovements = useCallback(async (sessionId: string): Promise<CashMovementAdmin[]> => {
    if (!supabase) return []

    try {
      let query = supabase
        .from('cash_movements')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

      query = withBranchFilter(query, selectedBranchId)
      const { data, error } = await query

      if (error) throw error

      // Resolve user names
      const userIds = new Set<string>()
      data?.forEach(m => { if (m.created_by) userIds.add(m.created_by) })

      const uuidCheck = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const validMovUserIds = Array.from(userIds).filter(id => uuidCheck.test(id))

      let userMap: Record<string, string> = {}
      if (validMovUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', validMovUserIds)

        if (profiles) {
          userMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || p.email || 'Usuario'
            return acc
          }, {} as Record<string, string>)
        }
      }

      // Map non-UUID identifiers
      userIds.forEach(id => {
        if (!uuidCheck.test(id) && !userMap[id]) {
          userMap[id] = id === 'system' ? 'Sistema' : id
        }
      })

      return (data || []).map(m => ({
        ...m,
        created_by_name: m.created_by ? (userMap[m.created_by] || m.created_by) : undefined
      }))
    } catch (error) {
      console.error('Error fetching movements:', error)
      return []
    }
  }, [selectedBranchId, supabase])

  // =========================================================================
  // REALTIME SUBSCRIPTIONS
  // =========================================================================
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('cash-admin-monitor')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cash_closures'
      }, () => {
        // Refresh sessions on any change
        fetchSessions()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cash_movements'
      }, () => {
        // Refresh sessions to update movement counts
        fetchSessions()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cash_alerts'
      }, (payload) => {
        // Add new alert to state
        const newAlert = payload.new as CashAlert
        setAlerts(prev => [newAlert, ...prev])
        toast.warning(`Nueva alerta: ${newAlert.title}`, {
          duration: 8000
        })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase!.removeChannel(channelRef.current)
      }
    }
  }, [supabase, fetchSessions])

  // =========================================================================
  // INITIAL LOAD
  // =========================================================================
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([
        fetchSessions(),
        fetchAlerts(),
        fetchAuditLog()
      ])
      setLoading(false)
    }
    loadAll()
  }, [fetchSessions, fetchAlerts, fetchAuditLog])

  // Refresh on filter change
  useEffect(() => {
    fetchSessions()
  }, [filter, fetchSessions])

  return {
    // Data
    sessions,
    alerts,
    auditLog,
    metrics,
    loading,
    filter,

    // Actions
    setFilter,
    fetchSessions,
    fetchAlerts,
    fetchAuditLog,
    fetchSessionMovements,

    // Admin actions
    remoteClose,
    suspendSession,
    unsuspendSession,
    blockSession,
    unblockSession,
    reopenSession,

    // Alert actions
    resolveAlert,
    markAlertRead
  }
}
