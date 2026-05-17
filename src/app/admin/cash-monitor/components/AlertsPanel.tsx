'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Shield,
  XCircle,
  Eye
} from 'lucide-react'
import type { CashAlert, AlertSeverity } from '../types'

interface AlertsPanelProps {
  alerts: CashAlert[]
  onResolve: (alertId: string, note: string) => Promise<boolean>
  onMarkRead: (alertId: string) => void
}

const severityConfig: Record<AlertSeverity, { color: string; icon: typeof AlertTriangle; label: string }> = {
  low: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Bell, label: 'Baja' },
  medium: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle, label: 'Media' },
  high: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: XCircle, label: 'Alta' },
  critical: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: Shield, label: 'Crítica' }
}

export function AlertsPanel({ alerts, onResolve, onMarkRead }: AlertsPanelProps) {
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; alertId: string | null }>({
    open: false,
    alertId: null
  })
  const [resolveNote, setResolveNote] = useState('')

  const unresolved = alerts.filter(a => !a.is_resolved)
  const resolved = alerts.filter(a => a.is_resolved)

  const handleResolve = async () => {
    if (!resolveDialog.alertId) return
    const success = await onResolve(resolveDialog.alertId, resolveNote)
    if (success) {
      setResolveDialog({ open: false, alertId: null })
      setResolveNote('')
    }
  }

  return (
    <div className="space-y-4">
      {/* Unresolved Alerts */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Alertas Activas
            {unresolved.length > 0 && (
              <Badge variant="destructive" className="text-xs ml-auto">
                {unresolved.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {unresolved.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3 opacity-60" />
              <p className="text-sm text-muted-foreground font-medium">Sin alertas activas</p>
              <p className="text-xs text-muted-foreground mt-1">Todo funciona correctamente</p>
            </div>
          ) : (
            <div className="divide-y">
              {unresolved.map((alert) => {
                const severity = severityConfig[alert.severity]
                const SeverityIcon = severity.icon
                return (
                  <div
                    key={alert.id}
                    className={`p-4 hover:bg-muted/30 transition-colors ${!alert.is_read ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg ${severity.color}`}>
                        <SeverityIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold truncate">{alert.title}</h4>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${severity.color}`}>
                            {severity.label}
                          </span>
                        </div>
                        {alert.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{alert.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(alert.created_at).toLocaleString('es-PY', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          <span>Caja: {alert.register_id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!alert.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onMarkRead(alert.id)}
                            title="Marcar como leída"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setResolveDialog({ open: true, alertId: alert.id })}
                        >
                          Resolver
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolved Alerts (collapsed) */}
      {resolved.length > 0 && (
        <Card className="border shadow-sm opacity-70">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Resueltas ({resolved.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {resolved.slice(0, 10).map((alert) => (
                <div key={alert.id} className="p-3 flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{alert.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Resuelta: {alert.resolved_at ? new Date(alert.resolved_at).toLocaleString('es-PY') : '-'}
                      {alert.resolution_note && ` — ${alert.resolution_note}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolve Dialog */}
      <Dialog open={resolveDialog.open} onOpenChange={(open) => {
        if (!open) setResolveDialog({ open: false, alertId: null })
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver Alerta</DialogTitle>
            <DialogDescription>
              Indique la resolución o acción tomada para esta alerta.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nota de resolución (ej: Se verificó con el cajero)"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog({ open: false, alertId: null })}>
              Cancelar
            </Button>
            <Button onClick={handleResolve} disabled={!resolveNote.trim()}>
              Resolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
