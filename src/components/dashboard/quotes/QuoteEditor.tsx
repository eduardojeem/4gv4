'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Barcode,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Copy,
  CopyPlus,
  ExternalLink,
  Eye,
  Layers,
  ListPlus,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Package,
  PackagePlus,
  Plus,
  RotateCcw,
  Save,
  ShoppingCart,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
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
import {
  getQuoteVerticalConfig,
  type QuoteNotePreset,
  type QuoteQuickLine,
  type QuoteStarterPackage,
} from '@/lib/quotes/quote-verticals'
import { findQuoteIssues } from '@/lib/quotes/quote-editor-checks'
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
  /** Precios originales de catálogo para recalcular al cambiar minorista/mayorista. */
  catalog: CatalogPrice | null
  imageUrl?: string | null
}

type Customer = {
  id: string | null
  name: string
  phone: string
  email: string
  ruc: string
}

type ProductResult = {
  id: string
  name: string
  sku: string | null
  sale_price: number
  wholesale_price: number | null
  stock_quantity: number
  has_variants: boolean
  image_url?: string | null
  product_variants?: Array<{
    id: string
    variant_name: string
    sku: string | null
    sale_price: number
    wholesale_price: number | null
    stock_quantity: number
    is_active: boolean
  }>
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

const LOCAL_DRAFT_KEY = '4g_quote_new_draft_v2'
const PAYMENT_TERMS = ['Contado efectivo', '50% seña + 50% entrega', 'Transferencia bancaria', 'Tarjeta débito/crédito', 'Crédito 30 días']
const DELIVERY_TERMS = ['Entrega inmediata', '24 a 48 hs', '3 a 5 días hábiles', 'Retiro en local', 'Envío a domicilio']
const VALIDITY_SHORTCUTS = [7, 15, 30]
const GLOBAL_DISCOUNTS = [0, 5, 10, 15]

let lineCounter = 0
const newKey = () => `line-${Date.now()}-${lineCounter++}`

const freeLine = (description = '', unitPrice = 0, quantity = 1): EditorLine => ({
  key: newKey(),
  product_id: null,
  variant_id: null,
  description,
  sku: null,
  quantity,
  unit_price: unitPrice,
  discount_rate: 0,
  catalog: null,
})

type ProductVariant = NonNullable<ProductResult['product_variants']>[number]

/** Un producto del catálogo como línea del presupuesto, con el precio de la lista elegida. */
function catalogLine(product: ProductResult, priceMode: PriceMode, variant?: ProductVariant): EditorLine {
  const catalog = variant
    ? { sale_price: Number(variant.sale_price) || Number(product.sale_price), wholesale_price: variant.wholesale_price ?? product.wholesale_price }
    : { sale_price: Number(product.sale_price), wholesale_price: product.wholesale_price }
  return {
    key: newKey(),
    product_id: product.id,
    variant_id: variant?.id ?? null,
    description: variant ? `${product.name} — ${variant.variant_name}` : product.name,
    sku: variant?.sku || product.sku,
    quantity: 1,
    unit_price: posUnitPrice(catalog, priceMode),
    discount_rate: 0,
    catalog,
    imageUrl: product.image_url ?? null,
  }
}

function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Encabezado de cada bloque: número de paso, título y estado. */
function SectionTitle({ step, title, hint, done }: { step: number; title: string; hint?: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
          done ? 'bg-primary text-primary-foreground' : 'border bg-background text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {done ? <Check className="h-3.5 w-3.5" /> : step}
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Buscador del catálogo: nombre, SKU o lector de código de barras
// -----------------------------------------------------------------------------
function ProductPicker({
  priceMode,
  currency,
  onPick,
}: {
  priceMode: PriceMode
  currency: string
  onPick: (line: EditorLine) => void
}) {
  const [term, setTerm] = useState('')
  const [focused, setFocused] = useState(false)
  const [response, setResponse] = useState<{ term: string; results: ProductResult[] }>({ term: '', results: [] })
  const [expanded, setExpanded] = useState<string | null>(null)
  // El resaltado se reinicia solo cuando cambia la búsqueda.
  const [nav, setNav] = useState({ term: '', index: 0 })
  const debounced = useDebounced(term).trim()

  useEffect(() => {
    if (debounced.length < 2) return
    let cancelled = false
    fetch(`/api/quotes/lookup?type=products&q=${encodeURIComponent(debounced)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setResponse({ term: debounced, results: Array.isArray(body.results) ? body.results : [] })
      })
      .catch(() => {
        if (!cancelled) setResponse({ term: debounced, results: [] })
      })
    return () => {
      cancelled = true
    }
  }, [debounced])

  const active = term.trim().length >= 2 && debounced.length >= 2
  const results = active && response.term === debounced ? response.results : []
  const loading = active && response.term !== debounced
  const highlighted = nav.term === debounced ? Math.min(nav.index, Math.max(0, results.length - 1)) : 0
  const open = focused && active && !loading

  const pick = useCallback(
    (product: ProductResult, variant?: ProductVariant) => {
      onPick(catalogLine(product, priceMode, variant))
      setTerm('')
      setExpanded(null)
    },
    [onPick, priceMode],
  )

  const choose = (product: ProductResult) => {
    const variants = (product.product_variants ?? []).filter((v) => v.is_active !== false)
    if (product.has_variants && variants.length > 0) setExpanded(expanded === product.id ? null : product.id)
    else pick(product)
  }

  // Flechas para moverse, Enter para agregar (también lo que manda el lector de códigos).
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setTerm('')
      return
    }
    if (results.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setNav({ term: debounced, index: (highlighted + step + results.length) % results.length })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(results[highlighted])
    }
  }

  return (
    <div className="relative">
      <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Buscá por nombre o SKU, o escaneá el código"
        className="h-11 rounded-xl pl-9 pr-9 text-sm"
        aria-label="Buscar producto o escanear código"
        role="combobox"
        aria-expanded={open}
        aria-controls="quote-product-results"
        autoComplete="off"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {term.trim().length > 0 && !loading && (
        <button
          type="button"
          onClick={() => setTerm('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <ul
          id="quote-product-results"
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-80 w-full overflow-auto rounded-xl border bg-popover p-1.5 shadow-xl"
        >
          {results.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              Nada coincide con «{debounced}». Podés agregarlo como línea libre.
            </li>
          )}
          {results.map((product, index) => {
            const variants = (product.product_variants ?? []).filter((v) => v.is_active !== false)
            const withVariants = product.has_variants && variants.length > 0
            return (
              <li key={product.id} role="option" aria-selected={index === highlighted}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(product)}
                  onMouseEnter={() => setNav({ term: debounced, index })}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    index === highlighted ? 'bg-muted' : 'hover:bg-muted/60',
                  )}
                >
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt="" className="h-9 w-9 shrink-0 rounded-md border bg-muted object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/60 text-muted-foreground">
                      <Package className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">{product.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[product.sku, withVariants ? `${variants.length} variantes` : null].filter(Boolean).join(' · ') || 'Sin código'}
                      {' · '}
                      <span className={product.stock_quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {product.stock_quantity > 0 ? `${product.stock_quantity} en stock` : 'sin stock'}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums text-foreground">{formatCurrency(posUnitPrice(product, priceMode), { currency })}</span>
                    {withVariants && (
                      <span className="block text-[11px] text-primary">{expanded === product.id ? 'Ocultar' : 'Elegir variante'}</span>
                    )}
                  </span>
                </button>

                {expanded === product.id && withVariants && (
                  <ul className="my-1 ml-6 space-y-0.5 border-l-2 border-primary/20 pl-2.5">
                    {variants.map((variant) => (
                      <li key={variant.id}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => pick(product, variant)}
                          className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                        >
                          <span className="truncate text-foreground">
                            {variant.variant_name} <span className="text-muted-foreground">· {variant.stock_quantity} en stock</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-foreground">
                            {formatCurrency(
                              posUnitPrice({ sale_price: Number(variant.sale_price) || Number(product.sale_price), wholesale_price: variant.wholesale_price }, priceMode),
                              { currency },
                            )}
                          </span>
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

// -----------------------------------------------------------------------------
// Cliente: autocompletado de la base, consumidor final y pegado inteligente
// -----------------------------------------------------------------------------
function CustomerFields({
  customer,
  onChange,
  disabled,
}: {
  customer: Customer
  onChange: (customer: Customer) => void
  disabled: boolean
}) {
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
      .then((body) => {
        if (!cancelled) setResponse({ term: debounced, results: Array.isArray(body.results) ? body.results : [] })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [debounced, searching])

  const suggestions = searching && response.term === debounced ? response.results : []

  const setGenericCustomer = () => {
    onChange({ id: null, name: 'Consumidor Final', phone: '', email: '', ruc: '44444401-7' })
  }

  // «Juan Pérez 0981 123 456» pegado en el nombre se separa en nombre y teléfono.
  const handleNamePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text').trim()
    const phoneMatch = text.match(/(09\d{2}[\s.-]?\d{3}[\s.-]?\d{3}|\+?595\d{8,9})/)
    if (phoneMatch && !customer.phone) {
      event.preventDefault()
      const namePart = text.replace(phoneMatch[0], '').replace(/[-–—,:;]/g, ' ').trim()
      onChange({ ...customer, id: null, name: namePart || 'Cliente', phone: phoneMatch[0] })
      toast.info('Separamos el nombre y el teléfono')
    }
  }

  const waNumber = customer.phone ? whatsappNumber(customer.phone) : null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="relative space-y-1.5 sm:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="quote-customer" className="text-xs text-muted-foreground">Nombre o razón social</label>
          {customer.id ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Cliente de tu base
            </span>
          ) : !disabled && !customer.name ? (
            <button type="button" onClick={setGenericCustomer} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
              <UserCheck className="h-3 w-3" /> Usar «Consumidor Final»
            </button>
          ) : null}
        </div>
        <div className="relative">
          <Input
            id="quote-customer"
            value={customer.name}
            disabled={disabled}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onPaste={handleNamePaste}
            onChange={(event) => onChange({ ...customer, id: null, name: event.target.value })}
            placeholder="Escribí para buscar en tus clientes o cargá uno nuevo"
            className={cn('h-11 rounded-xl pr-9 text-sm', customer.id && 'border-emerald-500/40')}
            autoComplete="off"
          />
          {customer.name && !disabled && (
            <button
              type="button"
              aria-label="Limpiar cliente"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
              onClick={() => onChange({ id: null, name: '', phone: '', email: '', ruc: '' })}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {focused && suggestions.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-popover p-1.5 shadow-xl">
            {suggestions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onChange({ id: item.id, name: item.name, phone: item.whatsapp || item.phone || '', email: item.email || '', ruc: item.ruc || '' })}
                >
                  <span className="block text-foreground">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[item.whatsapp || item.phone, item.ruc, item.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="quote-phone" className="flex items-center justify-between text-xs text-muted-foreground">
          <span>WhatsApp o teléfono</span>
          {waNumber && <span className="text-[11px] text-emerald-600 dark:text-emerald-400">+{waNumber}</span>}
        </label>
        <Input
          id="quote-phone"
          value={customer.phone}
          disabled={disabled}
          inputMode="tel"
          placeholder="0981 123 456"
          className="h-10 rounded-xl text-sm"
          onChange={(event) => onChange({ ...customer, phone: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="quote-ruc" className="text-xs text-muted-foreground">RUC o CI (opcional)</label>
        <Input
          id="quote-ruc"
          value={customer.ruc}
          disabled={disabled}
          placeholder="80012345-6"
          className="h-10 rounded-xl text-sm"
          onChange={(event) => onChange({ ...customer, ruc: event.target.value })}
        />
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Una línea del presupuesto: fila en escritorio, tarjeta en el celular
// -----------------------------------------------------------------------------
function QuoteLineRow({
  line,
  index,
  lineTotal,
  currency,
  editable,
  invalid,
  onChange,
  onDuplicate,
  onRemove,
}: {
  line: EditorLine
  index: number
  lineTotal: number
  currency: string
  editable: boolean
  invalid: boolean
  onChange: (patch: Partial<EditorLine>) => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const isCatalog = Boolean(line.product_id)
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_72px_128px_72px_112px_64px] md:items-center">
      <div className="col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1">
        {line.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={line.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md border object-cover" />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
            {isCatalog ? <Package className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {editable && !isCatalog ? (
            <Input
              value={line.description}
              placeholder="Qué incluye (ej.: mano de obra, flete)"
              aria-label={`Descripción línea ${index + 1}`}
              aria-invalid={invalid}
              className={cn('h-9 text-sm', invalid && 'border-destructive focus-visible:ring-destructive/30')}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          ) : (
            <p className="truncate text-sm text-foreground">{line.description}</p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isCatalog ? (line.sku ? `Catálogo · ${line.sku}` : 'Catálogo') : 'Línea libre · no mueve stock'}
          </p>
        </div>
      </div>

      <div className="col-span-2 grid grid-cols-3 gap-2 md:contents">
        <label className="space-y-1 md:space-y-0">
          <span className="text-[11px] text-muted-foreground md:sr-only">Cantidad</span>
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={line.quantity}
            disabled={!editable}
            aria-label={`Cantidad línea ${index + 1}`}
            className="h-9 text-center text-sm tabular-nums"
            onChange={(event) => onChange({ quantity: Math.max(1, Math.trunc(Number(event.target.value)) || 1) })}
          />
        </label>
        <label className="space-y-1 md:space-y-0">
          <span className="text-[11px] text-muted-foreground md:sr-only">Precio unitario</span>
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={line.unit_price}
            disabled={!editable}
            aria-label={`Precio línea ${index + 1}`}
            className="h-9 text-right text-sm tabular-nums"
            onChange={(event) => onChange({ unit_price: Math.max(0, Number(event.target.value) || 0), catalog: null })}
          />
        </label>
        <label className="space-y-1 md:space-y-0">
          <span className="text-[11px] text-muted-foreground md:sr-only">Descuento %</span>
          <Input
            type="number"
            min={0}
            max={100}
            step="any"
            inputMode="decimal"
            value={line.discount_rate}
            disabled={!editable}
            aria-label={`Descuento línea ${index + 1}`}
            className="h-9 text-center text-sm tabular-nums"
            onChange={(event) => onChange({ discount_rate: Math.min(100, Math.max(0, Number(event.target.value)) || 0) })}
          />
        </label>
      </div>

      <p className="self-center text-sm font-semibold tabular-nums text-foreground md:text-right">
        <span className="mr-1 text-xs text-muted-foreground md:hidden">Subtotal</span>
        {formatCurrency(lineTotal, { currency })}
      </p>

      {editable ? (
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={`Duplicar línea ${index + 1}`} title="Duplicar" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Quitar línea ${index + 1}`} title="Quitar" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <span className="hidden md:block" />
      )}
    </li>
  )
}

// -----------------------------------------------------------------------------
// Editor de presupuestos (nuevo y edición)
// -----------------------------------------------------------------------------
export function QuoteEditor({ quoteId }: { quoteId?: string }) {
  const router = useRouter()
  const { businessVertical, organizationName } = useSubscriptionStatus()
  const verticalMeta = useMemo(() => getQuoteVerticalConfig(businessVertical), [businessVertical])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [currency, setCurrency] = useState('PYG')
  const [storeName, setStoreName] = useState(organizationName || '')
  const [quote, setQuote] = useState<LoadedQuote | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sale, setSale] = useState<{ id: string; code: string } | null>(null)
  const [customer, setCustomer] = useState<Customer>({ id: null, name: '', phone: '', email: '', ruc: '' })
  const [priceMode, setPriceMode] = useState<PriceMode>('retail')
  const [validUntil, setValidUntil] = useState(defaultValidUntil(verticalMeta.defaultValidityDays))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<EditorLine[]>([])
  const [dirty, setDirty] = useState(false)
  const [recoveredDraftAvailable, setRecoveredDraftAvailable] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  // Los errores se marcan recién después del primer intento de guardar.
  const [showIssues, setShowIssues] = useState(false)
  // Lo más vendido del catálogo; null mientras carga.
  const [frequent, setFrequent] = useState<ProductResult[] | null>(null)

  const isNew = !quoteId
  const editable = !quote || EDITABLE_STATUSES.includes(quote.status)
  const totals = useMemo(() => computeTotals(lines, currency), [lines, currency])
  const issues = useMemo(() => findQuoteIssues(customer.name, lines), [customer.name, lines])
  const blockingIssues = issues.filter((issue) => issue.blocking)
  const invalidLines = new Set(showIssues ? issues.filter((issue) => issue.blocking && issue.line !== undefined).map((issue) => issue.line) : [])

  const applyLoaded = useCallback((loaded: LoadedQuote) => {
    setQuote(loaded)
    setCurrency(loaded.currency)
    setCustomer({
      id: loaded.customer_id,
      name: loaded.customer_name,
      phone: loaded.customer_phone ?? '',
      email: loaded.customer_email ?? '',
      ruc: loaded.customer_ruc ?? '',
    })
    setPriceMode(loaded.price_mode)
    setValidUntil(loaded.valid_until ?? '')
    setNotes(loaded.notes ?? '')
    setLines(
      loaded.items.map((item) => ({
        ...item,
        key: newKey(),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount_rate: Number(item.discount_rate),
        catalog: null,
      })),
    )
    setDirty(false)
  }, [])

  // Carga inicial
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
          if (body.storeName) setStoreName(body.storeName)
        } else {
          const body = await fetch('/api/quotes/lookup?type=meta').then((res) => res.json()).catch(() => ({}))
          if (cancelled) return
          if (body.currency) setCurrency(body.currency)
          if (body.storeName) setStoreName(body.storeName)
          try {
            const rawDraft = localStorage.getItem(LOCAL_DRAFT_KEY)
            if (rawDraft) {
              const parsed = JSON.parse(rawDraft)
              if (parsed && (parsed.customer?.name || parsed.lines?.length > 0)) setRecoveredDraftAvailable(true)
            }
          } catch {
            // Sin almacenamiento local no hay borrador que recuperar.
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [quoteId, applyLoaded, router])

  useEffect(() => {
    if (!editable) return
    let cancelled = false
    fetch('/api/quotes/lookup?type=frequent')
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((body) => {
        if (!cancelled) setFrequent(Array.isArray(body.results) ? body.results : [])
      })
      .catch(() => {
        if (!cancelled) setFrequent([])
      })
    return () => {
      cancelled = true
    }
  }, [editable])

  const touch = () => setDirty(true)

  // Un presupuesto nuevo se guarda en este dispositivo mientras se arma.
  useEffect(() => {
    if (!isNew || !dirty) return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ customer, priceMode, validUntil, notes, lines, savedAt: new Date().toISOString() }))
      } catch {
        // Sin almacenamiento local el borrador solo vive en la pantalla.
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [isNew, dirty, customer, priceMode, validUntil, notes, lines])

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(LOCAL_DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft.customer) setCustomer(draft.customer)
      if (draft.priceMode) setPriceMode(draft.priceMode)
      if (draft.validUntil) setValidUntil(draft.validUntil)
      if (draft.notes) setNotes(draft.notes)
      if (Array.isArray(draft.lines) && draft.lines.length > 0) setLines(draft.lines)
      setRecoveredDraftAvailable(false)
      setDirty(true)
      toast.success('Recuperamos tu borrador')
    } catch {
      toast.error('No se pudo recuperar el borrador')
    }
  }

  const discardDraft = () => {
    try {
      localStorage.removeItem(LOCAL_DRAFT_KEY)
    } catch {
      // Nada que borrar.
    }
    setRecoveredDraftAvailable(false)
  }

  const addLines = (next: EditorLine[]) => {
    setLines((current) => [...current, ...next])
    touch()
  }

  const updateLine = (key: string, patch: Partial<EditorLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
    touch()
  }

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key))
    touch()
  }

  const duplicateLine = (line: EditorLine) => addLines([{ ...line, key: newKey() }])

  const applyGlobalDiscount = (rate: number) => {
    setLines((current) => current.map((line) => ({ ...line, discount_rate: rate })))
    touch()
  }

  const changePriceMode = (mode: PriceMode) => {
    setPriceMode(mode)
    setLines((current) => current.map((line) => (line.catalog ? { ...line, unit_price: posUnitPrice(line.catalog, mode) } : line)))
    touch()
  }

  const insertQuickLine = (quick: QuoteQuickLine) => addLines([freeLine(quick.description, quick.defaultPrice ?? 0)])

  const applyStarterPackage = (pkg: QuoteStarterPackage) => {
    addLines(pkg.lines.map((item) => freeLine(item.description, item.unitPrice, item.quantity)))
    if (pkg.suggestedNotes && !notes.includes(pkg.suggestedNotes)) {
      setNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${pkg.suggestedNotes}` : pkg.suggestedNotes ?? ''))
    }
    toast.success(`«${pkg.title}» cargado: revisá los precios`)
  }

  const appendNote = (text: string) => {
    setNotes((prev) => (prev.includes(text) ? prev : prev.trim() ? `${prev.trim()}\n${text}` : text))
    touch()
  }
  const applyNotePreset = (preset: QuoteNotePreset) => appendNote(preset.text)

  const setValidityDays = (days: number) => {
    setValidUntil(defaultValidUntil(days))
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
    if (blockingIssues.length > 0) {
      setShowIssues(true)
      toast.error(blockingIssues[0].message)
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
      setShowIssues(false)
      if (isNew) {
        try {
          localStorage.removeItem(LOCAL_DRAFT_KEY)
        } catch {
          // Nada que borrar.
        }
        toast.success(`Presupuesto ${quoteCode(body.quote.number)} creado. Ya podés enviarlo.`)
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

  // Ctrl + S o Cmd + S guarda.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (editable && !saving) void save()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editable, saving, customer, lines, priceMode, validUntil, notes])

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
        toast.error(body.error || 'No se pudo actualizar el estado')
        return
      }
      setQuote((current) => (current ? { ...current, status: body.quote.status } : current))
      toast.success(success)
    } finally {
      setBusy(false)
    }
  }

  const generatedWhatsAppMessage = useMemo(() => {
    const firstName = customer.name.split(' ')[0] || customer.name || 'Cliente'
    const customIntro = verticalMeta.whatsappIntro
      ? verticalMeta.whatsappIntro
          .replace('{cliente}', firstName)
          .replace('{numero}', quote ? quoteCode(quote.number) : 'en borrador')
          .replace('{empresa}', storeName || 'nuestra empresa')
      : undefined

    return buildQuoteWhatsAppMessage({
      storeName: storeName || 'nuestra empresa',
      customerName: firstName,
      number: quote ? quote.number : 1,
      lines: totals.lines,
      total: totals.total,
      currency,
      validUntil: validUntil || null,
      url: shareUrl || 'https://tuempresa.com/presupuesto/ejemplo',
      customIntro,
    })
  }, [verticalMeta, customer.name, quote, storeName, totals, currency, validUntil, shareUrl])

  const sendWhatsApp = async () => {
    if (!quote || !shareUrl) return
    const phone = whatsappNumber(customer.phone)
    window.open(`https://wa.me/${phone ?? ''}?text=${encodeURIComponent(generatedWhatsAppMessage)}`, '_blank', 'noopener,noreferrer')
    if (quote.status === 'draft') await changeStatus('mark_sent', 'Marcado como enviado')
  }

  const copyText = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(success)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const duplicate = async () => {
    setBusy(true)
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload(), valid_until: defaultValidUntil(verticalMeta.defaultValidityDays) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(body.error || 'No se pudo duplicar el presupuesto')
        return
      }
      toast.success(`Copia creada: ${quoteCode(body.quote.number)}`)
      router.push(`/dashboard/quotes/${body.quote.id}`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!quote || !window.confirm('¿Eliminar este borrador?')) return
    const response = await fetch(`/api/quotes/${quote.id}`, { method: 'DELETE' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(body.error || 'No se pudo eliminar el borrador')
      return
    }
    toast.success('Borrador eliminado')
    router.replace('/dashboard/quotes')
  }

  // Accesos rápidos del catálogo real. Los productos con variantes se eligen desde el buscador.
  const quickCatalog = (frequent ?? []).filter(
    (product) => !(product.has_variants && (product.product_variants ?? []).some((variant) => variant.is_active !== false)),
  )
  // Solo sin catálogo se ofrecen los conceptos y combos genéricos del rubro.
  const catalogIsEmpty = frequent !== null && frequent.length === 0
  const freeLines = lines.filter((line) => !line.product_id).length
  const canConvert = Boolean(quote && CONVERTIBLE_STATUSES.includes(quote.status) && !dirty && lines.some((line) => line.product_id))
  const currentDiscount = lines.length > 0 && lines.every((line) => line.discount_rate === lines[0].discount_rate) ? lines[0].discount_rate : null

  // Aviso antes de salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-sm">Cargando presupuesto…</p>
      </div>
    )
  }

  const saveLabel = quote ? 'Guardar cambios' : 'Crear presupuesto'
  const saveDisabled = saving || (!dirty && Boolean(quote))
  const checklist = [
    { label: 'Cliente', done: Boolean(customer.name.trim()) },
    { label: 'Ítems con descripción', done: lines.length > 0 && !issues.some((issue) => issue.kind === 'empty_description') },
    { label: 'Validez', done: Boolean(validUntil) },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-28 md:pb-12">
      {isNew && recoveredDraftAvailable && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            Tenés un presupuesto sin terminar en este dispositivo.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={restoreDraft} className="h-8">Recuperarlo</Button>
            <Button size="sm" variant="ghost" onClick={discardDraft} className="h-8 text-muted-foreground">Empezar de cero</Button>
          </div>
        </div>
      )}

      {/* Encabezado */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link href="/dashboard/quotes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Presupuestos
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {quote ? `Presupuesto ${quoteCode(quote.number)}` : 'Nuevo presupuesto'}
            </h1>
            {quote && <QuoteStatusBadge status={quote.status} validUntil={quote.valid_until} />}
            {dirty && editable && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Sin guardar
              </span>
            )}
          </div>
          {sale ? (
            <p className="flex items-center gap-1 text-xs text-violet-700 dark:text-violet-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Convertido en la venta <strong>{sale.code}</strong>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{verticalMeta.name}</p>
          )}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button type="button" variant="outline" className="gap-2" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" /> Vista previa
          </Button>
          {editable && (
            <Button onClick={() => void save()} disabled={saveDisabled} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveLabel}
            </Button>
          )}
        </div>
      </header>

      {/* Acciones de un presupuesto ya creado */}
      {quote && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5">
          <Button
            size="sm"
            className="gap-1.5 bg-[#25D366] text-white hover:bg-[#1ebe5a]"
            onClick={() => void sendWhatsApp()}
            disabled={dirty || busy || quote.status === 'cancelled'}
          >
            <MessageCircle className="h-4 w-4" /> Enviar por WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => shareUrl && void copyText(shareUrl, 'Enlace copiado')} disabled={!shareUrl}>
            <Copy className="h-3.5 w-3.5" /> Copiar enlace
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" asChild>
            <a href={shareUrl ?? '#'} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> Ver o imprimir
            </a>
          </Button>
          {canConvert && (
            <Button size="sm" className="gap-1.5" asChild>
              <Link href={`/dashboard/pos?quoteId=${quote.id}`}>
                <ShoppingCart className="h-4 w-4" /> Cobrar en el POS
              </Link>
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {(quote.status === 'draft' || quote.status === 'sent') && (
              <>
                <Button size="sm" variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-400" onClick={() => void changeStatus('accept', 'Marcado como aceptado')} disabled={busy || dirty}>
                  <Check className="h-3.5 w-3.5" /> Aceptó
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-rose-700 dark:text-rose-400" onClick={() => void changeStatus('reject', 'Marcado como rechazado')} disabled={busy || dirty}>
                  <X className="h-3.5 w-3.5" /> Rechazó
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Más acciones">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {['rejected', 'cancelled', 'accepted'].includes(quote.status) && (
                  <DropdownMenuItem onSelect={() => void changeStatus('reopen', 'Presupuesto reabierto')} disabled={busy} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Reabrir
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => void duplicate()} disabled={busy} className="gap-2">
                  <CopyPlus className="h-4 w-4" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void copyText(generatedWhatsAppMessage, 'Mensaje copiado')} className="gap-2">
                  <MessageCircle className="h-4 w-4" /> Copiar mensaje
                </DropdownMenuItem>
                {quote.status === 'draft' ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void remove()} className="gap-2 text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" /> Borrar borrador
                    </DropdownMenuItem>
                  </>
                ) : (
                  !['cancelled', 'converted'].includes(quote.status) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => void changeStatus('cancel', 'Presupuesto anulado')} disabled={busy} className="gap-2 text-destructive focus:text-destructive">
                        <Ban className="h-4 w-4" /> Anular
                      </DropdownMenuItem>
                    </>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {dirty && (
            <p className="flex w-full items-center gap-1.5 px-1 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" /> Guardá los cambios para enviarlo o cobrarlo.
            </p>
          )}
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {/* 1. Cliente */}
          <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="quote-customer-title">
            <div id="quote-customer-title">
              <SectionTitle step={1} title="¿Para quién es?" hint="Buscá en tus clientes o cargá uno nuevo." done={Boolean(customer.name.trim())} />
            </div>
            <CustomerFields
              customer={customer}
              disabled={!editable}
              onChange={(next) => {
                setCustomer(next)
                touch()
              }}
            />
            {showIssues && !customer.name.trim() && (
              <p className="text-xs text-destructive">Indicá para quién es el presupuesto.</p>
            )}
          </section>

          {/* 2. Ítems */}
          <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="quote-items-title">
            <div className="flex flex-wrap items-start justify-between gap-3" id="quote-items-title">
              <SectionTitle
                step={2}
                title="¿Qué le cotizás?"
                hint={lines.length > 0 ? `${lines.length} ${lines.length === 1 ? 'ítem' : 'ítems'}` : 'Productos del catálogo, servicios o líneas libres.'}
                done={lines.length > 0 && !issues.some((issue) => issue.kind === 'empty_description')}
              />
              {editable && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => addLines([freeLine()])}>
                  <Plus className="h-3.5 w-3.5" /> Línea libre
                </Button>
              )}
            </div>

            {editable && (
              <div className="space-y-2.5">
                <ProductPicker priceMode={priceMode} currency={currency} onPick={(line) => addLines([line])} />
                {quickCatalog.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">Más vendidos:</span>
                    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                      {quickCatalog.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addLines([catalogLine(product, priceMode)])}
                          title={`${product.name} · ${product.stock_quantity} en stock`}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                        >
                          <Plus className="h-3 w-3 text-muted-foreground" />
                          <span className="max-w-40 truncate">{product.name}</span>
                          <span className="tabular-nums text-muted-foreground">{formatCurrency(posUnitPrice(product, priceMode), { currency })}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : catalogIsEmpty && verticalMeta.quickLines.length > 0 ? (
                  // Sin catálogo todavía: conceptos típicos del rubro como líneas libres.
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">Conceptos típicos:</span>
                    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                      {verticalMeta.quickLines.map((quick) => (
                        <button
                          key={quick.label}
                          type="button"
                          onClick={() => insertQuickLine(quick)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                        >
                          <Plus className="h-3 w-3 text-muted-foreground" />
                          {quick.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {lines.length === 0 ? (
              <div className="space-y-4 rounded-xl border border-dashed bg-muted/20 p-5 text-center">
                <PackagePlus className="mx-auto h-7 w-7 text-muted-foreground/70" />
                <div>
                  <p className="text-sm text-foreground">Todavía no hay ítems</p>
                  <p className="text-xs text-muted-foreground">Buscá en tu catálogo, tocá uno de los más vendidos o sumá una línea libre para algo que no está cargado.</p>
                </div>
                {editable && isNew && catalogIsEmpty && verticalMeta.starterPackages.length > 0 && (
                  <div className="space-y-2 text-left">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" /> Todavía no tenés productos cargados. Podés empezar con un ejemplo de {verticalMeta.name} (precios de referencia, editalos):
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {verticalMeta.starterPackages.map((pkg) => {
                        const packageTotal = pkg.lines.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => applyStarterPackage(pkg)}
                            className="rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm text-foreground">{pkg.title}</span>
                              <Badge variant="secondary" className="shrink-0 text-[10px]">{pkg.badge}</Badge>
                            </span>
                            <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{pkg.description}</span>
                            <span className="mt-2 block text-xs text-muted-foreground">
                              {pkg.lines.length} ítems · ~{formatCurrency(packageTotal, { currency })}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="hidden grid-cols-[minmax(0,1fr)_72px_128px_72px_112px_64px] gap-x-3 border-b pb-2 text-[11px] uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Ítem</span>
                  <span className="text-center">Cant.</span>
                  <span className="text-right">Precio</span>
                  <span className="text-center">Desc. %</span>
                  <span className="text-right">Subtotal</span>
                  <span />
                </div>
                <ul className="divide-y">
                  {lines.map((line, index) => (
                    <QuoteLineRow
                      key={line.key}
                      line={line}
                      index={index}
                      lineTotal={totals.lines[index]?.line_total ?? 0}
                      currency={currency}
                      editable={editable}
                      invalid={invalidLines.has(index)}
                      onChange={(patch) => updateLine(line.key, patch)}
                      onDuplicate={() => duplicateLine(line)}
                      onRemove={() => removeLine(line.key)}
                    />
                  ))}
                </ul>
                {freeLines > 0 && quote && CONVERTIBLE_STATUSES.includes(quote.status) && (
                  <p className="mt-3 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                    Al cobrarlo en el POS se cargan los ítems del catálogo; las {freeLines === 1 ? 'línea libre se agrega' : `${freeLines} líneas libres se agregan`} a mano.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* 3. Condiciones */}
          <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="quote-terms-title">
            <div id="quote-terms-title">
              <SectionTitle step={3} title="Condiciones" hint="Precios, validez y lo que el cliente tiene que saber." done={Boolean(validUntil)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Lista de precios</span>
                <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1" role="group" aria-label="Lista de precios">
                  {(['retail', 'wholesale'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={!editable}
                      aria-pressed={priceMode === mode}
                      onClick={() => changePriceMode(mode)}
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                        priceMode === mode ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {mode === 'retail' ? 'Minorista' : 'Mayorista'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="quote-valid" className="text-xs text-muted-foreground">Válido hasta</label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="quote-valid"
                    type="date"
                    value={validUntil}
                    disabled={!editable}
                    className="h-9 min-w-0 flex-1 rounded-xl text-sm"
                    onChange={(event) => {
                      setValidUntil(event.target.value)
                      touch()
                    }}
                  />
                  {editable &&
                    VALIDITY_SHORTCUTS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setValidityDays(days)}
                        className="shrink-0 rounded-lg border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={`Válido ${days} días desde hoy`}
                      >
                        {days}d
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="quote-notes" className="text-xs text-muted-foreground">Notas para el cliente</label>
                {editable && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
                        <Plus className="h-3.5 w-3.5" /> Agregar condición <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
                      <DropdownMenuLabel className="text-xs">Forma de pago</DropdownMenuLabel>
                      {PAYMENT_TERMS.map((term) => (
                        <DropdownMenuItem key={term} onSelect={() => appendNote(`• Forma de pago: ${term}`)} className="text-sm">
                          {term}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs">Entrega</DropdownMenuLabel>
                      {DELIVERY_TERMS.map((term) => (
                        <DropdownMenuItem key={term} onSelect={() => appendNote(`• Plazo de entrega: ${term}`)} className="text-sm">
                          {term}
                        </DropdownMenuItem>
                      ))}
                      {verticalMeta.notePresets.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs">Garantías y condiciones del rubro</DropdownMenuLabel>
                          {verticalMeta.notePresets.map((preset) => (
                            <DropdownMenuItem key={preset.title} onSelect={() => applyNotePreset(preset)} className="text-sm">
                              {preset.title}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <Textarea
                id="quote-notes"
                rows={4}
                value={notes}
                disabled={!editable}
                placeholder="Garantía, forma de pago, plazos de entrega…"
                className="resize-y rounded-xl text-sm leading-relaxed"
                onChange={(event) => {
                  setNotes(event.target.value)
                  touch()
                }}
              />
            </div>
          </section>
        </div>

        {/* Resumen fijo */}
        <aside className="space-y-4 lg:sticky lg:top-4" aria-label="Resumen del presupuesto">
          <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums text-foreground">{formatCurrency(totals.subtotal, { currency })}</span>
              </div>
              {totals.discount_total > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Descuentos</span>
                  <span className="tabular-nums">−{formatCurrency(totals.discount_total, { currency })}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="text-sm text-foreground">Total</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{formatCurrency(totals.total, { currency })}</span>
              </div>
            </div>

            {editable && lines.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Descuento a todos los ítems</span>
                <div className="grid grid-cols-4 gap-1 rounded-xl border bg-muted/40 p-1" role="group" aria-label="Descuento a todos los ítems">
                  {GLOBAL_DISCOUNTS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      aria-pressed={currentDiscount === rate}
                      onClick={() => applyGlobalDiscount(rate)}
                      className={cn(
                        'rounded-lg py-1 text-xs tabular-nums transition-colors',
                        currentDiscount === rate ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editable && (
              <ul className="space-y-1.5 border-t pt-3" aria-label="Qué falta">
                {checklist.map((item) => (
                  <li key={item.label} className={cn('flex items-center gap-2 text-xs', item.done ? 'text-muted-foreground' : 'text-foreground')}>
                    {item.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />}
                    {item.label}
                  </li>
                ))}
                {issues.filter((issue) => !issue.blocking).slice(0, 2).map((issue) => (
                  <li key={issue.message} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}

            {editable ? (
              <div className="hidden space-y-2 md:block">
                <Button onClick={() => void save()} disabled={saveDisabled} className="w-full gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saveLabel}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  {quote ? 'Ctrl + S para guardar' : 'Después lo enviás por WhatsApp o lo cobrás en el POS'}
                </p>
              </div>
            ) : (
              quote && (
                <p className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                  Este presupuesto ya no se puede editar. Para cambiarlo, usá <strong>Duplicar</strong> en el menú de acciones.
                </p>
              )
            )}
          </div>
        </aside>
      </div>

      {/* Vista previa: cómo lo ve el cliente y el mensaje de WhatsApp */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Vista previa</DialogTitle>
            <DialogDescription>Así lo ve tu cliente, con el mensaje que le llega por WhatsApp.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-4 rounded-xl border bg-background p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 border-b pb-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{storeName || 'Tu negocio'}</h3>
                  <p className="text-xs text-muted-foreground">Presupuesto para {customer.name || 'el cliente'}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline">{quote ? quoteCode(quote.number) : 'Borrador'}</Badge>
                  <p className="mt-1 text-[11px] text-muted-foreground">{validUntil ? `Válido hasta ${validUntil}` : 'Sin vencimiento'}</p>
                </div>
              </div>

              <div className="divide-y text-sm">
                {lines.length === 0 ? (
                  <p className="py-3 text-center text-muted-foreground">Todavía no hay ítems</p>
                ) : (
                  lines.map((line, index) => (
                    <div key={line.key} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-foreground">{line.description || 'Ítem sin descripción'}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.quantity} × {formatCurrency(line.unit_price, { currency })}
                          {line.discount_rate > 0 ? ` · ${line.discount_rate}% desc.` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(totals.lines[index]?.line_total ?? 0, { currency })}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="text-sm text-foreground">Total</span>
                <span className="text-xl font-semibold tabular-nums text-foreground">{formatCurrency(totals.total, { currency })}</span>
              </div>

              {notes && <p className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">{notes}</p>}
            </div>

            <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <MessageCircle className="h-4 w-4" /> Mensaje de WhatsApp
                </span>
                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => void copyText(generatedWhatsAppMessage, 'Mensaje copiado')}>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-background/80 p-3 font-sans text-xs text-foreground/90">
                {generatedWhatsAppMessage}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barra fija en el celular */}
      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-background/95 p-3 shadow-lg backdrop-blur md:hidden">
          <div>
            <span className="block text-[11px] text-muted-foreground">Total</span>
            <span className="text-base font-semibold tabular-nums text-foreground">{formatCurrency(totals.total, { currency })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => setPreviewOpen(true)} className="h-10 w-10" aria-label="Vista previa">
              <Eye className="h-4 w-4" />
            </Button>
            <Button onClick={() => void save()} disabled={saveDisabled} className="h-10 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {quote ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
