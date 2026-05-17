'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Shield,
  XCircle,
  PauseCircle,
  PlayCircle,
  Lock,
  Unlock,
  RotateCcw,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Settings,
  DollarSign
} from 'lucide-react'
import type { AdminAuditEntry, AdminAction } from '../types'

interface AuditTimelineProps {
  entries: AdminAuditEntry[]
}

const actionConfig: Record<AdminAction, { label: string; icon: typeof Shield; color: string }> = {
  remote_close: { label: 'Cierre Remoto', icon: XCircle, color: 'text-red-500' },
  suspend: { label: 'Suspensión', icon: PauseCircle, color: 'text-amber-500' },
  unsuspend: { label: 'Reactivación', icon: PlayCircle, color: 'text-emerald-500' },
  block: { label: 'Bloqueo', icon: Lock, color: 'text-red-600' },
  unblock: { label: 'Desbloqueo', icon: Unlock, color: 'text-blue-500' },
  reopen: { label: 'Reapertura', icon: RotateCcw, color: 'text-violet-500' },
  force_count: { label: 'Arqueo Forzado', icon: Calculator, color: 'text-orange-500' },
  approve_discrepancy: { label: 'Diferencia Aprobada', icon: CheckCircle2, color: 'text-emerald-500' },
  reject_discrepancy: { label: 'Diferencia Rechazada', icon: AlertTriangle, color: 'text-red-500' },
  manual_adjustment: { label: 'Ajuste Manual', icon: DollarSign, color: 'text-violet-500' },
  override_balance: { label: 'Override Balance', icon: DollarSign, color: 'text-orange-600' },
  config_change: { label: 'Cambio Config', icon: Settings, color: 'text-slate-500' }
}

export function AuditTimeline({ entries }: AuditTimelineProps) {
  if (entries.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-12 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-muted-foreground">Sin registros de auditoría</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Las acciones administrativas aparecerán aquí
          </p>
        </CardContent>
      </Card>
    )
  }

  // Group by date
  const grouped = entries.reduce((acc, entry) => {
    const date = new Date(entry.created_at).toLocaleDateString('es-PY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {} as Record<string, AdminAuditEntry[]>)

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-violet-500" />
          Registro de Auditoría
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            {entries.length} registros
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 max-h-[600px] overflow-y-auto">
        {Object.entries(grouped).map(([date, dayEntries]) => (
          <div key={date}>
            <div className="sticky top-0 bg-muted/50 backdrop-blur-sm px-4 py-2 border-b">
              <p className="text-xs font-semibold text-muted-foreground capitalize">{date}</p>
            </div>
            <div className="divide-y">
              {dayEntries.map((entry) => {
                const config = actionConfig[entry.action] || {
                  label: entry.action,
                  icon: Shield,
                  color: 'text-slate-500'
                }
                const Icon = config.icon

                return (
                  <div key={entry.id} className="p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{config.label}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {entry.register_id}
                          </Badge>
                        </div>
                        {entry.reason && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Motivo: {entry.reason}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                          <span>Por: {entry.performed_by_name || 'Admin'}</span>
                          <span>
                            {new Date(entry.created_at).toLocaleTimeString('es-PY', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </span>
                          {entry.ip_address && <span>IP: {entry.ip_address}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
