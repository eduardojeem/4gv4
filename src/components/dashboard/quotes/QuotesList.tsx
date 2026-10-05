'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  Hammer,
  HelpCircle,
  Laptop,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Shirt,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  UserCheck,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import {
  QUOTE_STATUS_LABELS,
  isQuoteExpired,
  quoteCode,
  type QuoteStatus,
} from '@/lib/quotes/quote-math'
import {
  getQuoteVerticalConfig,
  type QuoteVerticalMeta,
} from '@/lib/quotes/quote-verticals'
import type { BusinessVertical } from '@/lib/organization/business-profile'

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
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900',
  converted: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 dark:border-violet-900',
  cancelled: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800 border-slate-200',
}

const STATUS_DOTS: Record<QuoteStatus, string> = {
  draft: 'bg-slate-400',
  sent: 'bg-blue-500 animate-pulse',
  accepted: 'bg-emerald-500',
  rejected: 'bg-red-500',
  converted: 'bg-violet-500',
  cancelled: 'bg-slate-400',
}

export function QuoteStatusBadge({
  status,
  validUntil,
}: {
  status: QuoteStatus
  validUntil?: string | null
}) {
  const expired = (status === 'draft' || status === 'sent') && isQuoteExpired(validUntil)
  if (expired) {
    return (
      <Badge
        variant="secondary"
        className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300 inline-flex items-center gap-1.5"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Vencido
      </Badge>
    )
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-semibold inline-flex items-center gap-1.5',
        STATUS_STYLES[status]
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOTS[status])} />
      {QUOTE_STATUS_LABELS[status]}
    </Badge>
  )
}

function VerticalIcon({ vertical, className }: { vertical: BusinessVertical; className?: string }) {
  switch (vertical) {
    case 'electronics':
      return <Laptop className={className} />
    case 'clothing':
      return <Shirt className={className} />
    case 'hardware':
      return <Hammer className={className} />
    case 'food':
      return <UtensilsCrossed className={className} />
    case 'cosmetics':
      return <Sparkles className={className} />
    case 'barbershop':
      return <Scissors className={className} />
    default:
      return <Store className={className} />
  }
}

const FILTERS: Array<{
  key: 'open' | 'accepted' | 'converted' | 'closed' | 'all'
  label: string
  match: (q: QuoteSummary) => boolean
}> = [
  { key: 'open', label: 'En curso', match: (q) => q.status === 'draft' || q.status === 'sent' },
  { key: 'accepted', label: 'Aceptados', match: (q) => q.status === 'accepted' },
  { key: 'converted', label: 'Vendidos (POS)', match: (q) => q.status === 'converted' },
  { key: 'closed', label: 'Rechazados / Anulados', match: (q) => q.status === 'rejected' || q.status === 'cancelled' },
  { key: 'all', label: 'Todos', match: () => true },
]

type SortOption = 'recent' | 'amount_desc' | 'amount_asc' | 'expiry'

export function QuotesList() {
  const { businessVertical, organizationName } = useSubscriptionStatus()
  const [selectedVertical, setSelectedVertical] = useState<BusinessVertical>(businessVertical || 'general')

  // Mantener sincronizado si la organización cambia de rubro
  useEffect(() => {
    if (businessVertical) {
      setSelectedVertical(businessVertical)
    }
  }, [businessVertical])

  const verticalMeta: QuoteVerticalMeta = useMemo(
    () => getQuoteVerticalConfig(selectedVertical),
    [selectedVertical]
  )

  const [quotes, setQuotes] = useState<QuoteSummary[]>([])
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('open')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')

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

  useEffect(() => {
    void load()
  }, [load])

  // Métricas y estadísticas comerciales calculadas
  const stats = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
    const thisMonth = quotes.filter((q) => Date.parse(q.created_at) >= monthStart)
    const decided = thisMonth.filter((q) => ['converted', 'rejected', 'accepted'].includes(q.status))
    const won = thisMonth.filter((q) => q.status === 'converted' || q.status === 'accepted')
    const open = quotes.filter((q) => q.status === 'draft' || q.status === 'sent')
    const acceptedNotSold = quotes.filter((q) => q.status === 'accepted')

    return {
      open: open.length,
      openTotal: open.reduce((sum, q) => sum + Number(q.total), 0),
      accepted: acceptedNotSold.length,
      acceptedTotal: acceptedNotSold.reduce((sum, q) => sum + Number(q.total), 0),
      soldThisMonth: thisMonth
        .filter((q) => q.status === 'converted')
        .reduce((sum, q) => sum + Number(q.total), 0),
      soldThisMonthCount: thisMonth.filter((q) => q.status === 'converted').length,
      rate: decided.length ? Math.round((won.length / decided.length) * 100) : null,
      currency: quotes[0]?.currency ?? 'PYG',
    }
  }, [quotes])

  // Filtrado y ordenamiento interactivo
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matcher = FILTERS.find((f) => f.key === filter)!.match

    const filtered = quotes.filter((q) => {
      const matchesFilter = matcher(q)
      if (!matchesFilter) return false
      if (!term) return true
      return (
        q.customer_name.toLowerCase().includes(term) ||
        (q.customer_phone ?? '').includes(term) ||
        quoteCode(q.number).toLowerCase().includes(term)
      )
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'amount_desc') return Number(b.total) - Number(a.total)
      if (sortBy === 'amount_asc') return Number(a.total) - Number(b.total)
      if (sortBy === 'expiry') {
        const valA = a.valid_until ?? '9999-99-99'
        const valB = b.valid_until ?? '9999-99-99'
        return valA.localeCompare(valB)
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [quotes, filter, search, sortBy])

  return (
    <div className="space-y-6">
      {/* ── Encabezado Principal y Selección de Rubro ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Presupuestos & Cotizaciones
            </h1>
            <Badge
              variant="outline"
              className={cn(
                'gap-1.5 px-2.5 py-0.5 text-xs font-semibold shadow-2xs transition-colors',
                verticalMeta.badgeColorClass
              )}
            >
              <VerticalIcon vertical={selectedVertical} className="h-3.5 w-3.5" />
              <span>Rubro: {verticalMeta.badgeText}</span>
            </Badge>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {verticalMeta.tagline}. Creá presupuestos, compartilos por WhatsApp y convertilos en venta en el POS con un solo clic.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            <span>Actualizar</span>
          </Button>

          <Button asChild size="sm" className="gap-1.5 font-bold shadow-sm">
            <Link href="/dashboard/quotes/new">
              <Plus className="h-4 w-4" />
              <span>Nuevo presupuesto</span>
            </Link>
          </Button>
        </div>
      </div>

      {!available && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/40 p-4 text-xs sm:text-sm text-amber-900 dark:text-amber-200 shadow-xs flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p>
            Los presupuestos no están disponibles o la migración de base de datos está pendiente.
            Comunicate con el administrador para sincronizar el módulo comercial.
          </p>
        </div>
      )}

      {/* ── Tarjetas de Rendimiento & KPIs Comerciales ── */}
      {/* ── Tarjetas de Rendimiento & KPIs Comerciales con Código de Colores ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: En curso (Azul) */}
        <Card className="rounded-xl border-border/70 border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-500/10 via-card to-card shadow-xs hover:border-blue-500/50 transition-colors">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-blue-500" /> En negociación
              </span>
              <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-foreground">
                {stats.open}
              </p>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                {formatCurrency(stats.openTotal, { currency: stats.currency })}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Aceptados listos para POS (Verde Esmeralda) */}
        <Card className="rounded-xl border-border/70 border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-500/10 via-card to-card shadow-xs hover:border-emerald-500/50 transition-colors">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> Aceptados por clientes
              </span>
              <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-foreground">
                {stats.accepted}
              </p>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                {stats.accepted > 0
                  ? formatCurrency(stats.acceptedTotal, { currency: stats.currency })
                  : 'Listos para pasar al POS'}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Vendido en el mes (Violeta / Púrpura) */}
        <Card className="rounded-xl border-border/70 border-l-4 border-l-violet-500 bg-gradient-to-br from-violet-500/10 via-card to-card shadow-xs hover:border-violet-500/50 transition-colors">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1">
                <ShoppingCart className="h-3.5 w-3.5 text-violet-500" /> Vendido este mes
              </span>
              <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-foreground truncate">
                {formatCurrency(stats.soldThisMonth, { currency: stats.currency })}
              </p>
              <p className="text-xs text-violet-600/80 dark:text-violet-400/80 font-medium mt-0.5">
                {stats.soldThisMonthCount} presupuesto{stats.soldThisMonthCount === 1 ? '' : 's'} convertido{stats.soldThisMonthCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/20">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Tasa de conversión (Ámbar / Naranja) */}
        <Card className="rounded-xl border-border/70 border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-500/10 via-card to-card shadow-xs hover:border-amber-500/50 transition-colors">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-amber-500" /> Efectividad comercial
              </span>
              <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-foreground">
                {stats.rate === null ? '—' : `${stats.rate}%`}
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium mt-0.5">
                Presupuestos ganados este mes
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Barra de Filtros, Búsqueda y Ordenamiento ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Pestañas de estado estilo Segmented Controls */}
        <div
          role="tablist"
          aria-label="Filtrar presupuestos"
          className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/60"
        >
          {FILTERS.map((item) => {
            const count = quotes.filter(item.match).length
            const active = filter === item.key
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5',
                  active
                    ? 'bg-background text-foreground font-bold shadow-2xs border border-border/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <span>{item.label}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums',
                    active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Buscador interactivo y Ordenamiento */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, teléfono o número..."
              className="pl-8 pr-8 h-9 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-2.5 text-xs gap-1 cursor-pointer">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Ordenar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem onClick={() => setSortBy('recent')}>
                Más recientes primero
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('amount_desc')}>
                Mayor monto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('amount_asc')}>
                Menor monto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('expiry')}>
                Vencimiento próximo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Lista de Presupuestos (Desktop Table & Mobile Cards) ── */}
      {loading && quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-foreground">Cargando presupuestos...</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-12 text-center bg-muted/10">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {quotes.length === 0
                ? `Sin presupuestos en ${verticalMeta.name}`
                : 'No se encontraron presupuestos'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {quotes.length === 0
                ? `Comenzá creando tu primera cotización adaptada a tu rubro (${verticalMeta.badgeText}).`
                : 'Probá ajustando el término de búsqueda o cambiando el filtro seleccionado.'}
            </p>
          </div>
          {quotes.length === 0 && (
            <Button asChild size="sm" className="mt-2 font-bold gap-1.5 shadow-sm">
              <Link href="/dashboard/quotes/new">
                <Plus className="h-4 w-4" />
                <span>Crear primer presupuesto</span>
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Vista Escritorio: Tabla */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border/70 text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Emisión / Vencimiento</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Importe Total</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visible.map((quote) => {
                  const expired =
                    (quote.status === 'draft' || quote.status === 'sent') &&
                    isQuoteExpired(quote.valid_until)
                  const code = quoteCode(quote.number)
                  const phoneFormatted = quote.customer_phone
                    ? quote.customer_phone.replace(/\D/g, '')
                    : null

                  return (
                    <tr
                      key={quote.id}
                      className="group hover:bg-muted/40 transition-colors"
                    >
                      {/* Código */}
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        <Link
                          href={`/dashboard/quotes/${quote.id}`}
                          className="hover:text-primary transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{code}</span>
                        </Link>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                            {quote.customer_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/quotes/${quote.id}`}
                              className="font-bold text-foreground hover:text-primary transition-colors truncate block max-w-[200px]"
                            >
                              {quote.customer_name}
                            </Link>
                            {quote.customer_phone && (
                              <span className="text-[11px] text-muted-foreground block truncate">
                                {quote.customer_phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Fecha y Validez */}
                      <td className="py-3 px-4 text-muted-foreground">
                        <span className="block font-medium text-foreground">
                          {new Date(quote.created_at).toLocaleDateString('es-PY')}
                        </span>
                        {quote.valid_until && (
                          <span
                            className={cn(
                              'text-[11px] block',
                              expired ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-muted-foreground'
                            )}
                          >
                            Vence: {quote.valid_until.split('-').reverse().join('/')}
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4">
                        <QuoteStatusBadge status={quote.status} validUntil={quote.valid_until} />
                      </td>

                      {/* Importe Total */}
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span className="font-extrabold text-sm text-foreground">
                          {formatCurrency(Number(quote.total), { currency: quote.currency })}
                        </span>
                      </td>

                      {/* Acciones Rápidas */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {phoneFormatted && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                const waUrl = `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(
                                  `Hola ${quote.customer_name}! Te paso el presupuesto ${code} por ${formatCurrency(
                                    Number(quote.total),
                                    { currency: quote.currency }
                                  )}.`
                                )}`
                                window.open(waUrl, '_blank')
                              }}
                              title="Enviar recordatorio por WhatsApp"
                              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          )}

                          {quote.status === 'accepted' && (
                            <Button asChild size="sm" variant="default" className="h-7 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                              <Link href={`/dashboard/pos?quoteId=${quote.id}`}>
                                <ShoppingCart className="h-3 w-3" />
                                <span>POS</span>
                              </Link>
                            </Button>
                          )}

                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs font-medium">
                            <Link href={`/dashboard/quotes/${quote.id}`}>
                              <span>Abrir</span>
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Móvil: Tarjetas táctiles */}
          <div className="grid gap-2.5 md:hidden">
            {visible.map((quote) => {
              const code = quoteCode(quote.number)
              const expired =
                (quote.status === 'draft' || quote.status === 'sent') &&
                isQuoteExpired(quote.valid_until)

              return (
                <div
                  key={quote.id}
                  className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-primary block">
                        {code}
                      </span>
                      <Link
                        href={`/dashboard/quotes/${quote.id}`}
                        className="font-bold text-sm text-foreground block truncate mt-0.5"
                      >
                        {quote.customer_name}
                      </Link>
                    </div>
                    <QuoteStatusBadge status={quote.status} validUntil={quote.valid_until} />
                  </div>

                  <div className="flex items-baseline justify-between border-t border-border/50 pt-2 text-xs">
                    <span className="text-muted-foreground text-[11px]">
                      {new Date(quote.created_at).toLocaleDateString('es-PY')}
                      {quote.valid_until && ` · Vence ${quote.valid_until.split('-').reverse().join('/')}`}
                    </span>
                    <span className="font-extrabold text-sm text-foreground tabular-nums">
                      {formatCurrency(Number(quote.total), { currency: quote.currency })}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                    {quote.status === 'accepted' && (
                      <Button asChild size="sm" className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Link href={`/dashboard/pos?quoteId=${quote.id}`}>
                          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                          Cobrar en POS
                        </Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs font-semibold">
                      <Link href={`/dashboard/quotes/${quote.id}`}>
                        Ver presupuesto
                      </Link>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
