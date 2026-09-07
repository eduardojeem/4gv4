'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Filter, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileOrders, type ProfileOrder } from './profile-orders'

type Filters = { organization: string; status: string; payment: string; from: string; to: string }
const EMPTY_FILTERS: Filters = { organization: '', status: '', payment: '', from: '', to: '' }

export function ProfileOrderHistory({ initialOrders, totalCount, tenantPrefix }: {
  initialOrders: ProfileOrder[]
  totalCount: number
  tenantPrefix: string
}) {
  const [items, setItems] = useState(initialOrders)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const requestSequence = useRef(0)
  const stores = useMemo(() => [...new Map(initialOrders.flatMap((order) => order.organization ? [[order.organization.slug, order.organization.name] as const] : [])).entries()], [initialOrders])

  const load = async (nextFilters: Filters, cursor?: string) => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setMessage('')
    try {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(nextFilters)) if (value) params.set(key, value)
      if (cursor) params.set('cursor', cursor)
      const response = await fetch(`/api/marketplace/profile/orders?${params}`, { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const body = await response.json() as { items: ProfileOrder[]; nextCursor: string | null }
      if (requestId !== requestSequence.current) return
      setItems((current) => cursor ? [...current, ...body.items] : body.items)
      setNextCursor(body.nextCursor)
      if (!cursor && body.items.length === 0) setMessage('No encontramos pedidos con esos filtros.')
    } catch {
      if (requestId !== requestSequence.current) return
      setMessage('No pudimos cargar el historial. Reintentá en unos momentos.')
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }

  const updateFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value }
    setFilters(next)
    void load(next)
  }
  const reset = () => { setFilters(EMPTY_FILTERS); void load(EMPTY_FILTERS) }
  const hasFilters = Object.values(filters).some(Boolean)

  useEffect(() => {
    void load(EMPTY_FILTERS)
  }, [])

  return <section aria-labelledby="order-history-title" className="space-y-3">
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="order-history-title" className="flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4 text-primary" /> Historial de pedidos</h2>
          <p className="mt-1 text-xs text-muted-foreground">Filtrá compras de todas tus tiendas sin mezclar información de otras cuentas.</p>
        </div>
        {hasFilters && <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={reset}><RotateCcw className="h-3.5 w-3.5" /> Limpiar</Button>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-medium">Tienda<select aria-label="Filtrar por tienda" value={filters.organization} onChange={(event) => updateFilter('organization', event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Todas</option>{stores.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select></label>
        <label className="text-xs font-medium">Estado<select aria-label="Filtrar por estado" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Todos</option><option value="PENDING">Pendiente</option><option value="CONFIRMED">Confirmado</option><option value="PREPARING">Preparando</option><option value="READY">Listo</option><option value="SHIPPED">En camino</option><option value="DELIVERED">Entregado</option><option value="CANCELLED">Cancelado</option></select></label>
        <label className="text-xs font-medium">Pago<select aria-label="Filtrar por pago" value={filters.payment} onChange={(event) => updateFilter('payment', event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="">Todos</option><option value="PENDING">Pendiente</option><option value="PARTIAL">Parcial</option><option value="PAID">Pagado</option><option value="REFUNDED">Reembolsado</option><option value="FAILED">Fallido</option></select></label>
        <label className="text-xs font-medium">Desde<input aria-label="Fecha desde" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => updateFilter('from', event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" /></label>
        <label className="text-xs font-medium">Hasta<input aria-label="Fecha hasta" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => updateFilter('to', event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" /></label>
      </div>
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted-foreground">{loading ? 'Actualizando pedidos…' : message}</p>
    </div>
    <ProfileOrders orders={items} totalCount={hasFilters ? items.length : totalCount} tenantPrefix={tenantPrefix} />
    {nextCursor && <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => void load(filters, nextCursor)}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Cargar pedidos anteriores</Button>}
  </section>
}
