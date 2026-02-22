'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronRight, Clock, History, Smartphone, Wrench } from 'lucide-react'
import Link from 'next/link'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  recibido: { label: 'Recibido', color: 'bg-info/10 text-info' },
  diagnostico: { label: 'Diagnostico', color: 'bg-primary/10 text-primary' },
  reparacion: { label: 'En Reparacion', color: 'bg-warning/10 text-warning' },
  pausado: { label: 'Pausado', color: 'bg-warning/10 text-warning' },
  listo: { label: 'Listo', color: 'bg-success/10 text-success' },
  entregado: { label: 'Entregado', color: 'bg-muted text-muted-foreground' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive' },
}

interface Repair {
  id: string
  brand?: string
  model?: string
  device?: string
  status: string
  created_at: string
  final_cost?: number
}

interface ProfileActivityProps {
  repairs: Repair[]
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  } catch {
    return 'N/A'
  }
}

export function ProfileActivity({ repairs }: ProfileActivityProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Actividad Reciente</h2>
      </div>

      <div className="divide-y divide-border">
        {repairs.length > 0 ? (
          repairs.map((repair) => {
            const statusInfo = STATUS_CONFIG[repair.status] || {
              label: repair.status,
              color: 'bg-muted text-muted-foreground',
            }
            return (
              <Link
                key={repair.id}
                href={`/mis-reparaciones?search=${repair.id}`}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {repair.device || `${repair.brand} ${repair.model}`}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {formatDate(repair.created_at)}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn('shrink-0 border-none text-[10px] font-medium', statusInfo.color)}
                >
                  {statusInfo.label}
                </Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              </Link>
            )
          })
        ) : (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Wrench className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sin actividad reciente</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tus reparaciones apareceran aqui
            </p>
          </div>
        )}
      </div>

      {repairs.length > 0 && (
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" size="sm" className="w-full text-xs">
            <Link href="/mis-reparaciones">
              Ver todo el historial <ChevronRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
