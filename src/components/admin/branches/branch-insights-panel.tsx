'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Banknote, ClipboardList, Loader2, PackageX, Receipt, RefreshCw, TrendingDown, TrendingUp, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BranchInsights } from '@/lib/admin/branch-insights'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  efectivo: 'Efectivo',
  card: 'Tarjeta',
  tarjeta: 'Tarjeta',
  transfer: 'Transferencia',
  transferencia: 'Transferencia',
  qr: 'QR',
  credit: 'Crédito',
  credito: 'Crédito',
  mixed: 'Mixto',
  mixto: 'Mixto',
  store_credit: 'Saldo a favor',
  otro: 'Otro',
}

const money = (value: number) =>
  new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value || 0)

function relativeTime(iso: string | null) {
  if (!iso) return 'Sin ventas todavía'
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'Recién'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  return `Hace ${Math.round(hours / 24)} días`
}

function weekday(date: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-PY', { weekday: 'short', timeZone }).format(new Date(`${date}T12:00:00Z`)).replace('.', '')
}

/**
 * Cómo anda la sucursal hoy y en el mes, con datos que antes no estaban:
 * ventas sin anuladas, comparación con el mes pasado, medios de pago, lo que
 * más sale, cajas, stock en alerta, reparaciones y pedidos abiertos.
 */
export function BranchInsightsPanel({ branchId, open }: { branchId: string; open: boolean }) {
  const [insights, setInsights] = useState<BranchInsights | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open || !branchId) return
    let ignore = false
    void Promise.resolve()
      .then(async () => {
        if (ignore) return
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/admin/branches/${branchId}/insights`, { cache: 'no-store' })
        const payload = await response.json().catch(() => null) as { insights?: BranchInsights; error?: string } | null
        if (!response.ok || !payload?.insights) throw new Error(payload?.error || 'No se pudo cargar el detalle de la sucursal.')
        if (!ignore) setInsights(payload.insights)
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle de la sucursal.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => { ignore = true }
  }, [branchId, open, attempt])

  if (!insights) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
        {error ? <span className="text-destructive">{error}</span> : <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando el detalle de la sucursal…</span>}
        {error ? <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>Reintentar</Button> : null}
      </div>
    )
  }

  const { sales, cash, inventory, repairs, orders } = insights
  const maxDay = Math.max(1, ...sales.last7Days.daily.map((day) => day.total))
  const mixTotal = sales.paymentMix.reduce((total, entry) => total + entry.total, 0) || 1
  const change = sales.monthChangePct

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Ventas</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" aria-label="Actualizar el detalle">
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> {relativeTime(sales.lastSaleAt) === 'Sin ventas todavía' ? 'Sin ventas todavía' : `Última venta: ${relativeTime(sales.lastSaleAt).toLowerCase()}`}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Hoy" value={money(sales.today.total)} helper={`${sales.today.count} venta${sales.today.count === 1 ? '' : 's'}`} />
          <Tile label="Últimos 7 días" value={money(sales.last7Days.total)} helper={`${sales.last7Days.count} ventas`} />
          <Tile
            label="Este mes"
            value={money(sales.month.total)}
            helper={change === null ? `${sales.month.count} ventas` : `${change >= 0 ? '+' : ''}${change}% vs. mismo tramo del mes pasado`}
            tone={change === null ? undefined : change >= 0 ? 'up' : 'down'}
          />
          <Tile label="Ticket promedio" value={money(sales.averageTicket)} helper="Del mes, sin anuladas" />
        </div>

        <div className="rounded-lg border p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Ventas por día (7 días)</p>
          <div className="flex h-24 items-end gap-2" role="img" aria-label="Ventas de los últimos 7 días">
            {sales.last7Days.daily.map((day, index) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1" title={`${day.date}: ${money(day.total)}`}>
                <div className={cn('w-full max-w-8 rounded-t bg-primary', index === 6 ? 'opacity-100' : 'opacity-50')} style={{ height: `${Math.max(4, (day.total / maxDay) * 72)}px` }} />
                <span className="text-[10px] uppercase text-muted-foreground">{weekday(day.date, insights.timeZone)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2 rounded-lg border p-4">
          <p className="text-sm font-semibold">Medios de pago del mes</p>
          {sales.paymentMix.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas este mes.</p> : sales.paymentMix.map((entry) => (
            <div key={entry.method} className="space-y-1">
              <div className="flex justify-between text-xs"><span>{PAYMENT_LABELS[entry.method] ?? entry.method}</span><span className="font-medium">{money(entry.total)}</span></div>
              <div className="h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${(entry.total / mixTotal) * 100}%` }} /></div>
            </div>
          ))}
        </section>

        <section className="space-y-2 rounded-lg border p-4">
          <p className="text-sm font-semibold">Lo que más se vende este mes</p>
          {sales.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">Sin productos vendidos este mes.</p> : (
            <ol className="space-y-1.5">
              {sales.topProducts.map((product, index) => (
                <li key={product.productId} className="flex items-center gap-2 text-sm">
                  <span className="w-4 text-xs text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{product.name}</span>
                  <span className="text-xs text-muted-foreground">{product.quantity} u.</span>
                  <span className="w-28 text-right font-medium">{money(product.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Operación</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile icon={Banknote} label="Cajas abiertas" value={`${cash.openCount} de ${cash.registers.length}`} helper={cash.registers.filter((r) => r.isOpen).map((r) => r.name).join(', ') || 'Todas cerradas'} />
          <Tile icon={ClipboardList} label="Pedidos abiertos" value={String(orders.open)} helper={orders.open ? money(orders.openTotal) : 'Nada pendiente'} tone={orders.open ? 'warn' : undefined} />
          <Tile icon={Wrench} label="Reparaciones en curso" value={String(repairs.active)} helper={`${repairs.ready} listas para entregar · ${repairs.deliveredThisMonth} entregadas este mes`} />
          <Tile icon={PackageX} label="Stock en alerta" value={String(inventory.lowStock + inventory.outOfStock)} helper={`${inventory.outOfStock} sin stock · ${inventory.lowStock} bajo mínimo`} tone={inventory.outOfStock ? 'down' : inventory.lowStock ? 'warn' : undefined} />
        </div>
      </section>

      {inventory.alerts.length > 0 && (
        <section className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" />Productos para reponer</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {inventory.alerts.map((item) => (
              <li key={item.productId} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className={cn('shrink-0 text-xs font-medium', item.stock <= 0 ? 'text-destructive' : 'text-amber-700 dark:text-amber-400')}>
                  {item.stock <= 0 ? 'Sin stock' : `${item.stock} (mín. ${item.minStock})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cash.registers.length > 0 && (
        <section className="space-y-2 rounded-lg border p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Receipt className="h-4 w-4" />Cajas</p>
          <ul className="divide-y">
            {cash.registers.map((register) => (
              <li key={register.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', register.isOpen ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                  {register.name}
                </span>
                <span className="text-xs text-muted-foreground">{register.isOpen ? `Abierta · saldo ${money(register.balance)}` : 'Cerrada'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-muted-foreground">
        {inventory.trackedProducts} productos con stock en esta sucursal ({inventory.units} unidades). Las ventas anuladas no se cuentan.
      </p>
    </div>
  )
}

function Tile({ label, value, helper, icon: Icon, tone }: { label: string; value: string; helper: string; icon?: typeof Banknote; tone?: 'up' | 'down' | 'warn' }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      <p className={cn(
        'mt-0.5 flex items-center gap-1 text-xs',
        tone === 'up' ? 'text-emerald-600' : tone === 'down' ? 'text-destructive' : tone === 'warn' ? 'text-amber-600' : 'text-muted-foreground',
      )}>
        {tone === 'up' ? <TrendingUp className="h-3 w-3" /> : tone === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
        {helper}
      </p>
    </div>
  )
}
