'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Repair } from '@/types/repairs'

type WaitingRepair = Repair & { waitingPart: NonNullable<Repair['waitingPart']> }

/** Agrupa por proveedor, con los que llegan antes primero. */
export function groupWaitingParts(repairs: Repair[]) {
  const waiting = repairs.filter(
    (repair): repair is WaitingRepair => Boolean(repair.waitingPart) && repair.status !== 'entregado' && repair.status !== 'cancelado',
  )
  const groups = new Map<string, WaitingRepair[]>()
  for (const repair of waiting) {
    const supplier = repair.waitingPart.supplier?.trim() || 'Sin proveedor'
    groups.set(supplier, [...(groups.get(supplier) ?? []), repair])
  }
  const byDate = (a: WaitingRepair, b: WaitingRepair) =>
    (a.waitingPart.expected_on ?? '9999').localeCompare(b.waitingPart.expected_on ?? '9999')
  return [...groups.entries()]
    .map(([supplier, items]) => ({ supplier, items: items.sort(byDate) }))
    .sort((a, b) => byDate(a.items[0], b.items[0]) || a.supplier.localeCompare(b.supplier))
}

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })

/**
 * «Repuestos por llegar»: lo pedido para las reparaciones, por proveedor, para
 * hacer un solo viaje o una sola llamada. Tocar uno abre la reparación, donde
 * se marca «Llegó el repuesto».
 */
export function WaitingPartsPanel({ repairs, onOpenRepair, today = new Date().toISOString().slice(0, 10) }: {
  repairs: Repair[]
  onOpenRepair: (repair: Repair) => void
  today?: string
}) {
  const groups = useMemo(() => groupWaitingParts(repairs), [repairs])
  const [open, setOpen] = useState(false)
  const count = groups.reduce((total, group) => total + group.items.length, 0)
  if (count === 0) return null
  const late = groups.flatMap((group) => group.items).filter((repair) => repair.waitingPart.expected_on && repair.waitingPart.expected_on < today).length

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
          <Package className="h-4 w-4" />
          {count === 1 ? '1 repuesto por llegar' : `${count} repuestos por llegar`}
          {late > 0 ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">{late} atrasado{late === 1 ? '' : 's'}</span> : null}
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-amber-200/80 px-4 pb-4 pt-3 dark:border-amber-900/50">
          {groups.map((group) => (
            <div key={group.supplier}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/80">{group.supplier}</p>
              <ul className="space-y-1">
                {group.items.map((repair) => {
                  const expected = repair.waitingPart.expected_on
                  const isLate = Boolean(expected && expected < today)
                  return (
                    <li key={repair.id}>
                      <button
                        type="button"
                        onClick={() => onOpenRepair(repair)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg bg-background/80 px-3 py-2 text-left text-sm hover:bg-background"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{repair.waitingPart.name}</span>
                          <span className="text-muted-foreground"> · {repair.ticketNumber ?? 'Reparación'} · {repair.customer?.name}</span>
                        </span>
                        <span className={cn('shrink-0 text-xs font-semibold', isLate ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                          {expected ? `${isLate ? 'debía llegar' : 'llega'} el ${shortDate(expected)}` : 'sin fecha'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
