import Link from 'next/link'
import { Store } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buildCustomerRepairsHref, type CustomerRepairFilter } from '@/lib/public/customer-repairs'

export interface RepairFilterStore {
  id: string
  name: string
  slug: string
}

interface RepairStoreFilterProps {
  stores: RepairFilterStore[]
  /** Cuantos equipos hay en cada taller, por id. */
  counts: Map<string, number>
  total: number
  selectedStoreId: string | null
  /** Se conserva al cambiar de taller: filtrar por tienda no deberia resetear el estado. */
  status: CustomerRepairFilter
  baseHref: string
}

/**
 * Filtro por taller de `/mis-reparaciones`.
 *
 * Desde el marketplace la lista junta los equipos de todas las tiendas donde la
 * persona tiene ficha. Saber de cual es cada uno se resuelve con la etiqueta de
 * la tarjeta; poder mirar una sola a la vez, con esto.
 *
 * Quien lo usa decide cuando mostrarlo: dentro de una tienda no tiene sentido
 * —todo lo listado es de ella— y con un solo taller no filtra nada.
 */
export function RepairStoreFilter({
  stores,
  counts,
  total,
  selectedStoreId,
  status,
  baseHref,
}: RepairStoreFilterProps) {
  const chip = (active: boolean) =>
    cn(
      'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors',
      active
        ? 'border-primary/40 bg-primary/10 text-primary'
        : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
    )

  return (
    <nav aria-label="Filtrar por taller" className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max items-center gap-1.5">
        <Link
          href={buildCustomerRepairsHref(baseHref, status)}
          aria-current={!selectedStoreId ? 'page' : undefined}
          className={chip(!selectedStoreId)}
        >
          Todos los talleres
          <span className="tabular-nums text-[11px] opacity-70">{total}</span>
        </Link>

        {stores.map((store) => {
          const active = selectedStoreId === store.id
          return (
            <Link
              key={store.id}
              href={buildCustomerRepairsHref(baseHref, status, 1, store.slug)}
              aria-current={active ? 'page' : undefined}
              className={cn(chip(active), 'max-w-56')}
            >
              <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{store.name}</span>
              <span className="tabular-nums text-[11px] opacity-70">{counts.get(store.id) || 0}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
