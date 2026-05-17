'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useCashMonitor } from './hooks/useCashMonitor'
import { MetricsOverview } from './components/MetricsOverview'
import { SessionsTable } from './components/SessionsTable'
import { AlertsPanel } from './components/AlertsPanel'
import { AuditTimeline } from './components/AuditTimeline'
import { SessionDetailSheet } from './components/SessionDetailSheet'
import { AdminActionDialog } from './components/AdminActionDialog'
import { SessionFilters } from './components/SessionFilters'
import type { CashSession, AdminAction } from './types'
import { Monitor, AlertTriangle, Shield, List } from 'lucide-react'

export default function CashMonitorPage() {
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
  const [actionDialog, setActionDialog] = useState<{
    open: boolean
    action: AdminAction | null
    session: CashSession | null
  }>({ open: false, action: null, session: null })

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Monitor className="h-6 w-6 text-blue-600" />
            Monitor de Cajas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control administrativo centralizado en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          {metrics.criticalAlerts > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {metrics.criticalAlerts} alertas críticas
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {metrics.openSessions} cajas abiertas
          </Badge>
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
    </div>
  )
}
