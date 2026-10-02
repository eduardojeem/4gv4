'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Ban,
  Check,
  Copy,
  CopyPlus,
  ExternalLink,
  Loader2,
  MessageCircle,
  PackagePlus,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import {
  CONVERTIBLE_STATUSES,
  EDITABLE_STATUSES,
  buildQuoteWhatsAppMessage,
  computeTotals,
  defaultValidUntil,
  posUnitPrice,
  quoteCode,
  whatsappNumber,
  type QuoteStatus,
} from '@/lib/quotes/quote-math'
import { QuoteStatusBadge } from '@/components/dashboard/quotes/QuotesList'

type PriceMode = 'retail' | 'wholesale'

type CatalogPrice = { sale_price: number; wholesale_price: number | null }

type EditorLine = {
  key: string
  product_id: string | null
  variant_id: string | null
  description: string
  sku: string | null
  quantity: number
  unit_price: number
  discount_rate: number
  /** Precios de catálogo, para recalcular al cambiar minorista/mayorista. */
  catalog: CatalogPrice | null
}

type Customer = { id: string | null; name: string; phone: string; email: string; ruc: string }

type ProductResult = {
  id: string
  name: string
  sku: string | null
  sale_price: number
  wholesale_price: number | null
  stock_quantity: number
  has_variants: boolean
  product_variants?: Array<{ id: string; variant_name: string; sku: string | null; sale_price: number; wholesale_price: number | null; stock_quantity: number; is_active: boolean }>
}

type LoadedQuote = {
  id: string
  number: number
  status: QuoteStatus
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  customer_ruc: string | null
  price_mode: PriceMode
  valid_until: string | null
  notes: string | null
  currency: string
  total: number
  items: Array<Omit<EditorLine, 'key' | 'catalog'>>
}

let lineCounter = 0
const newKey = () => `line-${Date.now()}-${lineCounter++}`

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function ProductPicker({ priceMode, currency, onPick }: { priceMode: PriceMode; currency: string; onPick: (line: EditorLine) => void }) {
  const [term, setTerm] = useState('')
  const [response, setResponse] = useState<{ term: string; results: ProductResult[] }>({ term: '', results: [] })
  const [expanded, setExpanded] = useState<string | null>(null)
  const debounced = useDebounced(term).trim()

  useEffect(() => {
    if (debounced.length < 2) return
    let cancelled = false
    fetch(`/api/quotes/lookup?type=products&q=${encodeURIComponent(debounced)}`)
      .then((res) => res.json())
      .then((body) => { if (!cancelled) setResponse({ term: debounced, results: Array.isArray(body.results) ? body.results : [] }) })
      .catch(() => { if (!cancelled) setResponse({ term: debounced, results: [] }) })
    return () => { cancelled = true }
  }, [debounced])

  // Lo que se ve sale del término actual: al borrar o elegir, la lista se va sola.
  const active = term.trim().length >= 2 && debounced.length >= 2
  const results = active && response.term === debounced ? response.results : []
  const loading = active && response.term !== debounced

  const pick = (product: ProductResult, variant?: NonNullable<ProductResult['product_variants']>[number]) => {
    const catalog = variant
      ? { sale_price: Number(variant.sale_price) || Number(product.sale_price), wholesale_price: variant.wholesale_price ?? product.wholesale_price }
      : { sale_price: Number(product.sale_price), wholesale_price: product.wholesale_price }
    onPick({
      key: newKey(),
      product_id: product.id,
      variant_id: variant?.id ?? null,
      description: variant ? `${product.name} — ${variant.variant_name}` : product.name,
      sku: variant?.sku || product.sku,
      quantity: 1,
      unit_price: posUnitPrice(catalog, priceMode),
      discount_rate: 0,
      catalog,
    })
    setTerm('')
    setExpanded(null)
  }

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar producto por nombre, código o marca…" className="pl-8" aria-label="Buscar producto" />
      {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-lg">
          {results.map((product) => {
            const variants = (product.product_variants ?? []).filter((variant) => variant.is_active !== false)
            const withVariants = product.has_variants && variants.length > 0
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => (withVariants ? setExpanded(expanded === product.id ? null : product.id) : pick(product))}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{product.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {product.sku || 'Sin código'} · stock {product.stock_quantity}{withVariants ? ` · ${variants.length} variantes` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(posUnitPrice(product, priceMode), { currency })}</span>
                </button>
                {expanded === product.id && (
                  <ul className="mb-1 ml-4 border-l pl-2">
                    {variants.map((variant) => (
                      <li key={variant.id}>
                        <button type="button" onClick={() => pick(product, variant)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                          <span className="truncate">{variant.variant_name} <span className="text-xs text-muted-foreground">· stock {variant.stock_quantity}</span></span>
                          <span className="shrink-0 tabular-nums">{formatCurrency(posUnitPrice({ sale_price: Number(variant.sale_price) || Number(product.sale_price), wholesale_price: variant.wholesale_price }, priceMode), { currency })}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function CustomerFields({ customer, onChange, disabled }: { customer: Customer; onChange: (customer: Customer) => void; disabled: boolean }) {
  type Suggestion = { id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null; ruc: string | null }
  const [response, setResponse] = useState<{ term: string; results: Suggestion[] }>({ term: '', results: [] })
  const [focused, setFocused] = useState(false)
  const debounced = useDebounced(customer.name).trim()
  const searching = !disabled && !customer.id && debounced.length >= 2

  useEffect(() => {
    if (!searching) return
    let cancelled = false
    fetch(`/api/quotes/lookup?type=customers&q=${encodeURIComponent(debounced)}`)
      .then((res) => res.json())
      .then((body) => { if (!cancelled) setResponse({ term: debounced, results: Array.isArray(body.results) ? body.results : [] }) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [debounced, searching])

  const suggestions = searching && response.term === debounced ? response.results : []

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="relative space-y-1 sm:col-span-2">
        <Label htmlFor="quote-customer" className="flex items-center gap-1.5 text-xs"><UserRound className="h-3.5 w-3.5" /> Cliente</Label>
        <div className="relative">
          <Input
            id="quote-customer"
            value={customer.name}
            disabled={disabled}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onChange={(event) => onChange({ ...customer, id: null, name: event.target.value })}
            placeholder="Nombre o razón social (buscá un cliente o escribí uno nuevo)"
          />
          {customer.id && !disabled && (
            <button type="button" aria-label="Desvincular cliente" className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => onChange({ id: null, name: '', phone: '', email: '', ruc: '' })}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {customer.id && <p className="text-xs text-emerald-700 dark:text-emerald-400">Cliente registrado</p>}
        {focused && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-xl border bg-popover p-1 shadow-lg">
            {suggestions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange({ id: item.id, name: item.name, phone: item.whatsapp || item.phone || '', email: item.email || '', ruc: item.ruc || '' })
                  }}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground"> {[item.whatsapp || item.phone, item.ruc].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="quote-phone" className="text-xs">WhatsApp / teléfono</Label>
        <Input id="quote-phone" value={customer.phone} disabled={disabled} inputMode="tel" placeholder="0981 123 456" onChange={(event) => onChange({ ...customer, phone: event.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="quote-ruc" className="text-xs">RUC / CI (opcional)</Label>
        <Input id="quote-ruc" value={customer.ruc} disabled={disabled} onChange={(event) => onChange({ ...customer, ruc: event.target.value })} />
      </div>
    </div>
  )
}

export function QuoteEditor({ quoteId }: { quoteId?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [currency, setCurrency] = useState('PYG')
  const [storeName, setStoreName] = useState('')
  const [quote, setQuote] = useState<LoadedQuote | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sale, setSale] = useState<{ id: string; code: string } | null>(null)
  const [customer, setCustomer] = useState<Customer>({ id: null, name: '', phone: '', email: '', ruc: '' })
  const [priceMode, setPriceMode] = useState<PriceMode>('retail')
  const [validUntil, setValidUntil] = useState(defaultValidUntil(7))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<EditorLine[]>([])
  const [dirty, setDirty] = useState(false)

  const editable = !quote || EDITABLE_STATUSES.includes(quote.status)
  const totals = useMemo(() => computeTotals(lines, currency), [lines, currency])

  const applyLoaded = useCallback((loaded: LoadedQuote) => {
    setQuote(loaded)
    setCurrency(loaded.currency)
    setCustomer({ id: loaded.customer_id, name: loaded.customer_name, phone: loaded.customer_phone ?? '', email: loaded.customer_email ?? '', ruc: loaded.customer_ruc ?? '' })
    setPriceMode(loaded.price_mode)
    setValidUntil(loaded.valid_until ?? '')
    setNotes(loaded.notes ?? '')
    setLines(loaded.items.map((item) => ({ ...item, key: newKey(), quantity: Number(item.quantity), unit_price: Number(item.unit_price), discount_rate: Number(item.discount_rate), catalog: null })))
    setDirty(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        if (quoteId) {
          const response = await fetch(`/api/quotes/${quoteId}`, { cache: 'no-store' })
          const body = await response.json().catch(() => ({}))
          if (!response.ok) {
            toast.error(body.error || 'No se encontró el presupuesto')
            router.replace('/dashboard/quotes')
            return
          }
          if (cancelled) return
          applyLoaded(body.quote)
          setShareUrl(body.shareUrl)
          setSale(body.sale)
          setStoreName(body.storeName)
        } else {
          const body = await fetch('/api/quotes/lookup?type=meta').then((response) => response.json()).catch(() => ({}))
          if (cancelled) return
          if (body.currency) setCurrency(body.currency)
          if (body.storeName) setStoreName(body.storeName)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [quoteId, applyLoaded, router])

  const touch = () => setDirty(true)
  const updateLine = (key: string, patch: Partial<EditorLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
    touch()
  }

  const changePriceMode = (mode: PriceMode) => {
    setPriceMode(mode)
    // Las líneas del catálogo toman el precio del nuevo modo; las editadas a mano no se tocan.
    setLines((current) => current.map((line) => (line.catalog ? { ...line, unit_price: posUnitPrice(line.catalog, mode) } : line)))
    touch()
  }

  const payload = () => ({
    customer_id: customer.id,
    customer_name: customer.name.trim(),
    customer_phone: customer.phone.trim() || null,
    customer_email: customer.email.trim() || null,
    customer_ruc: customer.ruc.trim() || null,
    price_mode: priceMode,
    valid_until: validUntil || null,
    notes: notes.trim() || null,
    items: lines.map((line) => ({
      product_id: line.product_id,
      variant_id: line.variant_id,
      description: line.description.trim(),
      sku: line.sku,
      quantity: Math.max(1, Math.trunc(line.quantity) || 1),
      unit_price: Math.max(0, Number(line.unit_price) || 0),
      discount_rate: Math.min(100, Math.max(0, Number(line.discount_rate) || 0)),
    })),
  })

  const save = async (): Promise<string | null> => {
    if (!customer.name.trim()) {
      toast.error('Poné el nombre del cliente')
      return null
    }
    if (lines.length === 0) {
      toast.error('Agregá al menos un producto o servicio')
      return null
    }
    setSaving(true)
    try {
      const response = await fetch(quote ? `/api/quotes/${quote.id}` : '/api/quotes', {
        method: quote ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo guardar el presupuesto')
        return null
      }
      setDirty(false)
      if (!quote) {
        toast.success(`Presupuesto ${quoteCode(body.quote.number)} creado`)
        router.replace(`/dashboard/quotes/${body.quote.id}`)
        return body.quote.id
      }
      toast.success('Cambios guardados')
      applyLoaded(body.quote)
      return quote.id
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (action: string, success: string) => {
    if (!quote) return
    setBusy(true)
    try {
      const response = await fetch(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo cambiar el estado')
        return
      }
      setQuote((current) => (current ? { ...current, status: body.quote.status } : current))
      toast.success(success)
    } finally {
      setBusy(false)
    }
  }

  const sendWhatsApp = async () => {
    if (!quote || !shareUrl) return
    const message = buildQuoteWhatsAppMessage({
      storeName: storeName || 'nuestra tienda',
      customerName: customer.name.split(' ')[0] || customer.name,
      number: quote.number,
      lines: totals.lines,
      total: totals.total,
      currency,
      validUntil: validUntil || null,
      url: shareUrl,
    })
    const phone = whatsappNumber(customer.phone)
    // Sin teléfono, WhatsApp deja elegir el contacto.
    window.open(`https://wa.me/${phone ?? ''}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    if (quote.status === 'draft') await changeStatus('mark_sent', 'Marcado como enviado')
  }

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Enlace copiado')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  const duplicate = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload(), valid_until: defaultValidUntil(7) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo duplicar')
        return
      }
      toast.success(`Copia creada: ${quoteCode(body.quote.number)}`)
      router.push(`/dashboard/quotes/${body.quote.id}`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!quote || !window.confirm('¿Borrar este borrador?')) return
    const response = await fetch(`/api/quotes/${quote.id}`, { method: 'DELETE' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(body.error || 'No se pudo borrar')
      return
    }
    toast.success('Borrador eliminado')
    router.replace('/dashboard/quotes')
  }

  const freeLines = lines.filter((line) => !line.product_id).length
  const canConvert = Boolean(quote && CONVERTIBLE_STATUSES.includes(quote.status) && !dirty && lines.some((line) => line.product_id))

  // Cambios sin guardar: avisar antes de salir.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  if (loading) {
    return <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando presupuesto…</p>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/dashboard/quotes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Presupuestos</Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{quote ? `Presupuesto ${quoteCode(quote.number)}` : 'Nuevo presupuesto'}</h1>
            {quote && <QuoteStatusBadge status={quote.status} validUntil={quote.valid_until} />}
          </div>
          {sale && <p className="text-sm text-violet-700 dark:text-violet-300">Convertido en la venta {sale.code}</p>}
        </div>
        {editable && (
          <Button onClick={() => void save()} disabled={saving || (!dirty && Boolean(quote))}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {quote ? 'Guardar cambios' : 'Crear presupuesto'}
          </Button>
        )}
      </div>

      {quote && (
        <Card className="rounded-xl">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1ebe5a]" onClick={() => void sendWhatsApp()} disabled={dirty || busy || quote.status === 'cancelled'}>
              <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={() => void copyLink()} disabled={!shareUrl}><Copy className="h-4 w-4" /> Copiar enlace</Button>
            <Button size="sm" variant="outline" asChild>
              <a href={shareUrl ?? '#'} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Ver / imprimir</a>
            </Button>
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
            {canConvert && (
              <Button size="sm" asChild><Link href={`/dashboard/pos?quoteId=${quote.id}`}><ShoppingCart className="h-4 w-4" /> Convertir en venta</Link></Button>
            )}
            {(quote.status === 'draft' || quote.status === 'sent') && (
              <>
                <Button size="sm" variant="outline" onClick={() => void changeStatus('accept', 'Marcado como aceptado')} disabled={busy || dirty}><Check className="h-4 w-4" /> Aceptado</Button>
                <Button size="sm" variant="outline" onClick={() => void changeStatus('reject', 'Marcado como rechazado')} disabled={busy || dirty}><X className="h-4 w-4" /> Rechazado</Button>
              </>
            )}
            {['rejected', 'cancelled', 'accepted'].includes(quote.status) && (
              <Button size="sm" variant="outline" onClick={() => void changeStatus('reopen', 'Presupuesto reabierto')} disabled={busy}><RotateCcw className="h-4 w-4" /> Reabrir</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => void duplicate()} disabled={busy}><CopyPlus className="h-4 w-4" /> Duplicar</Button>
            {quote.status === 'draft' ? (
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void remove()}><Trash2 className="h-4 w-4" /> Borrar</Button>
            ) : !['cancelled', 'converted'].includes(quote.status) && (
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void changeStatus('cancel', 'Presupuesto anulado')} disabled={busy}><Ban className="h-4 w-4" /> Anular</Button>
            )}
            {dirty && <span className="text-xs text-amber-700 dark:text-amber-400">Guardá los cambios para enviarlo o convertirlo.</span>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card className="rounded-xl">
            <CardHeader className="pb-3"><CardTitle className="text-base">Productos y servicios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {editable && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex-1"><ProductPicker priceMode={priceMode} currency={currency} onPick={(line) => { setLines((current) => [...current, line]); touch() }} /></div>
                  <Button
                    variant="outline"
                    onClick={() => { setLines((current) => [...current, { key: newKey(), product_id: null, variant_id: null, description: '', sku: null, quantity: 1, unit_price: 0, discount_rate: 0, catalog: null }]); touch() }}
                  >
                    <Plus className="h-4 w-4" /> Línea libre
                  </Button>
                </div>
              )}

              {lines.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  <PackagePlus className="h-7 w-7" />
                  Buscá productos del catálogo o agregá una línea libre (mano de obra, envío, instalación…).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 font-medium">Descripción</th>
                        <th className="w-20 py-2 font-medium">Cant.</th>
                        <th className="w-32 py-2 font-medium">Precio unit.</th>
                        <th className="w-20 py-2 font-medium">Desc. %</th>
                        <th className="w-32 py-2 text-right font-medium">Total</th>
                        {editable && <th className="w-8" />}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={line.key} className="border-b align-top last:border-0">
                          <td className="py-2 pr-2">
                            {editable && !line.product_id ? (
                              <Input value={line.description} placeholder="Descripción del servicio o producto" onChange={(event) => updateLine(line.key, { description: event.target.value })} />
                            ) : (
                              <div>
                                <p className="font-medium">{line.description}</p>
                                <p className="text-xs text-muted-foreground">{line.product_id ? line.sku || 'Del catálogo' : 'Línea libre'}</p>
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            <Input type="number" min={1} step={1} value={line.quantity} disabled={!editable} aria-label={`Cantidad línea ${index + 1}`} onChange={(event) => updateLine(line.key, { quantity: Math.max(1, Math.trunc(Number(event.target.value)) || 1) })} />
                          </td>
                          <td className="py-2 pr-2">
                            <Input type="number" min={0} step="any" value={line.unit_price} disabled={!editable} aria-label={`Precio línea ${index + 1}`} onChange={(event) => updateLine(line.key, { unit_price: Math.max(0, Number(event.target.value) || 0), catalog: null })} />
                          </td>
                          <td className="py-2 pr-2">
                            <Input type="number" min={0} max={100} step="any" value={line.discount_rate} disabled={!editable} aria-label={`Descuento línea ${index + 1}`} onChange={(event) => updateLine(line.key, { discount_rate: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} />
                          </td>
                          <td className="py-2 text-right font-semibold tabular-nums">{formatCurrency(totals.lines[index]?.line_total ?? 0, { currency })}</td>
                          {editable && (
                            <td className="py-2 pl-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Quitar línea ${index + 1}`} onClick={() => { setLines((current) => current.filter((item) => item.key !== line.key)); touch() }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {freeLines > 0 && quote && CONVERTIBLE_STATUSES.includes(quote.status) && (
                <p className="text-xs text-muted-foreground">Las líneas libres no se pasan solas al POS: al convertir, agregalas en la venta.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader className="pb-3"><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
            <CardContent>
              <CustomerFields customer={customer} disabled={!editable} onChange={(next) => { setCustomer(next); touch() }} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="rounded-xl lg:sticky lg:top-4">
            <CardHeader className="pb-3"><CardTitle className="text-base">Condiciones</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Precios</Label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">
                  {(['retail', 'wholesale'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={!editable}
                      aria-pressed={priceMode === mode}
                      onClick={() => changePriceMode(mode)}
                      className={cn('rounded-md px-2 py-1.5 text-sm transition-colors', priceMode === mode ? 'bg-primary font-semibold text-primary-foreground' : 'hover:bg-muted')}
                    >
                      {mode === 'retail' ? 'Minorista' : 'Mayorista'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="quote-valid" className="text-xs">Válido hasta</Label>
                <Input id="quote-valid" type="date" value={validUntil} disabled={!editable} onChange={(event) => { setValidUntil(event.target.value); touch() }} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quote-notes" className="text-xs">Notas para el cliente</Label>
                <Textarea id="quote-notes" rows={3} value={notes} disabled={!editable} placeholder="Forma de pago, plazo de entrega, garantía…" onChange={(event) => { setNotes(event.target.value); touch() }} />
              </div>
              <dl className="space-y-1.5 border-t pt-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatCurrency(totals.subtotal, { currency })}</dd></div>
                {totals.discount_total > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><dt>Descuentos</dt><dd className="tabular-nums">−{formatCurrency(totals.discount_total, { currency })}</dd></div>
                )}
                <div className="flex justify-between text-lg font-bold"><dt>Total</dt><dd className="tabular-nums">{formatCurrency(totals.total, { currency })}</dd></div>
              </dl>
              {!editable && quote && (
                <p className="text-xs text-muted-foreground">Este presupuesto ya no se puede modificar. Usá «Duplicar» para hacer uno nuevo a partir de este.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
