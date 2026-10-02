'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, FileText, Loader2, Plus, RefreshCw, Search, ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { QUOTE_STATUS_LABELS, isQuoteExpired, quoteCode, type QuoteStatus } from '@/lib/quotes/quote-math'

export type QuoteSummary = {
  id: string
  number: number
  customer_name: string
  customer_phone: string | null
  status: QuoteStatus
  total: number
  currency: string
  valid_until: string | null
  created_at: string
  converted_at: string | null
}

export const STATUS_STYLES: Record<QuoteStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  converted: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  cancelled: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800',
}

export function QuoteStatusBadge({ status, validUntil }: { status: QuoteStatus; validUntil?: string | null }) {
  const expired = (status === 'draft' || status === 'sent') && isQuoteExpired(validUntil)
  return (
    <Badge variant="secondary" className={cn('rounded-full font-medium', expired ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : STATUS_STYLES[status])}>
      {expired ? 'Vencido' : QUOTE_STATUS_LABELS[status]}
    </Badge>
  )
}

const FILTERS: Array<{ key: 'open' | 'accepted' | 'converted' | 'closed' | 'all'; label: string; match: (q: QuoteSummary) => boolean }> = [
  { key: 'open', label: 'En curso', match: (q) => q.status === 'draft' || q.status === 'sent' },
  { key: 'accepted', label: 'Aceptados', match: (q) => q.status === 'accepted' },
  { key: 'converted', label: 'Vendidos', match: (q) => q.status === 'converted' },
  { key: 'closed', label: 'Rechazados y anulados', match: (q) => q.status === 'rejected' || q.status === 'cancelled' },
  { key: 'all', label: 'Todos', match: () => true },
]

export function QuotesList() {
  const [quotes, setQuotes] = useState<QuoteSummary[]>([])
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('open')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/quotes', { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      setAvailable(body.available !== false)
      setQuotes(Array.isArray(body.quotes) ? body.quotes : [])
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
    const thisMonth = quotes.filter((q) => Date.parse(q.created_at) >= monthStart)
    const decided = thisMonth.filter((q) => ['converted', 'rejected', 'accepted'].includes(q.status))
    const won = thisMonth.filter((q) => q.status === 'converted' || q.status === 'accepted')
    const open = quotes.filter((q) => q.status === 'draft' || q.status === 'sent')
    return {
      open: open.length,
      openTotal: open.reduce((sum, q) => sum + Number(q.total), 0),
      accepted: quotes.filter((q) => q.status === 'accepted').length,
      soldThisMonth: thisMonth.filter((q) => q.status === 'converted').reduce((sum, q) => sum + Number(q.total), 0),
      rate: decided.length ? Math.round((won.length / decided.length) * 100) : null,
      currency: quotes[0]?.currency ?? 'PYG',
    }
  }, [quotes])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matcher = FILTERS.find((f) => f.key === filter)!.match
    return quotes.filter((q) => matcher(q) && (!term
      || q.customer_name.toLowerCase().includes(term)
      || (q.customer_phone ?? '').includes(term)
      || quoteCode(q.number).toLowerCase().includes(term)))
  }, [quotes, filter, search])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Armá el presupuesto, mandalo por WhatsApp y, cuando el cliente confirma, convertilo en venta en el POS.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Actualizar
          </Button>
          <Button asChild size="sm"><Link href="/dashboard/quotes/new"><Plus className="h-4 w-4" /> Nuevo presupuesto</Link></Button>
        </div>
      </div>

      {!available && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Los presupuestos todavía no están activados en la base de datos. Pedile al administrador de la plataforma que aplique la actualización.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'En curso', value: String(stats.open), hint: formatCurrency(stats.openTotal, { currency: stats.currency }), icon: Clock },
          { label: 'Aceptados sin cobrar', value: String(stats.accepted), hint: 'Listos para pasar al POS', icon: CheckCircle2 },
          { label: 'Vendido este mes', value: formatCurrency(stats.soldThisMonth, { currency: stats.currency }), hint: 'Desde presupuestos', icon: ShoppingCart },
          { label: 'Tasa de cierre', value: stats.rate === null ? '—' : `${stats.rate}%`, hint: 'Aceptados o vendidos, este mes', icon: FileText },
        ].map((card) => (
          <Card key={card.label} className="rounded-xl">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-1 truncate text-xl font-bold tabular-nums">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.hint}</p>
              </div>
              <card.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar presupuestos">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={cn('rounded-full border px-3 py-1 text-sm transition-colors', filter === item.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >
              {item.label} <span className="opacity-70">({quotes.filter(item.match).length})</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, teléfono o número" className="pl-8" />
        </div>
      </div>

      {loading && quotes.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando presupuestos…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8" />
          {quotes.length === 0 ? 'Todavía no hiciste presupuestos.' : 'No hay presupuestos con este filtro.'}
          {quotes.length === 0 && <Button asChild size="sm"><Link href="/dashboard/quotes/new"><Plus className="h-4 w-4" /> Hacer el primero</Link></Button>}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visible.map((quote) => (
            <li key={quote.id}>
              <Link href={`/dashboard/quotes/${quote.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 transition-colors hover:bg-muted/50">
                <span className="w-20 font-mono text-sm font-semibold">{quoteCode(quote.number)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{quote.customer_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(quote.created_at).toLocaleDateString('es-PY')}
                    {quote.valid_until && ` · válido hasta ${quote.valid_until.split('-').reverse().join('/')}`}
                  </span>
                </span>
                <QuoteStatusBadge status={quote.status} validUntil={quote.valid_until} />
                <span className="w-32 text-right font-semibold tabular-nums">{formatCurrency(Number(quote.total), { currency: quote.currency })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
