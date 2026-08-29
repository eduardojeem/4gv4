'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Truck,
  User,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useBranch } from '@/contexts/branch-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { validateDeliveryContact } from '@/lib/orders/creation-rules'
import { cn } from '@/lib/utils'
import { formatMoney } from './format'
import { BarcodeScanner } from '@/components/ui/barcode-scanner'

type ProductOption = {
  id: string
  name: string
  sku?: string | null
  sale_price?: number | null
  offer_price?: number | null
  stock_quantity?: number | null
  image_url?: string | null
  images?: string[] | null
}

type CustomerOption = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
}

type DraftItem = {
  productId: string
  name: string
  sku?: string | null
  quantity: number
  unitPrice: number
  stock: number | null
  imageUrl?: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PAYMENT_OPTIONS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'DIGITAL_WALLET', label: 'Billetera digital' },
]

const FULFILLMENT_OPTIONS = [
  { value: 'PICKUP', label: 'Retiro en local' },
  { value: 'DELIVERY', label: 'Delivery' },
]

const DELIVERY_COST_PRESETS = [0, 5000, 10000, 15000]

// Shared dark-theme control styles (matches the #0d1117 orders section)
const INPUT_DARK = 'border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-600 focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20'

export function CreateOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { selectedBranchId, selectedBranch } = useBranch()
  const { effectiveModules } = useSubscriptionStatus()
  const hasDelivery = effectiveModules.includes('delivery')
  const availableFulfillmentOptions = hasDelivery
    ? FULFILLMENT_OPTIONS
    : FULFILLMENT_OPTIONS.filter(option => option.value === 'PICKUP')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null)
  const [newCustomer, setNewCustomer] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [deliveryPhone, setDeliveryPhone] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [fulfillmentType, setFulfillmentType] = useState('PICKUP')
  const [shippingCost, setShippingCost] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [customersLoading, setCustomersLoading] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [productLimit, setProductLimit] = useState(12)
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const [customerCollapsed, setCustomerCollapsed] = useState(false)
  const [productsError, setProductsError] = useState('')
  const [customersError, setCustomersError] = useState('')
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [items])
  const total = Math.max(0, subtotal + shippingCost - discountAmount)
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0)
  const hasCustomer = newCustomer ? customerName.trim().length > 0 : !!customerId
  const effectiveDeliveryPhone = newCustomer ? customerPhone : deliveryPhone
  const effectiveDeliveryAddress = newCustomer ? customerAddress : deliveryAddress
  const deliveryReady = !validateDeliveryContact({
    fulfillmentType: fulfillmentType as 'PICKUP' | 'DELIVERY',
    phone: effectiveDeliveryPhone,
    address: effectiveDeliveryAddress,
  })
  const hasDraft = hasCustomer
    || items.length > 0
    || notes.trim().length > 0
    || shippingCost > 0
    || discountAmount > 0
    || fulfillmentType !== 'PICKUP'
    || paymentMethod !== 'CASH'

  // Load categories + brands once when the dialog opens (for the filters)
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void (async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          fetch('/api/categories', { signal: controller.signal }),
          fetch('/api/brands', { signal: controller.signal }),
        ])
        const catPayload = await catRes.json().catch(() => ({}))
        const brandPayload = await brandRes.json().catch(() => ({}))
        setCategories(Array.isArray(catPayload?.data) ? catPayload.data : [])
        setBrands(Array.isArray(brandPayload?.data) ? brandPayload.data : [])
      } catch {
        /* filters are optional — ignore load failures */
      }
    })()
    return () => controller.abort()
  }, [open])

  // Load products (text search + category/brand filters)
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setProductsLoading(true)
    const t = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          per_page: '24',
          query: productSearch,
          strict_branch_stock: 'true',
        })
        if (categoryFilter !== 'ALL') params.set('category_id', categoryFilter)
        if (brandFilter !== 'ALL') params.set('brand', brandFilter)
        if (selectedBranchId) params.set('branchId', selectedBranchId)
        const res = await fetch(`/api/products?${params}`, { signal: controller.signal })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.error || 'No se pudieron cargar los productos.')
        const all: ProductOption[] = Array.isArray(payload?.data?.products) ? payload.data.products : []
        setProducts(all.filter((p) => p.stock_quantity === null || (p.stock_quantity ?? 0) > 0))
        setProductsError('')
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          setProducts([])
          setProductsError(error instanceof Error ? error.message : 'No se pudieron cargar los productos.')
        }
      } finally {
        if (!controller.signal.aborted) setProductsLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(t); controller.abort() }
  }, [open, productSearch, categoryFilter, brandFilter, selectedBranchId])

  // Load customers
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setCustomersLoading(true)
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers?limit=20&search=${encodeURIComponent(customerSearch)}`,
          { signal: controller.signal }
        )
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(payload?.error || 'No se pudieron cargar los clientes.')
        setCustomers(Array.isArray(payload?.data) ? payload.data : [])
        setCustomersError('')
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          setCustomers([])
          setCustomersError(error instanceof Error ? error.message : 'No se pudieron cargar los clientes.')
        }
      } finally {
        if (!controller.signal.aborted) setCustomersLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(t); controller.abort() }
  }, [open, customerSearch])

  function reset() {
    setProductSearch(''); setCustomerSearch(''); setCustomerId('')
    setSelectedCustomer(null); setNewCustomer(false)
    setCustomerName(''); setCustomerEmail(''); setCustomerPhone(''); setCustomerAddress('')
    setDeliveryPhone(''); setDeliveryAddress('')
    setPaymentMethod('CASH'); setFulfillmentType('PICKUP')
    setShippingCost(0); setDiscountAmount(0); setNotes(''); setItems([])
    setCategoryFilter('ALL'); setBrandFilter('ALL')
    setCustomerCollapsed(false); setProductLimit(12)
    setProductsError(''); setCustomersError(''); setFullscreen(false)
    setConfirmCloseOpen(false)
  }

  function addProduct(product: ProductOption) {
    const price = Number(product.offer_price || product.sale_price || 0)
    const stock = product.stock_quantity != null ? Number(product.stock_quantity) : null
    const imageUrl = product.image_url || (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null)
    setItems((cur) => {
      const existing = cur.find((i) => i.productId === product.id)
      if (existing) {
        return cur.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: stock !== null ? Math.min(i.quantity + 1, stock) : i.quantity + 1 }
            : i
        )
      }
      return [...cur, { productId: product.id, name: product.name, sku: product.sku, quantity: 1, unitPrice: price, stock, imageUrl }]
    })
    setProductSearch('')
  }

  function changeQty(productId: string, delta: number) {
    setItems((cur) =>
      cur.map((i) => {
        if (i.productId !== productId) return i
        const next = Math.max(1, i.quantity + delta)
        const capped = i.stock !== null ? Math.min(next, i.stock) : next
        return { ...i, quantity: capped }
      })
    )
  }

  function removeItem(productId: string) {
    setItems((cur) => cur.filter((i) => i.productId !== productId))
  }

  function selectCustomer(c: CustomerOption) {
    setCustomerId(c.id)
    setSelectedCustomer(c)
    setDeliveryPhone(c.phone || '')
    setDeliveryAddress(c.address || '')
    setCustomerSearch('')
  }

  function requestClose() {
    if (loading) return
    if (hasDraft) {
      setConfirmCloseOpen(true)
      return
    }
    reset()
    onOpenChange(false)
  }

  function selectFulfillment(value: string) {
    setFulfillmentType(value)
    if (value === 'PICKUP') setShippingCost(0)
  }

  function validate(): string | null {
    if (items.length === 0) return 'Agrega al menos un producto.'
    if (!newCustomer && !customerId) return 'Selecciona un cliente o crea uno nuevo.'
    if (newCustomer && !customerName.trim()) return 'Ingresa el nombre del cliente.'
    if (newCustomer && customerEmail.trim() && !EMAIL_RE.test(customerEmail.trim())) {
      return 'El email no tiene un formato válido.'
    }
    const deliveryError = validateDeliveryContact({
      fulfillmentType: fulfillmentType as 'PICKUP' | 'DELIVERY',
      phone: effectiveDeliveryPhone,
      address: effectiveDeliveryAddress,
    })
    if (deliveryError) return deliveryError
    if (discountAmount > subtotal) return 'El descuento no puede superar el subtotal.'
    for (const item of items) {
      if (item.stock !== null && item.quantity > item.stock) {
        return `Stock insuficiente para "${item.name}". Disponible: ${item.stock}.`
      }
    }
    return null
  }

  async function submit() {
    const validationError = validate()
    if (validationError) {
      toast.error('Revisa el formulario', { description: validationError })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranchId,
          customerId: newCustomer ? null : customerId,
          customer: newCustomer
            ? { name: customerName.trim(), email: customerEmail.trim() || null, phone: customerPhone.trim() || null, address: customerAddress.trim() || null }
            : undefined,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          deliveryContact: fulfillmentType === 'DELIVERY'
            ? { phone: effectiveDeliveryPhone.trim(), address: effectiveDeliveryAddress.trim() }
            : undefined,
          paymentMethod,
          fulfillmentType,
          shippingCost,
          discountAmount,
          notes: notes.trim() || null,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || payload?.success === false) throw new Error(payload?.error ?? 'No se pudo crear el pedido.')
      toast.success('Pedido creado', { description: 'El pedido fue registrado exitosamente.' })
      reset()
      onOpenChange(false)
      onCreated()
    } catch (error) {
      toast.error('No se pudo crear el pedido', {
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) requestClose()
      else onOpenChange(true)
    }}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (fullscreen) {
            event.preventDefault()
            setFullscreen(false)
          }
        }}
        className={cn(
        '!flex !flex-col gap-0 overflow-hidden border-white/10 bg-[#0d1117] p-0 text-slate-100 shadow-2xl',
        fullscreen
          ? 'fixed inset-0 !top-0 !left-0 h-[100dvh] max-h-none w-[100dvw] !max-w-none !translate-x-0 !translate-y-0 rounded-none border-0'
          : 'h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] rounded-lg sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] lg:h-[90dvh] lg:max-w-[calc(100vw-4rem)] xl:!left-[calc(50%+128px)] xl:h-[88dvh] xl:w-[calc(100vw-288px)] xl:max-w-[1500px] 2xl:h-[min(88dvh,900px)]'
      )}>

        {/* ── Header ── */}
        <div className="relative flex shrink-0 items-center gap-3 border-b border-white/8 bg-gradient-to-r from-blue-500/10 via-blue-500/[0.04] to-transparent px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-950/30">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold leading-tight text-white">Nuevo pedido</DialogTitle>
            <p className="text-xs text-slate-400">
              {items.length > 0
                ? `${totalUnits} ud${totalUnits !== 1 ? 's' : ''}. · ${items.length} producto${items.length !== 1 ? 's' : ''} · ${selectedBranch?.name || 'Stock general'}`
                : `Completa los pasos · ${selectedBranch?.name || 'Stock general'}`}
            </p>
          </div>
          {/* Progress indicators */}
          <div className="hidden items-center gap-1.5 xl:flex">
            <StepPill n={1} label="Cliente" done={hasCustomer} />
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <StepPill n={2} label="Productos" done={items.length > 0} />
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <StepPill n={3} label="Entrega y pago" done={deliveryReady && !!paymentMethod} />
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <StepPill n={4} label="Confirmar" done={hasCustomer && items.length > 0 && deliveryReady && discountAmount <= subtotal} />
          </div>
          <div className="ml-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              aria-pressed={fullscreen}
              title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                fullscreen
                  ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30 hover:bg-blue-500/30'
                  : 'text-slate-400 hover:bg-white/8 hover:text-white'
              )}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className={cn(
          'min-h-0 flex-1 overflow-y-auto lg:grid lg:overflow-hidden',
          fullscreen
            ? 'lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_480px] 2xl:grid-cols-[minmax(0,1fr)_500px]'
            : 'lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]'
        )}>

          {/* Left — main content */}
          <div className="min-w-0 lg:min-h-0 lg:overflow-y-auto">

            {/* ── Step 1: Customer ── */}
            <section className="border-b border-white/8">
              <SectionHeader
                icon={<User className="h-4 w-4" />}
                title="Cliente"
                step={1}
                collapsible
                collapsed={customerCollapsed}
                onToggle={() => setCustomerCollapsed((v) => !v)}
                badge={
                  hasCustomer
                    ? <Badge className="gap-1 border-emerald-500/20 bg-emerald-500/15 text-[10px] text-emerald-300">
                        <Check className="h-3 w-3" /> {newCustomer ? customerName.trim() || 'Nuevo' : selectedCustomer?.name}
                      </Badge>
                    : undefined
                }
                action={
                  !customerCollapsed ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs font-medium text-slate-300 hover:bg-white/8 hover:text-white"
                      onClick={() => {
                        setNewCustomer((v) => !v)
                        setCustomerId('')
                        setSelectedCustomer(null)
                        setDeliveryPhone('')
                        setDeliveryAddress('')
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {newCustomer ? 'Elegir existente' : 'Crear nuevo'}
                    </Button>
                  ) : undefined
                }
              />
              {!customerCollapsed && (
              <div className="p-4">
                {newCustomer ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-400">Nombre <span className="text-rose-400">*</span></Label>
                      <Input className={cn('h-8 text-sm', INPUT_DARK)} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre completo" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-400">Email</Label>
                      <Input className={cn('h-8 text-sm', INPUT_DARK)} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@ejemplo.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-400">Teléfono</Label>
                      <Input className={cn('h-8 text-sm', INPUT_DARK)} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+595 9xx xxx xxx" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-400">Dirección</Label>
                      <Input className={cn('h-8 text-sm', INPUT_DARK)} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Calle, ciudad" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                      {customersLoading && <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-500" />}
                      <Input
                        className={cn('h-9 pl-9 text-sm', INPUT_DARK)}
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Buscar por nombre o teléfono…"
                        autoFocus={open}
                      />
                    </div>
                    {customersError && (
                      <p role="alert" className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                        {customersError}
                      </p>
                    )}
                    {customers.length > 0 && (
                      <div className="max-h-44 space-y-0.5 overflow-y-auto rounded-xl border border-white/8 bg-white/[0.02] p-1.5">
                        {customers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectCustomer(c)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/8',
                              customerId === c.id && 'bg-blue-500/10 ring-1 ring-blue-500/20'
                            )}
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold uppercase text-blue-300">
                              {c.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-200">{c.name}</p>
                              <p className="truncate text-xs text-slate-500">{c.phone || c.email || 'Sin contacto'}</p>
                            </div>
                            {customerId === c.id && <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                    {customerSearch && !customersLoading && customers.length === 0 && (
                      <p className="py-3 text-center text-xs text-slate-500">
                        Sin resultados — <button type="button" className="font-semibold text-blue-400 underline underline-offset-2 hover:text-blue-300" onClick={() => setNewCustomer(true)}>crear cliente nuevo</button>
                      </p>
                    )}
                  </div>
                )}
              </div>
              )}
            </section>

            {/* ── Step 2: Products ── */}
            <section className="border-b border-white/8">
              <SectionHeader
                icon={<Package className="h-4 w-4" />}
                title="Productos"
                step={2}
                badge={
                  items.length > 0
                    ? <Badge className="gap-1 border-blue-500/20 bg-blue-500/15 text-[10px] text-blue-300">
                        <ShoppingCart className="h-3 w-3" /> {items.length} en carrito
                      </Badge>
                    : undefined
                }
              />
              <div className="p-4 space-y-3">
                {/* Search + filters */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    {productsLoading && <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-500" />}
                    <Input
                      className={cn('h-9 pl-9 text-sm', INPUT_DARK)}
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Nombre, SKU o código de barras…"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && products.length === 1) {
                          e.preventDefault()
                          addProduct(products[0])
                        }
                      }}
                    />
                  </div>
                  <BarcodeScanner
                    onScan={(code) => setProductSearch(code)}
                    label="Escanear"
                    variant="outline"
                    size="sm"
                    className={cn('h-9 border-white/10 text-slate-300 hover:bg-white/8 hover:text-white')}
                  />
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className={cn('h-9 w-full text-sm sm:w-[170px]', INPUT_DARK)}>
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas las categorías</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={brandFilter} onValueChange={setBrandFilter}>
                    <SelectTrigger className={cn('h-9 w-full text-sm sm:w-[150px]', INPUT_DARK)}>
                      <SelectValue placeholder="Marca" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas las marcas</SelectItem>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Active filter chips */}
                {(categoryFilter !== 'ALL' || brandFilter !== 'ALL') && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {categoryFilter !== 'ALL' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-300">
                        {categories.find((c) => c.id === categoryFilter)?.name ?? 'Categoría'}
                        <button type="button" onClick={() => setCategoryFilter('ALL')} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {brandFilter !== 'ALL' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
                        {brandFilter}
                        <button type="button" onClick={() => setBrandFilter('ALL')} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    <button type="button" onClick={() => { setCategoryFilter('ALL'); setBrandFilter('ALL') }}
                      className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-300">
                      Limpiar
                    </button>
                  </div>
                )}

                {/* Product grid */}
                {productsError && (
                  <p role="alert" className="mb-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    {productsError}
                  </p>
                )}
                {products.length > 0 && (
                  <div className="space-y-3">
                    <div className={cn(
                      'grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                      fullscreen && '2xl:grid-cols-5'
                    )}>
                    {products.slice(0, productLimit).map((product) => {
                      const inCart = items.find((i) => i.productId === product.id)
                      const price = Number(product.offer_price || product.sale_price || 0)
                      const stock = product.stock_quantity != null ? Number(product.stock_quantity) : null
                      const outOfStock = stock !== null && stock <= 0
                      const imgSrc = product.image_url || (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null)
                      const lowStock = stock !== null && stock > 0 && stock <= 3
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => !outOfStock && addProduct(product)}
                          disabled={outOfStock}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50',
                            inCart
                              ? 'border-blue-500/40 bg-blue-500/[0.07] ring-1 ring-blue-500/15'
                              : 'border-white/8 bg-white/[0.02] hover:border-blue-500/30 hover:bg-white/[0.05]'
                          )}
                        >
                          {/* Thumbnail */}
                          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            {imgSrc ? (
                              <Image src={imgSrc} alt={product.name} fill sizes="56px" className="object-cover" />
                            ) : (
                              <Package className="h-6 w-6 text-slate-600" />
                            )}
                            {inCart && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-blue-600/85 text-white">
                                <span className="text-sm font-bold">×{inCart.quantity}</span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold leading-snug text-slate-100">{product.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{product.sku || 'Sin SKU'}</p>
                            {lowStock && (
                              <p className="mt-0.5 text-[11px] font-semibold text-amber-400">Solo {stock} en stock</p>
                            )}
                          </div>

                          {/* Price */}
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold tabular-nums text-white">{formatMoney(price)}</p>
                            {inCart && <p className="mt-0.5 text-[11px] font-semibold text-blue-400">En carrito</p>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {products.length > productLimit && (
                    <button
                      type="button"
                      onClick={() => setProductLimit((l) => l + 12)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 py-2.5 text-xs font-medium text-slate-400 transition-colors hover:border-blue-500/30 hover:bg-white/[0.04] hover:text-blue-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ver más productos ({products.length - productLimit} restantes)
                    </button>
                  )}
                  </div>
                )}

                {productsLoading && products.length === 0 && (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando productos…
                  </div>
                )}

                {(() => {
                  if (productsLoading || products.length > 0) return null
                  const hasFilter = productSearch || categoryFilter !== 'ALL' || brandFilter !== 'ALL'
                  return (
                    <p className="py-4 text-center text-sm text-slate-500">
                      {hasFilter
                        ? 'Ningún producto con stock coincide con la búsqueda o los filtros.'
                        : 'Buscá por nombre, SKU o marca, o filtrá por categoría para empezar.'}
                    </p>
                  )
                })()}
              </div>
            </section>

            {/* ── Step 3: Cart ── */}
            <section>
              <SectionHeader
                icon={<ShoppingCart className="h-4 w-4" />}
                title="Productos del pedido"
                step={2}
                badge={
                  items.length > 0
                    ? <Badge className="border-white/10 bg-white/10 text-[10px] text-slate-300">{totalUnits} ud{totalUnits !== 1 ? 's' : ''}.</Badge>
                    : undefined
                }
              />
              <div className="p-4">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 py-8 text-center">
                    <ShoppingBag className="h-8 w-8 text-slate-700" />
                    <p className="text-sm text-slate-400">Todavía no agregaste productos</p>
                    <p className="text-xs text-slate-600">Buscá arriba y hacé clic para agregar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.productId}
                        className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-3 transition-colors hover:bg-white/[0.04] sm:grid-cols-[48px_minmax(0,1fr)_auto_auto_auto] sm:px-4"
                      >
                        {/* Thumbnail */}
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.name} fill sizes="48px" className="object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-600" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-snug text-slate-100">{item.name}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                            {item.sku && <span className="mr-1.5 font-mono">{item.sku}</span>}
                            <span className="font-medium tabular-nums text-slate-300">{formatMoney(item.unitPrice)} c/u</span>
                            {item.stock !== null && item.quantity >= item.stock && (
                              <span className="ml-1.5 font-semibold text-amber-400">· stock máx.</span>
                            )}
                          </p>
                        </div>

                        {/* Qty controls */}
                        <div className="col-start-2 row-start-2 flex w-fit items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 sm:col-auto sm:row-auto">
                          <button
                            type="button"
                            onClick={() => changeQty(item.productId, -1)}
                            aria-label={`Reducir cantidad de ${item.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold tabular-nums text-white">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeQty(item.productId, 1)}
                            disabled={item.stock !== null && item.quantity >= item.stock}
                            aria-label={`Aumentar cantidad de ${item.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Subtotal */}
                        <span className="col-start-3 row-start-2 text-right text-sm font-bold tabular-nums text-white sm:col-auto sm:row-auto sm:w-24">
                          {formatMoney(item.quantity * item.unitPrice)}
                        </span>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          aria-label={`Quitar ${item.name}`}
                          className="col-start-3 row-start-1 flex h-8 w-8 items-center justify-center justify-self-end rounded-lg text-slate-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400 sm:col-auto sm:row-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ── Right column — config + summary ── */}
          <div className="flex flex-col border-t border-white/8 bg-white/[0.02] lg:min-h-0 lg:overflow-hidden lg:border-l lg:border-t-0">

            {/* Config */}
            <div className="space-y-5 p-5 lg:flex-1 lg:overflow-y-auto">

              {/* Delivery & Payment */}
              <div>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">Paso 3 · Entrega y pago</p>
                <div className="space-y-2">
                  {/* Fulfillment pills */}
                  <div className={cn('grid gap-2', hasDelivery ? 'grid-cols-2' : 'grid-cols-1')}>
                    {availableFulfillmentOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => selectFulfillment(opt.value)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-xl border py-3.5 text-xs font-medium transition-all',
                          fulfillmentType === opt.value
                            ? 'border-blue-500/50 bg-blue-500/12 text-blue-300 shadow-sm'
                            : 'border-white/8 bg-white/[0.02] text-slate-400 hover:border-white/15 hover:bg-white/[0.05]'
                        )}
                      >
                        {opt.value === 'DELIVERY'
                          ? <Truck className="h-5 w-5" />
                          : <Package className="h-5 w-5" />}
                        <span className="text-center text-xs font-medium leading-tight">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  {!hasDelivery ? (
                    <p className="text-xs text-slate-500">Las entregas están desactivadas para esta organización.</p>
                  ) : null}

                  {/* Payment method */}
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className={cn('h-10 text-sm', INPUT_DARK)}>
                      <Wallet className="mr-2 h-4 w-4 text-slate-500" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fulfillmentType === 'DELIVERY' && (
                    <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] p-3">
                      <p className="text-xs font-semibold text-blue-200">Datos para esta entrega</p>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-400">Teléfono de contacto</Label>
                        <Input
                          className={cn('h-9 text-sm', INPUT_DARK)}
                          value={newCustomer ? customerPhone : deliveryPhone}
                          onChange={(event) => newCustomer
                            ? setCustomerPhone(event.target.value)
                            : setDeliveryPhone(event.target.value)}
                          placeholder="+595 9xx xxx xxx"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-slate-400">Dirección de entrega</Label>
                        <Textarea
                          className={cn('min-h-16 resize-none text-sm', INPUT_DARK)}
                          value={newCustomer ? customerAddress : deliveryAddress}
                          onChange={(event) => newCustomer
                            ? setCustomerAddress(event.target.value)
                            : setDeliveryAddress(event.target.value)}
                          placeholder="Calle, número, barrio y referencia"
                          maxLength={500}
                        />
                      </div>
                      {!deliveryReady && (
                        <p role="alert" className="text-xs text-amber-300">
                          Completa teléfono y dirección para confirmar el delivery.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/8" />

              {/* Adjustments */}
              <div>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">Ajustes</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                      <Truck className="h-3.5 w-3.5" /> Costo de envío
                    </Label>
                    {fulfillmentType === 'DELIVERY' ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                          {DELIVERY_COST_PRESETS.map((cost) => (
                            <button
                              key={cost}
                              type="button"
                              aria-pressed={shippingCost === cost}
                              onClick={() => setShippingCost(cost)}
                              className={cn(
                                'h-9 rounded-md border px-2 text-xs font-semibold tabular-nums transition-colors',
                                shippingCost === cost
                                  ? 'border-blue-500/50 bg-blue-500/15 text-blue-200'
                                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-white'
                              )}
                            >
                              {cost === 0 ? 'Gratis' : formatMoney(cost)}
                            </button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          min={0}
                          className={cn('h-9 text-sm', INPUT_DARK)}
                          value={shippingCost}
                          onChange={(e) => setShippingCost(Math.max(0, Number(e.target.value || 0)))}
                          placeholder="Otro importe"
                          aria-label="Costo de delivery personalizado"
                        />
                      </>
                    ) : (
                      <p className="rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-slate-500">
                        Sin costo para retiro en local.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-400">Descuento</Label>
                    <Input
                      type="number" min={0} max={subtotal}
                      className={cn('h-9 text-sm', INPUT_DARK)}
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value || 0)))}
                      placeholder="0"
                    />
                    {discountAmount > subtotal && (
                      <p role="alert" className="text-xs text-rose-300">El descuento no puede superar el subtotal.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/8" />

              {/* Notes */}
              <div>
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">Notas internas</p>
                <Textarea
                  className={cn('resize-none text-sm', INPUT_DARK)}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Instrucciones especiales, referencias…"
                  maxLength={2000}
                />
              </div>
            </div>

            {/* Summary + CTA */}
            <div className="sticky bottom-0 space-y-4 border-t border-white/8 bg-[#0f151d] p-5 lg:static lg:bg-white/[0.03]">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Paso 4 · Confirmación</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-medium tabular-nums text-slate-300">{formatMoney(subtotal)}</span>
                </div>
                {shippingCost > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Envío</span>
                    <span className="font-medium tabular-nums text-slate-300">+{formatMoney(shippingCost)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Descuento</span>
                    <span className="font-medium tabular-nums">−{formatMoney(discountAmount)}</span>
                  </div>
                )}
                <div className="my-2 h-px bg-white/8" />
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white">Total</span>
                  <span className="text-lg font-bold tabular-nums text-blue-400">{formatMoney(total)}</span>
                </div>
              </div>

              <Button
                className="h-11 w-full gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition-all hover:bg-blue-500 disabled:opacity-40"
                onClick={submit}
                disabled={loading || items.length === 0 || !hasCustomer || !deliveryReady || discountAmount > subtotal}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando pedido…</>
                  : <><Check className="h-4 w-4" /> Confirmar pedido</>
                }
              </Button>

              {(items.length === 0 || !hasCustomer || !deliveryReady || discountAmount > subtotal) && (
                <p className="text-center text-xs text-slate-500">
                  {items.length === 0
                    ? 'Agrega al menos un producto'
                    : !hasCustomer
                      ? 'Selecciona un cliente primero'
                      : !deliveryReady
                        ? 'Completa los datos de entrega'
                        : 'Corrige el descuento para continuar'}
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Descartar este pedido?</AlertDialogTitle>
          <AlertDialogDescription>
            Los datos cargados y los productos del carrito se perderán.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Seguir editando</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rose-600 text-white hover:bg-rose-700"
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
          >
            Descartar pedido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

/* ── Helper components ── */

function StepPill({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors',
      done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-400'
    )}>
      {done
        ? <Check className="h-3 w-3" />
        : <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold">{n}</span>
      }
      {label}
    </div>
  )
}

function SectionHeader({
  icon, title, step, badge, action, collapsible, collapsed, onToggle,
}: {
  icon: React.ReactNode
  title: string
  step: number
  badge?: React.ReactNode
  action?: React.ReactNode
  collapsible?: boolean
  collapsed?: boolean
  onToggle?: () => void
}) {
  const inner = (
    <>
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-300">
        {icon}
      </div>
      <span className="text-xs font-semibold text-slate-100">{title}</span>
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-slate-400">{step}</span>
      {badge}
    </>
  )
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/8 bg-white/[0.03] px-4 py-2.5">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="group flex flex-1 items-center gap-2.5 text-left"
        >
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:text-slate-300', collapsed && '-rotate-90')} />
          {inner}
        </button>
      ) : (
        <div className="flex items-center gap-2.5">{inner}</div>
      )}
      {action}
    </div>
  )
}
