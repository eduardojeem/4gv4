'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
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
  const [mobileActiveTab, setMobileActiveTab] = useState<'items' | 'config'>('items')

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
    setConfirmCloseOpen(false); setMobileActiveTab('items')
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
          '!flex !flex-col gap-0 overflow-hidden border-white/10 bg-[#0d1117] p-0 text-slate-100 shadow-2xl transition-all duration-200',
          fullscreen
            ? 'fixed inset-0 !top-0 !left-0 h-[100dvh] max-h-none w-[100dvw] !max-w-none !translate-x-0 !translate-y-0 rounded-none border-0'
            : 'inset-0 fixed h-[100dvh] w-screen max-w-none rounded-none sm:inset-auto sm:h-[94vh] sm:max-h-[94vh] sm:w-[96vw] sm:max-w-7xl sm:rounded-3xl sm:border sm:border-white/10 sm:top-[3vh] sm:left-1/2 sm:-translate-x-1/2 sm:translate-y-0'
        )}>

        {/* ── Header ── */}
        <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-blue-600/15 via-blue-500/5 to-transparent px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold tracking-tight text-white sm:text-lg">Nuevo pedido</DialogTitle>
                <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  {selectedBranch?.name || 'Stock general'}
                </span>
              </div>
              <p className="truncate text-xs text-slate-400">
                {items.length > 0
                  ? `${totalUnits} ud${totalUnits !== 1 ? 's' : ''}. · ${items.length} producto${items.length !== 1 ? 's' : ''} cargados`
                  : 'Carga productos, selecciona cliente y confirma'}
              </p>
            </div>
          </div>

          {/* Stepper indicators en desktop */}
          <div className="hidden items-center gap-1.5 lg:flex">
            <StepPill n={1} label="Cliente" done={hasCustomer} />
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <StepPill n={2} label="Productos" done={items.length > 0} />
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <StepPill n={3} label="Entrega y pago" done={deliveryReady && !!paymentMethod} />
            <ChevronRight className="h-3 w-3 text-slate-600" />
            <StepPill n={4} label="Confirmar" done={hasCustomer && items.length > 0 && deliveryReady && discountAmount <= subtotal} />
          </div>

          {/* Acciones de ventana */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
                fullscreen
                  ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              )}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Cerrar modal"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-rose-500/15 hover:text-rose-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Switcher de pestañas en Móvil (Catálogo / Resumen y Pago) ── */}
        <div className="flex items-center border-b border-white/10 bg-slate-900/60 p-1.5 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileActiveTab('items')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all',
              mobileActiveTab === 'items'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Package className="h-3.5 w-3.5" />
            <span>1. Cliente y Catálogo</span>
            {items.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold">
                {items.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileActiveTab('config')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all',
              mobileActiveTab === 'config'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <Truck className="h-3.5 w-3.5" />
            <span>2. Entrega y Pago</span>
            <span className="font-mono text-[11px] font-bold text-blue-200">
              {formatMoney(total)}
            </span>
          </button>
        </div>

        {/* ── Body (Dos columnas en lg, tabs en móvil) ── */}
        <div className={cn(
          'min-h-0 flex-1 overflow-y-auto lg:grid lg:overflow-hidden',
          fullscreen
            ? 'lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_480px]'
            : 'lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_440px]'
        )}>

          {/* ── Columna Izquierda: Cliente, Catálogo y Carrito ── */}
          <div className={cn(
            'min-w-0 flex flex-col lg:min-h-0 lg:overflow-y-auto divide-y divide-white/8',
            mobileActiveTab === 'items' ? 'block' : 'hidden lg:block'
          )}>

            {/* ── Paso 1: Cliente ── */}
            <section className="bg-slate-900/20">
              <SectionHeader
                icon={<User className="h-4 w-4" />}
                title="Cliente"
                step={1}
                collapsible
                collapsed={customerCollapsed}
                onToggle={() => setCustomerCollapsed((v) => !v)}
                badge={
                  hasCustomer ? (
                    <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/15 text-[10px] font-semibold text-emerald-300">
                      <Check className="h-3 w-3" /> {newCustomer ? customerName.trim() || 'Nuevo' : selectedCustomer?.name}
                    </Badge>
                  ) : undefined
                }
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 rounded-lg text-xs font-semibold text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                    onClick={() => {
                      setNewCustomer((v) => !v)
                      setCustomerId('')
                      setSelectedCustomer(null)
                      setDeliveryPhone('')
                      setDeliveryAddress('')
                      setCustomerCollapsed(false)
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {newCustomer ? 'Buscar existente' : 'Nuevo cliente'}
                  </Button>
                }
              />

              {!customerCollapsed && (
                <div className="p-4 sm:p-5">
                  {newCustomer ? (
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-3.5 sm:p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-300 uppercase tracking-wider">
                        <UserPlus className="h-3.5 w-3.5" /> Nuevo cliente
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-300">Nombre completo <span className="text-rose-400">*</span></Label>
                          <Input className={cn('h-9 text-sm rounded-xl', INPUT_DARK)} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ej: Juan Pérez" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-300">Teléfono</Label>
                          <Input className={cn('h-9 text-sm rounded-xl', INPUT_DARK)} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0981 xxx xxx" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-300">Email</Label>
                          <Input className={cn('h-9 text-sm rounded-xl', INPUT_DARK)} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="cliente@correo.com" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-300">Dirección</Label>
                          <Input className={cn('h-9 text-sm rounded-xl', INPUT_DARK)} value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Calle y número" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Cliente seleccionado actualmente */}
                      {selectedCustomer ? (
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 font-bold uppercase ring-1 ring-emerald-500/30">
                              {selectedCustomer.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-bold text-white">{selectedCustomer.name}</p>
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                                  <Check className="h-3 w-3" /> Seleccionado
                                </span>
                              </div>
                              <p className="truncate text-xs text-slate-400">
                                {selectedCustomer.phone || selectedCustomer.email || 'Sin datos de contacto'}
                                {selectedCustomer.address ? ` · ${selectedCustomer.address}` : ''}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCustomer(null)
                              setCustomerId('')
                            }}
                            className="h-8 rounded-lg px-2.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white shrink-0"
                          >
                            Cambiar
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            {customersLoading && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />}
                            <Input
                              className={cn('h-10 pl-10 text-sm rounded-xl', INPUT_DARK)}
                              value={customerSearch}
                              onChange={(e) => setCustomerSearch(e.target.value)}
                              placeholder="Buscar cliente por nombre, teléfono o email…"
                              autoFocus={open}
                            />
                          </div>

                          {customersError && (
                            <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                              {customersError}
                            </p>
                          )}

                          {customers.length > 0 && (
                            <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-white/8 bg-white/[0.02] p-2">
                              {customers.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => selectCustomer(c)}
                                  className={cn(
                                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all hover:bg-white/8',
                                    customerId === c.id ? 'bg-blue-500/15 ring-1 ring-blue-500/30' : ''
                                  )}
                                >
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-xs font-bold uppercase text-blue-300">
                                    {c.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-200">{c.name}</p>
                                    <p className="truncate text-xs text-slate-500">{c.phone || c.email || 'Sin contacto'}</p>
                                  </div>
                                  {customerId === c.id ? (
                                    <Check className="h-4 w-4 shrink-0 text-blue-400" />
                                  ) : (
                                    <span className="text-[11px] font-medium text-slate-500 opacity-0 group-hover:opacity-100">Elegir</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}

                          {customerSearch && !customersLoading && customers.length === 0 && (
                            <div className="rounded-xl border border-dashed border-white/10 py-3 text-center text-xs text-slate-400">
                              No encontramos clientes con esa búsqueda.{' '}
                              <button
                                type="button"
                                className="font-bold text-blue-400 underline underline-offset-2 hover:text-blue-300 ml-1"
                                onClick={() => setNewCustomer(true)}
                              >
                                Crear nuevo
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── Paso 2: Catálogo de Productos ── */}
            <section className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Catálogo de productos</h3>
                </div>
                {items.length > 0 && (
                  <Badge className="border-blue-500/30 bg-blue-500/10 text-xs font-bold text-blue-300">
                    {totalUnits} en pedido
                  </Badge>
                )}
              </div>

              {/* Barra de búsqueda y filtros */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  {productsLoading && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />}
                  <Input
                    className={cn('h-10 pl-10 text-sm rounded-xl', INPUT_DARK)}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar producto por nombre, SKU o código…"
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
                  className={cn('h-10 rounded-xl border-white/10 text-slate-300 hover:bg-white/8 hover:text-white px-3')}
                />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className={cn('h-10 w-full text-sm rounded-xl sm:w-[160px]', INPUT_DARK)}>
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
                  <SelectTrigger className={cn('h-10 w-full text-sm rounded-xl sm:w-[140px]', INPUT_DARK)}>
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

              {/* Filtros activos */}
              {(categoryFilter !== 'ALL' || brandFilter !== 'ALL') && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {categoryFilter !== 'ALL' && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                      {categories.find((c) => c.id === categoryFilter)?.name ?? 'Categoría'}
                      <button type="button" onClick={() => setCategoryFilter('ALL')} className="opacity-60 hover:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {brandFilter !== 'ALL' && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-slate-300">
                      {brandFilter}
                      <button type="button" onClick={() => setBrandFilter('ALL')} className="opacity-60 hover:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setCategoryFilter('ALL'); setBrandFilter('ALL') }}
                    className="text-xs font-medium text-slate-400 hover:text-white ml-1 transition-colors"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}

              {/* Grilla de productos */}
              {productsError && (
                <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  {productsError}
                </p>
              )}

              {products.length > 0 && (
                <div className="space-y-3">
                  <div className={cn(
                    'grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4',
                    fullscreen && 'xl:grid-cols-4 2xl:grid-cols-5'
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
                            'group relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-all',
                            inCart
                              ? 'border-blue-500/40 bg-blue-500/[0.08] ring-1 ring-blue-500/20 shadow-md shadow-blue-950/20'
                              : 'border-white/8 bg-white/[0.02] hover:border-blue-500/30 hover:bg-white/[0.05]',
                            outOfStock && 'opacity-40 cursor-not-allowed hover:border-white/8 hover:bg-white/[0.02]'
                          )}
                        >
                          {/* Imagen */}
                          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            {imgSrc ? (
                              <Image src={imgSrc} alt={product.name} fill sizes="56px" className="object-cover" />
                            ) : (
                              <Package className="h-6 w-6 text-slate-600" />
                            )}
                            {inCart && (
                              <div className="absolute inset-0 flex items-center justify-center bg-blue-600/90 text-white font-bold text-xs backdrop-blur-[1px]">
                                ×{inCart.quantity}
                              </div>
                            )}
                          </div>

                          {/* Datos */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold leading-tight text-slate-100">{product.name}</p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">{product.sku || 'Sin SKU'}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <p className="text-xs font-bold tabular-nums text-white">{formatMoney(price)}</p>
                              {lowStock && (
                                <span className="text-[10px] font-semibold text-amber-400">({stock} rest.)</span>
                              )}
                            </div>
                          </div>

                          {/* Botón agregar */}
                          <div className="shrink-0">
                            <div className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                              inCart
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/5 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'
                            )}>
                              <Plus className="h-4 w-4" />
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {products.length > productLimit && (
                    <button
                      type="button"
                      onClick={() => setProductLimit((l) => l + 12)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:border-blue-500/30 hover:bg-white/[0.04] hover:text-blue-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ver más productos ({products.length - productLimit} disponibles)
                    </button>
                  )}
                </div>
              )}

              {productsLoading && products.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" /> Buscando productos…
                </div>
              )}

              {!productsLoading && products.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-400">
                  No se encontraron productos disponibles con los filtros actuales.
                </div>
              )}
            </section>

            {/* ── Paso 3: Productos del pedido (Carrito) ── */}
            <section className="p-4 sm:p-5 space-y-3 bg-slate-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                    <ShoppingCart className="h-3.5 w-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Productos en este pedido</h3>
                </div>
                {items.length > 0 && (
                  <span className="text-xs font-mono font-bold text-slate-300">
                    Subtotal: {formatMoney(subtotal)}
                  </span>
                )}
              </div>

              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/12 py-8 text-center bg-white/[0.01]">
                  <ShoppingBag className="h-8 w-8 text-slate-700" />
                  <p className="text-sm font-medium text-slate-300">El pedido todavía no tiene productos</p>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Hacé clic sobre cualquier producto del catálogo superior para agregarlo.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3.5 transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.name} fill sizes="48px" className="object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{item.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            {item.sku && <span className="font-mono">{item.sku}</span>}
                            <span>·</span>
                            <span className="tabular-nums font-semibold text-slate-200">{formatMoney(item.unitPrice)} c/u</span>
                            {item.stock !== null && item.quantity >= item.stock && (
                              <span className="text-[11px] font-bold text-amber-400">· Tope stock</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controles de cantidad y precio */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-auto w-full sm:w-auto pt-2 sm:pt-0 border-t border-white/5 sm:border-0">
                        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                          <button
                            type="button"
                            onClick={() => changeQty(item.productId, -1)}
                            aria-label={`Reducir cantidad de ${item.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold tabular-nums text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeQty(item.productId, 1)}
                            disabled={item.stock !== null && item.quantity >= item.stock}
                            aria-label={`Aumentar cantidad de ${item.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="w-24 text-right">
                          <p className="text-sm font-bold tabular-nums text-white">
                            {formatMoney(item.quantity * item.unitPrice)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          aria-label={`Quitar ${item.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Columna Derecha: Configuración de Entrega, Pago y Resumen Total ── */}
          <div className={cn(
            'flex flex-col border-t border-white/10 bg-[#0d1219] lg:min-h-0 lg:overflow-hidden lg:border-l lg:border-t-0',
            mobileActiveTab === 'config' ? 'block' : 'hidden lg:flex'
          )}>

            {/* Configuración scrollable */}
            <div className="space-y-5 p-5 lg:flex-1 lg:overflow-y-auto">

              {/* Entrega y Pago */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                    <Truck className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Tipo de Entrega</p>
                </div>

                {/* Métodos de fulfillment */}
                <div className={cn('grid gap-2', hasDelivery ? 'grid-cols-2' : 'grid-cols-1')}>
                  {availableFulfillmentOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectFulfillment(opt.value)}
                      className={cn(
                        'flex items-center justify-center gap-2.5 rounded-2xl border py-3 px-3 text-xs font-bold transition-all',
                        fulfillmentType === opt.value
                          ? 'border-blue-500 bg-blue-500/15 text-white shadow-md shadow-blue-950/40 ring-1 ring-blue-500/30'
                          : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200'
                      )}
                    >
                      {opt.value === 'DELIVERY' ? <Truck className="h-4 w-4 text-blue-400" /> : <Package className="h-4 w-4 text-amber-400" />}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>

                {!hasDelivery && (
                  <p className="text-xs text-slate-500">Módulo de delivery no activo para esta organización.</p>
                )}

                {/* Datos de delivery */}
                {fulfillmentType === 'DELIVERY' && (
                  <div className="space-y-3 rounded-2xl border border-blue-500/30 bg-blue-500/[0.06] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-blue-200 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-blue-400" /> Datos de envío
                      </p>
                      {effectiveDeliveryPhone && (
                        <span className="text-[11px] font-mono text-blue-300">{effectiveDeliveryPhone}</span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300">Teléfono para el repartidor</Label>
                      <Input
                        className={cn('h-9 text-sm rounded-xl', INPUT_DARK)}
                        value={newCustomer ? customerPhone : deliveryPhone}
                        onChange={(event) => newCustomer
                          ? setCustomerPhone(event.target.value)
                          : setDeliveryPhone(event.target.value)}
                        placeholder="Ej: +595 981 123456"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300">Dirección exacta</Label>
                      <Textarea
                        className={cn('min-h-16 resize-none text-sm rounded-xl', INPUT_DARK)}
                        value={newCustomer ? customerAddress : deliveryAddress}
                        onChange={(event) => newCustomer
                          ? setCustomerAddress(event.target.value)
                          : setDeliveryAddress(event.target.value)}
                        placeholder="Calle, número de casa, barrio y referencias visuales"
                        maxLength={500}
                      />
                    </div>

                    {!deliveryReady && (
                      <p role="alert" className="text-xs font-medium text-amber-400">
                        ⚠ Completa teléfono y dirección de entrega para confirmar el delivery.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Método de pago */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                    <Wallet className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Método de Cobro</p>
                </div>

                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className={cn('h-10 text-sm rounded-xl', INPUT_DARK)}>
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
              </div>

              <div className="h-px bg-white/10" />

              {/* Costos y Descuento */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Costos y Descuento</p>

                {/* Costo de envío */}
                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between text-xs font-medium text-slate-300">
                    <span>Costo de envío</span>
                    <span className="font-mono font-bold text-slate-200">
                      {fulfillmentType === 'DELIVERY' ? (shippingCost === 0 ? 'Gratis' : formatMoney(shippingCost)) : 'Sin costo'}
                    </span>
                  </Label>

                  {fulfillmentType === 'DELIVERY' ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-1.5">
                        {DELIVERY_COST_PRESETS.map((cost) => (
                          <button
                            key={cost}
                            type="button"
                            aria-pressed={shippingCost === cost}
                            onClick={() => setShippingCost(cost)}
                            className={cn(
                              'h-8 rounded-xl border px-1 text-xs font-bold tabular-nums transition-all',
                              shippingCost === cost
                                ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white'
                            )}
                          >
                            {cost === 0 ? 'Gratis' : formatMoney(cost)}
                          </button>
                        ))}
                      </div>
                      <Input
                        type="number"
                        min={0}
                        className={cn('h-9 text-sm rounded-xl', INPUT_DARK)}
                        value={shippingCost}
                        onChange={(e) => setShippingCost(Math.max(0, Number(e.target.value || 0)))}
                        placeholder="Otro monto de envío"
                      />
                    </div>
                  ) : (
                    <p className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-slate-500">
                      Sin costo para retiro en tienda.
                    </p>
                  )}
                </div>

                {/* Descuento */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-300">Descuento aplicado</Label>
                  <Input
                    type="number"
                    min={0}
                    max={subtotal}
                    className={cn('h-9 text-sm rounded-xl', INPUT_DARK)}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value || 0)))}
                    placeholder="0"
                  />
                  {discountAmount > subtotal && (
                    <p role="alert" className="text-xs text-rose-400 font-medium">El descuento supera el subtotal.</p>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/10" />

              {/* Notas del pedido */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Observaciones / Notas</p>
                <Textarea
                  className={cn('resize-none text-sm rounded-xl', INPUT_DARK)}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notas para el repartidor o para la preparación del pedido…"
                  maxLength={2000}
                />
              </div>
            </div>

            {/* ── Summary & Confirm CTA ── */}
            <div className="border-t border-white/10 bg-slate-950/80 p-5 space-y-4 backdrop-blur-sm">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal productos ({totalUnits} uds.)</span>
                  <span className="font-semibold font-mono text-slate-200">{formatMoney(subtotal)}</span>
                </div>
                {shippingCost > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Envío</span>
                    <span className="font-semibold font-mono text-slate-200">+{formatMoney(shippingCost)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Descuento</span>
                    <span className="font-semibold font-mono">−{formatMoney(discountAmount)}</span>
                  </div>
                )}
                <div className="my-2 h-px bg-white/10" />
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-sm font-bold text-white uppercase tracking-wider">Total a cobrar</span>
                    <p className="text-[11px] text-slate-400">
                      {paymentMethod === 'CASH' ? 'Efectivo' : paymentMethod === 'CARD' ? 'Tarjeta' : paymentMethod === 'TRANSFER' ? 'Transferencia' : 'Billetera'} · {fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Retiro'}
                    </p>
                  </div>
                  <span className="text-2xl font-black font-mono tracking-tight text-blue-400">
                    {formatMoney(total)}
                  </span>
                </div>
              </div>

              <Button
                className="h-12 w-full gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-sm font-bold text-white shadow-xl shadow-blue-900/30 transition-all hover:from-blue-500 hover:to-blue-600 active:scale-[0.99] disabled:opacity-40"
                onClick={submit}
                disabled={loading || items.length === 0 || !hasCustomer || !deliveryReady || discountAmount > subtotal}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Registrando pedido…</>
                ) : (
                  <><Check className="h-4 w-4" /> Confirmar y crear pedido</>
                )}
              </Button>

              {(items.length === 0 || !hasCustomer || !deliveryReady || discountAmount > subtotal) && (
                <p className="text-center text-xs text-amber-400/90 font-medium">
                  {items.length === 0
                    ? 'Agrega al menos un producto al pedido'
                    : !hasCustomer
                      ? 'Selecciona o crea un cliente para continuar'
                      : !deliveryReady
                        ? 'Completa los datos de envío (teléfono y dirección)'
                        : 'El descuento no puede superar el subtotal'}
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
