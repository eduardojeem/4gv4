'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useCashMonitor } from './hooks/useCashMonitor'
import { MetricsOverview } from './components/MetricsOverview'
import { SessionsTable } from './components/SessionsTable'
import { AlertsPanel } from './components/AlertsPanel'
import { AuditTimeline } from './components/AuditTimeline'
import { SessionDetailSheet } from './components/SessionDetailSheet'
import { AdminActionDialog } from './components/AdminActionDialog'
import { SessionFilters } from './components/SessionFilters'
import { CashMonitorGuideDialog } from './components/CashMonitorGuideDialog'
import { formatCurrency } from '@/lib/currency'
import { formatRegisterName, formatUserLabel } from '@/app/dashboard/pos/lib/formatters'
import { downloadPdfReport, type PdfSection } from '@/app/dashboard/pos/lib/exportPdf'
import { downloadCsvReport } from '@/app/dashboard/pos/lib/exportCsv'
import type { CashSession, AdminAction } from './types'
import { Monitor, AlertTriangle, Shield, List, Info, FileDown, Download, RefreshCw, HelpCircle } from 'lucide-react'

export default function CashMonitorPage() {
  const { user } = useAuth()
  const {
    sessions,
    alerts,
    auditLog,
    metrics,
    loading,
    filter,
    setFilter,
    fetchSessions,
    fetchSessionMovements,
    remoteClose,
    suspendSession,
    unsuspendSession,
    blockSession,
    unblockSession,
    reopenSession,
    resolveAlert,
    markAlertRead
  } = useCashMonitor()

  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [actionDialog, setActionDialog] = useState<{
    open: boolean
    action: AdminAction | null
    session: CashSession | null
  }>({ open: false, action: null, session: null })

  const userDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Administrador'

  const handleAction = (action: AdminAction, session: CashSession) => {
    setActionDialog({ open: true, action, session })
  }

  const executeAction = async (reason: string) => {
    if (!actionDialog.action || !actionDialog.session) return

    const payload = {
      sessionId: actionDialog.session.id,
      registerId: actionDialog.session.register_id,
      reason
    }

    let success = false
    switch (actionDialog.action) {
      case 'remote_close':
        success = await remoteClose(payload)
        break
      case 'suspend':
        success = await suspendSession(payload)
        break
      case 'unsuspend':
        success = await unsuspendSession(payload)
        break
      case 'block':
        success = await blockSession(payload)
        break
      case 'unblock':
        success = await unblockSession(payload)
        break
      case 'reopen':
        success = await reopenSession(payload)
        break
    }

    if (success) {
      setActionDialog({ open: false, action: null, session: null })
    }
  }

  const unresolvedCount = alerts.filter(a => !a.is_resolved).length

  // Exportar PDF Corporativo Multi-Sección
  const handleExportPdf = () => {
    const isNetOver = metrics.totalDiscrepancies > 0.5
    const isNetShort = metrics.totalDiscrepancies < -0.5
    const openSessions = sessions.filter(s => s.status === 'open')
    const closedSessions = sessions.filter(s => s.status !== 'open')
    const pendingAlerts = alerts.filter(a => !a.is_resolved)

    const sections: PdfSection[] = []

    // Sección 1: Cajas Abiertas en Vivo
    if (openSessions.length > 0) {
      sections.push({
        title: '🟢 Cajas con Turno Abierto / En Vivo',
        description: 'Supervisión en tiempo real de cajas activas, fondos de apertura y ventas en curso.',
        headers: ['Caja / Terminal', 'Cajero Responsable', 'Apertura', 'Fondo Inicial', 'Ventas Efec.', 'Ventas Dig.', 'Total Ventas', 'Saldo Estimado Gaveta'],
        rows: openSessions.map(s => [
          formatRegisterName(s.register_id),
          formatUserLabel(s.opened_by_name || s.opened_by),
          new Date(s.created_at).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
          formatCurrency(s.opening_balance),
          formatCurrency(s.sales_by_cash || 0),
          formatCurrency((s.sales_by_card || 0) + (s.sales_by_transfer || 0) + (s.sales_by_mixed || 0)),
          formatCurrency(s.total_sales || 0),
          formatCurrency(s.current_balance || s.opening_balance)
        ]),
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 100 },
          2: { cellWidth: 70 },
          3: { halign: 'right', cellWidth: 70 },
          4: { halign: 'right', cellWidth: 65 },
          5: { halign: 'right', cellWidth: 65 },
          6: { halign: 'right', cellWidth: 70 },
          7: { halign: 'right', cellWidth: 80 }
        }
      })
    }

    // Sección 2: Historial de Turnos Cerrados y Arqueos Z
    if (closedSessions.length > 0) {
      sections.push({
        title: '🔴 Historial de Turnos Cerrados y Arqueos Z',
        description: 'Auditoría pericial de balance esperado vs. contado, sobrantes y faltantes.',
        headers: ['Caja', 'Cajero Apertura', 'Cajero Cierre', 'Fecha Cierre', 'Fondo Inicial', 'Ventas', 'Ingresos', 'Egresos', 'Esperado', 'Real Contado', 'Diferencia', 'Estado'],
        rows: closedSessions.map(s => {
          const diff = s.discrepancy || 0
          const diag = Math.abs(diff) < 1 ? '✓ EXACTO' : diff > 0.5 ? `▲ SOBRANTE (+${formatCurrency(diff)})` : `▼ FALTANTE (-${formatCurrency(Math.abs(diff))})`
          return [
            formatRegisterName(s.register_id),
            formatUserLabel(s.opened_by_name || s.opened_by),
            formatUserLabel(s.closed_by_name || s.closed_by),
            s.date ? new Date(s.date).toLocaleDateString('es-PY') : new Date(s.last_activity_at).toLocaleDateString('es-PY'),
            formatCurrency(s.opening_balance),
            formatCurrency(s.total_sales || 0),
            formatCurrency(s.income_total || 0),
            formatCurrency(s.expense_total || 0),
            formatCurrency(s.expected_balance),
            formatCurrency(s.closing_balance || 0),
            diff > 0 ? `+${formatCurrency(diff)}` : diff < 0 ? `-${formatCurrency(Math.abs(diff))}` : 'Gs. 0',
            diag
          ]
        }),
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 75 },
          2: { cellWidth: 75 },
          3: { cellWidth: 55 },
          4: { halign: 'right', cellWidth: 55 },
          5: { halign: 'right', cellWidth: 55 },
          6: { halign: 'right', cellWidth: 50 },
          7: { halign: 'right', cellWidth: 50 },
          8: { halign: 'right', cellWidth: 55 },
          9: { halign: 'right', cellWidth: 55 },
          10: { halign: 'right', cellWidth: 60 },
          11: { cellWidth: 80 }
        }
      })
    }

    // Sección 3: Alertas de Seguridad
    if (pendingAlerts.length > 0) {
      sections.push({
        title: '⚠️ Incidentes y Alertas de Control Administrativo',
        description: 'Eventos de descuadre, acceso no autorizado o transacciones sospechosas pendientes.',
        headers: ['Severidad', 'Tipo de Alerta', 'Caja', 'Fecha', 'Detalle'],
        rows: pendingAlerts.map(a => [
          a.severity.toUpperCase(),
          a.title,
          formatRegisterName(a.register_id),
          new Date(a.created_at).toLocaleString('es-PY'),
          a.description || 'Sin observaciones'
        ]),
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 120 },
          2: { cellWidth: 80 },
          3: { cellWidth: 80 },
          4: { cellWidth: 'auto' }
        }
      })
    }

    const periodLabel = filter.period === 'all'
      ? 'Historial Completo'
      : filter.period === 'today'
      ? 'Hoy (Turno actual)'
      : filter.period === 'month'
      ? 'Este Mes (Últimos 30 días)'
      : filter.period === 'year'
      ? 'Este Año (Últimos 365 días)'
      : 'Esta Semana (Últimos 7 días)'

    downloadPdfReport({
      filename: `monitor_cajas_admin_${new Date().toISOString().slice(0, 10)}`,
      title: 'Reporte Consolidado - Monitor de Cajas y Auditoría',
      subtitle: `Período Auditado: ${periodLabel} • Sucursal: ${filter.branch || 'Todas'}`,
      generatedBy: userDisplayName,
      summaryStats: [
        { label: 'Cajas Activas en Vivo:', value: metrics.openSessions },
        { label: 'Ventas Totales Período:', value: formatCurrency(metrics.totalSales) },
        { label: 'Efectivo en Ventas:', value: formatCurrency(metrics.salesCash) },
        { label: 'Medios Digitales (Tarj/QR):', value: formatCurrency(metrics.salesCard + metrics.salesTransfer + metrics.salesMixed) },
        { label: 'Arqueos Exactos (✓):', value: `${metrics.perfectSessions} turnos` },
        { label: 'Turnos con Descuadre (⚠️):', value: `${metrics.sessionsWithDiff} turnos` },
        { label: 'Dif. Acumulada Neta:', value: isNetOver ? `+${formatCurrency(metrics.totalDiscrepancies)} (Sobrante)` : isNetShort ? `-${formatCurrency(Math.abs(metrics.totalDiscrepancies))} (Faltante)` : 'Gs. 0 (Exacto)' },
        { label: 'Total Sobrantes:', value: `+${formatCurrency(metrics.totalOver)}` },
        { label: 'Total Faltantes:', value: `-${formatCurrency(metrics.totalShort)}` },
        { label: 'Alertas Activas:', value: metrics.unresolvedAlerts }
      ],
      sections
    })
  }

  // Exportar CSV
  const handleExportCsv = () => {
    const isNetOver = metrics.totalDiscrepancies > 0.5
    const isNetShort = metrics.totalDiscrepancies < -0.5
    const periodLabel = filter.period === 'all'
      ? 'Historial Completo'
      : filter.period === 'today'
      ? 'Hoy (Turno actual)'
      : filter.period === 'month'
      ? 'Este Mes (Últimos 30 días)'
      : filter.period === 'year'
      ? 'Este Año (Últimos 365 días)'
      : 'Esta Semana (Últimos 7 días)'

    downloadCsvReport({
      filename: `monitor_cajas_admin_${new Date().toISOString().slice(0, 10)}`,
      title: 'Reporte de Auditoría y Monitor de Cajas',
      subtitle: `Período: ${periodLabel}`,
      generatedBy: userDisplayName,
      summaryStats: [
        { label: 'Total Sesiones Listadas:', value: sessions.length },
        { label: 'Cajas Abiertas en Vivo:', value: metrics.openSessions },
        { label: 'Total Ventas Acumuladas:', value: formatCurrency(metrics.totalSales) },
        { label: 'Ventas en Efectivo:', value: formatCurrency(metrics.salesCash) },
        { label: 'Ventas en Tarjeta / QR:', value: formatCurrency(metrics.salesCard + metrics.salesTransfer + metrics.salesMixed) },
        { label: 'Diferencia Acumulada Neta:', value: isNetOver ? `+${formatCurrency(metrics.totalDiscrepancies)} (Sobrante)` : isNetShort ? `-${formatCurrency(Math.abs(metrics.totalDiscrepancies))} (Faltante)` : 'Gs. 0' },
        { label: 'Total Sobrantes Acumulados:', value: `+${formatCurrency(metrics.totalOver)}` },
        { label: 'Total Faltantes Acumulados:', value: `-${formatCurrency(metrics.totalShort)}` },
        { label: 'Alertas de Seguridad:', value: metrics.unresolvedAlerts }
      ],
      headers: [
        'Caja / Terminal',
        'Sucursal',
        'Estado',
        'Cajero Apertura',
        'Cajero Cierre',
        'Fecha Apertura',
        'Fecha Cierre',
        'Fondo Inicial (Gs.)',
        'Total Ventas (Gs.)',
        'Ventas Efectivo (Gs.)',
        'Ventas Tarjeta (Gs.)',
        'Ventas Transferencia/QR (Gs.)',
        'Ingresos Manuales (Gs.)',
        'Egresos / Gastos (Gs.)',
        'Saldo Esperado (Gs.)',
        'Saldo Real Contado (Gs.)',
        'Diferencia (Gs.)',
        'Diagnóstico Arqueo',
        'Total Movimientos'
      ],
      rows: sessions.map(s => {
        const diff = s.discrepancy || 0
        const isClosed = s.status === 'closed'
        const diag = !isClosed ? 'Turno en curso' : Math.abs(diff) < 1 ? 'Exacto' : diff > 0.5 ? 'Sobrante (+)' : 'Faltante (-)'
        return [
          formatRegisterName(s.register_id),
          s.branch_id || 'Principal',
          s.status === 'open' ? 'Abierta' : s.status === 'closed' ? 'Cerrada' : s.status === 'suspended' ? 'Suspendida' : 'Bloqueada',
          formatUserLabel(s.opened_by_name || s.opened_by),
          formatUserLabel(s.closed_by_name || s.closed_by),
          new Date(s.created_at).toLocaleString('es-PY'),
          s.date ? new Date(s.date).toLocaleString('es-PY') : 'En curso',
          s.opening_balance,
          s.total_sales || 0,
          s.sales_by_cash || 0,
          s.sales_by_card || 0,
          s.sales_by_transfer || 0,
          s.income_total || 0,
          s.expense_total || 0,
          s.expected_balance,
          s.closing_balance ?? s.current_balance ?? 0,
          diff,
          diag,
          s.movements_count || 0
        ]
      })
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Monitor className="h-6 w-6 text-blue-600" />
            Monitor de Cajas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control administrativo centralizado, auditoría de arqueos y supervisión en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGuideOpen(true)}
            className="h-9 gap-1.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100/60 shadow-xs"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>¿Cómo funciona?</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchSessions}
            disabled={loading}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            className="h-9 gap-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/50 shadow-xs"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Descargar PDF</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <MetricsOverview metrics={metrics} loading={loading} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="sessions" className="flex items-center gap-1.5">
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sesiones</span>
          </TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">En Vivo</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-1.5 relative">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Alertas</span>
            {unresolvedCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">
                {unresolvedCount > 9 ? '9+' : unresolvedCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Auditoría</span>
          </TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <SessionFilters filter={filter} onFilterChange={setFilter} />
          <SessionsTable
            sessions={sessions}
            loading={loading}
            onSelectSession={setSelectedSession}
            onAction={handleAction}
          />
        </TabsContent>

        {/* Live Monitor Tab */}
        <TabsContent value="live" className="space-y-4">
          <SessionFilters filter={{ ...filter, status: 'open' }} onFilterChange={setFilter} />
          <SessionsTable
            sessions={sessions.filter(s => s.status === 'open')}
            loading={loading}
            onSelectSession={setSelectedSession}
            onAction={handleAction}
            liveMode
          />
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <AlertsPanel
            alerts={alerts}
            onResolve={resolveAlert}
            onMarkRead={markAlertRead}
          />
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="space-y-4">
          <AuditTimeline entries={auditLog} />
        </TabsContent>
      </Tabs>

      {/* Session Detail Sheet */}
      <SessionDetailSheet
        session={selectedSession}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        onAction={handleAction}
        fetchMovements={fetchSessionMovements}
      />

      {/* Admin Action Confirmation Dialog */}
      <AdminActionDialog
        open={actionDialog.open}
        action={actionDialog.action}
        session={actionDialog.session}
        onConfirm={executeAction}
        onCancel={() => setActionDialog({ open: false, action: null, session: null })}
      />

      {/* Manual Interactivo y Guía Completa de Monitor de Cajas */}
      <CashMonitorGuideDialog
        open={guideOpen}
        onOpenChange={setGuideOpen}
      />
    </div>
  )
}
