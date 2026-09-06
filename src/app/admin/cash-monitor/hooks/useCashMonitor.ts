'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import { calculateSessionFigures, openDurationHours } from '@/lib/cash/session-figures'
import { buildSessionPeriodFilter } from '@/lib/cash/session-period-filter'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
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
  // `periodSessions` es todo lo del periodo; `sessions` es lo que ve la tabla
  // despues del filtro de diferencia. Las metricas se calculan sobre el periodo:
  // al filtrar «solo con diferencia», «Ventas Periodo» pasaba a ser «ventas de
  // las sesiones con diferencia» sin cambiar de etiqueta.
  const [periodSessions, setPeriodSessions] = useState<CashSession[]>([])
  const [sessions, setSessions] = useState<CashSession[]>([])
  // Cuantas sesiones quedaron fuera del tope de seguridad, para poder decirlo.
  const [truncatedSessions, setTruncatedSessions] = useState(0)
  // Los contadores del globito salen de la base, no de la lista: con `.limit(50)`
  // en la consulta, 60 alertas sin resolver se mostraban como menos de las que hay.
  const [alertCounts, setAlertCounts] = useState({ unresolved: 0, critical: 0 })
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
  const { organization } = useActiveOrganization()

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
    if (!supabase || !organization?.id) return

    try {
      // La consulta se arma de cero en cada pagina: reutilizar el mismo builder
      // despues de haberlo esperado es un camino conocido a resultados raros.
      const buildQuery = () => {
        let q = supabase!
          .from('cash_closures')
          .select('*', { count: 'exact' })
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false })

        q = withBranchFilter(q, selectedBranchId)

        if (filter.status && filter.status !== 'all') {
          switch (filter.status) {
            case 'open':
              q = q.is('date', null)
              break
            case 'closed':
              q = q.not('date', 'is', null)
              break
            case 'suspended':
              q = q.eq('status', 'suspended')
              break
            case 'blocked':
              q = q.eq('status', 'blocked')
              break
          }
        }
        if (filter.registerId) {
          q = q.eq('register_id', filter.registerId)
        }

        // Rango de fechas, y por que una caja abierta se lo saltea: ver
        // `lib/cash/session-period-filter`.
        const rango = buildSessionPeriodFilter(filter)

        if (rango.orExpression) {
          q = q.or(rango.orExpression)
        } else {
          if (rango.from) q = q.gte('created_at', rango.from)
          if (rango.to) q = q.lte('created_at', rango.to)
        }

        return q
      }

      // Se trae todo el periodo por paginas. Con `.limit(200)` las metricas
      // —ventas, sobrantes, faltantes— se calculaban sobre las 200 mas recientes
      // y nada avisaba: un mes con varias cajas pasa ese corte facil.
      const PAGE_SIZE = 500
      const SAFETY_CAP = 3000
      const collected: any[] = []
      let totalAvailable = 0

      for (let offset = 0; offset < SAFETY_CAP; offset += PAGE_SIZE) {
        const { data: page, error: pageError, count } = await buildQuery()
          .range(offset, offset + PAGE_SIZE - 1)

        if (pageError) throw pageError
        if (count !== null && count !== undefined) totalAvailable = count
        if (!page || page.length === 0) break

        collected.push(...page)
        if (page.length < PAGE_SIZE) break
        if (totalAvailable > 0 && collected.length >= totalAvailable) break
      }

      setTruncatedSessions(Math.max(0, totalAvailable - collected.length))

      const data = collected

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
        const now = new Date()
        const effectiveOpenedBy = s.opened_by || sessionOpenerMap[s.id] || currentUserId || null
        const discrepancy = Number(s.discrepancy) || 0

        // Las cifras salen de `lib/cash/session-figures`: alli esta explicado por
        // que un cero guardado no es lo mismo que una columna vacia.
        const figures = calculateSessionFigures(s, {
          total: mc.total,
          totalSales: mc.totalSales,
          salesCash: mc.salesCash,
          salesCard: mc.salesCard,
          salesTransfer: mc.salesTransfer,
          salesMixed: mc.salesMixed,
          cashIn: mc.cashIn,
          cashOut: mc.cashOut,
        })

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
          opening_balance: figures.openingBalance,
          closing_balance: s.closing_balance,
          current_balance: figures.currentBalance,
          expected_balance: figures.expectedBalance,
          discrepancy,
          total_sales: figures.totalSales,
          sales_by_cash: figures.salesCash,
          sales_by_card: figures.salesCard,
          sales_by_transfer: figures.salesTransfer,
          sales_by_mixed: figures.salesMixed,
          income_total: figures.incomeTotal,
          expense_total: figures.expenseTotal,
          sales_mismatch: figures.salesMismatch,
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
          // Mientras no tenga fecha de cierre, la plata sigue en la gaveta. Antes
          // se preguntaba por el `status` CRUDO de la base, que la apertura no
          // escribe —la RPC inserta sin tocarlo— mientras que el estado de arriba
          // se deriva de `date`: dos definiciones de «abierta» a tres lineas de
          // distancia, y ninguna caja abierta mostraba cuanto llevaba abierta.
          duration_hours: openDurationHours(s, now)
        }
      })

      // El periodo completo alimenta las metricas; el filtro de diferencia solo
      // recorta la tabla.
      setPeriodSessions(mapped)

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
  }, [filter, organization?.id, selectedBranchId, supabase])

  // =========================================================================
  // FETCH ALERTS
  // =========================================================================
  const fetchAlerts = useCallback(async () => {
    if (!supabase || !organization?.id) return

    try {
      // La tienda se filtra contra la columna de la propia tabla. Antes habia
      // que traer primero hasta 500 cierres y pasar sus ids: las alertas de
      // sesiones mas viejas que ese corte desaparecian de la lista sin aviso.
      let query = supabase
        .from('cash_alerts')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(200)
      query = withBranchFilter(query, selectedBranchId)

      const { data, error } = await query

      if (error) throw error
      setAlerts(data || [])

      // Conteos exactos, aparte de la lista: la lista es lo ultimo que paso, los
      // contadores son cuantas hay.
      const countQuery = (extra: (q: any) => any) => {
        let q = supabase!
          .from('cash_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .eq('is_resolved', false)
        q = withBranchFilter(q, selectedBranchId)
        return extra(q)
      }

      const [{ count: unresolved }, { count: critical }] = await Promise.all([
        countQuery((q) => q),
        countQuery((q) => q.eq('severity', 'critical')),
      ])

      setAlertCounts({ unresolved: unresolved ?? 0, critical: critical ?? 0 })
    } catch (error) {
      console.error('Error fetching alerts:', error)
    }
  }, [organization?.id, selectedBranchId, supabase])

  // =========================================================================
  // FETCH AUDIT LOG
  // =========================================================================
  const fetchAuditLog = useCallback(async () => {
    if (!supabase || !organization?.id) return

    try {
      const query = supabase
        .from('cash_admin_audit')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(100)

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
  }, [organization?.id, selectedBranchId, supabase])

  // =========================================================================
  // COMPUTE METRICS
  // =========================================================================
  const computeMetrics = useCallback(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const open = periodSessions.filter(s => s.status === 'open')
    const closedToday = periodSessions.filter(s =>
      s.status === 'closed' && s.date && new Date(s.date) >= today
    )
    const suspended = periodSessions.filter(s => s.status === 'suspended')
    const blocked = periodSessions.filter(s => s.status === 'blocked')

    const totalBalance = open.reduce((sum, s) => sum + (s.current_balance || s.opening_balance || 0), 0)
    const totalSales = periodSessions.reduce((sum, s) => sum + (s.total_sales || 0), 0)
    const salesCash = periodSessions.reduce((sum, s) => sum + (s.sales_by_cash || 0), 0)
    const salesCard = periodSessions.reduce((sum, s) => sum + (s.sales_by_card || 0), 0)
    const salesTransfer = periodSessions.reduce((sum, s) => sum + (s.sales_by_transfer || 0), 0)
    const salesMixed = periodSessions.reduce((sum, s) => sum + (s.sales_by_mixed || 0), 0)

    const closedSessions = periodSessions.filter(s => s.status !== 'open')
    const totalOver = closedSessions
      .filter(s => s.discrepancy > 0.5)
      .reduce((sum, s) => sum + s.discrepancy, 0)

    const totalShort = closedSessions
      .filter(s => s.discrepancy < -0.5)
      .reduce((sum, s) => sum + Math.abs(s.discrepancy), 0)

    const totalDiscrepancies = closedSessions.reduce((sum, s) => sum + (s.discrepancy || 0), 0)
    const perfectSessions = closedSessions.filter(s => Math.abs(s.discrepancy) < 1).length
    const sessionsWithDiff = closedSessions.filter(s => Math.abs(s.discrepancy) >= 1).length

    // De la base, no de las 50 traidas.
    const unresolvedAlerts = alertCounts.unresolved
    const criticalAlerts = alertCounts.critical

    setMetrics({
      totalRegisters: new Set(periodSessions.map(s => s.register_id)).size,
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
  }, [periodSessions, alertCounts])

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
    if (!supabase || !organization?.id) return []

    try {
      let query = supabase
        .from('cash_movements')
        .select('*')
        .eq('organization_id', organization.id)
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
  }, [organization?.id, selectedBranchId, supabase])

  // =========================================================================
  // REALTIME SUBSCRIPTIONS
  // =========================================================================
  useEffect(() => {
    if (!supabase || !organization?.id) return

    // Cada suscripcion se acota a la organizacion. Sin esto, el camino de tiempo
    // real no repetia ninguno de los filtros que si aplica la consulta inicial:
    // entraban avisos de otras sucursales, y de otras tiendas, y quedaban en la
    // lista hasta que un refresco los sacaba.
    const deLaTienda = `organization_id=eq.${organization.id}`

    // El nombre incluye la organizacion: un canal compartido entre tiendas
    // mezcla suscriptores que no tienen nada que ver entre si.
    const channel = supabase
      .channel(`cash-admin-monitor:${organization.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cash_closures',
        filter: deLaTienda,
      }, () => {
        // Refresh sessions on any change
        fetchSessions()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cash_movements',
        filter: deLaTienda,
      }, () => {
        // Refresh sessions to update movement counts
        fetchSessions()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cash_alerts',
        filter: deLaTienda,
      }, (payload) => {
        const newAlert = payload.new as CashAlert

        // La sucursal no se puede filtrar en el servidor junto con la tienda, asi
        // que se descarta aca: la lista debe contener lo mismo que devolveria un
        // refresco con el filtro puesto.
        if (selectedBranchId && newAlert.branch_id && newAlert.branch_id !== selectedBranchId) return

        setAlerts(prev => {
          if (prev.some(a => a.id === newAlert.id)) return prev
          // El contador vive aparte de la lista: sin esto el globito no se movia
          // hasta el siguiente refresco.
          setAlertCounts(counts => ({
            unresolved: counts.unresolved + 1,
            critical: counts.critical + (newAlert.severity === 'critical' ? 1 : 0),
          }))
          return [newAlert, ...prev]
        })
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
  }, [supabase, fetchSessions, organization?.id, selectedBranchId])

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
    truncatedSessions,
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
