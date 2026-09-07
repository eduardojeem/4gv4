'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronRight, Clock, Smartphone, Store, Wrench } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/currency'
import { customerRepairHref, customerRepairsListHref } from '@/lib/public/store-scoped-href'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  recibido: { label: 'Recibido', color: 'bg-info/10 text-info' },
  diagnostico: { label: 'Diagnostico', color: 'bg-primary/10 text-primary' },
  reparacion: { label: 'En Reparacion', color: 'bg-warning/10 text-warning' },
  pausado: { label: 'Pausado', color: 'bg-warning/10 text-warning' },
  listo: { label: 'Listo', color: 'bg-success/10 text-success' },
  entregado: { label: 'Entregado', color: 'bg-muted text-muted-foreground' },
  cancelado: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive' },
}

export interface RepairStoreInfo {
  id: string
  name: string
  slug: string
  logo_url?: string | null
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
  organization?: RepairStoreInfo | null
}

interface ProfileActivityProps {
  repairs: Repair[]
  tenantPrefix?: string
  hideWhenEmpty?: boolean
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

export function ProfileActivity({ repairs, tenantPrefix = '', hideWhenEmpty = false }: ProfileActivityProps) {
  // El "ver todo" no puede llevar tienda: junta las de todas.
  const repairsHref = customerRepairsListHref(null, tenantPrefix)
  if (hideWhenEmpty && repairs.length === 0) return null

  // De que taller es cada equipo solo aporta fuera de una tienda. Adentro, todo
  // lo listado es de ella: la etiqueta se repetiria igual en cada fila y el
  // boton llevaria a donde ya estas.
  const showStore = !tenantPrefix

  if (hideWhenEmpty && repairs.length === 0) return null

  return (
    <section id="reparaciones" aria-labelledby="recent-repairs-title" className="overflow-hidden rounded-xl border border-border bg-card scroll-mt-20">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <h2 id="recent-repairs-title" className="text-sm font-semibold text-foreground">Reparaciones recientes</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Estado y pagos de tus últimos equipos.</p>
          </div>
        </div>
        {repairs.length > 0 && (
          <Badge variant="secondary" className="shrink-0 text-[11px]">
            {repairs.length} {repairs.length === 1 ? 'equipo' : 'equipos'}
          </Badge>
        )}
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
            // El detalle se autoriza contra la tienda de la reparacion: desde el
            // marketplace, sin ese slug, la pantalla queda vacia.
            const detailHref = customerRepairHref(
              repair.organization?.slug,
              tenantPrefix,
              repair.ticket_number || repair.id
            )
            return (
              <div
                key={repair.id}
                className="group flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
              >
                <Link
                  href={detailHref}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
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
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn('border-none text-[10px] font-medium', statusInfo.color)}
                      >
                        {statusInfo.label}
                      </Badge>
                      {showStore && repair.organization && (
                        <span className="inline-flex max-w-full items-center gap-1 text-[11px] text-muted-foreground">
                          <Store className="h-3 w-3 text-primary" />
                          <span className="truncate">{repair.organization.name}</span>
                        </span>
                      )}
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
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  {showStore && repair.organization && (
                    <Button asChild variant="ghost" size="sm" className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground hidden sm:inline-flex">
                      <Link href={`/${repair.organization.slug}/inicio`} title="Ver taller o tienda">
                        <Store className="h-3.5 w-3.5 mr-1 text-primary" />
                        Taller
                      </Link>
                    </Button>
                  )}
                  <Link
                    href={detailHref}
                    aria-label={`Ver reparación ${repair.ticket_number || repair.device || repair.id}`}
                    className="rounded-md p-1 text-muted-foreground/50 transition-colors group-hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )
          })
        ) : (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Wrench className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Todavía no tenés reparaciones</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cuando dejes un equipo en un taller, podrás seguirlo desde acá.
            </p>
          </div>
        )}
      </div>

      {repairs.length > 0 && (
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" size="sm" className="w-full text-xs">
            <Link href={repairsHref}>
              Ver todas las reparaciones <ChevronRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  )
}
