'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronRight, Clock, History, Smartphone, Wrench } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'

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
  ticket_number?: string | null
  brand?: string
  model?: string
  device?: string
  status: string
  created_at: string
  final_cost?: number | null
  estimated_cost?: number | null
  paid_amount?: number | null
  payment_status?: string | null
}

interface ProfileActivityProps {
  repairs: Repair[]
  tenantPrefix?: string
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

export function ProfileActivity({ repairs, tenantPrefix = '' }: ProfileActivityProps) {
  const repairsHref = tenantPrefix ? `${tenantPrefix}/mis-reparaciones` : '/mis-reparaciones'

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
            const cost = Math.max(0, Number(repair.final_cost ?? repair.estimated_cost ?? 0))
            const paidAmount = Math.min(cost, Math.max(0, Number(repair.paid_amount || 0)))
            const isPaid = ['pagado', 'paid'].includes(String(repair.payment_status || '').toLowerCase()) || (cost > 0 && paidAmount >= cost)
            const pendingAmount = isPaid ? 0 : Math.max(0, cost - paidAmount)
            return (
              <Link
                key={repair.id}
                // La pagina de destino no lee ningun parametro `search`: acepta
                // el id o el numero de ticket como segmento de ruta. Con
                // `?search=` el link caia siempre en el buscador general,
                // ignorando la reparacion puntual en la que se hizo click.
                href={`${repairsHref}/${repair.id}`}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {repair.device || `${repair.brand} ${repair.model}`}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDate(repair.created_at)}
                    </span>
                    {repair.ticket_number && <span className="font-mono">{repair.ticket_number}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn('border-none text-[10px] font-medium', statusInfo.color)}
                    >
                      {statusInfo.label}
                    </Badge>
                    {cost > 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-none text-[10px] font-medium',
                          isPaid
                            ? 'bg-success/10 text-success'
                            : 'bg-warning/10 text-warning'
                        )}
                      >
                        {isPaid ? 'Pagado' : `Por pagar ${formatCurrency(pendingAmount)}`}
                      </Badge>
                    )}
                  </div>
                </div>
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
            <Link href={repairsHref}>
              Ver todo el historial <ChevronRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
