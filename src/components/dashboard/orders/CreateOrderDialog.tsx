'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { formatMoney } from './format'

type ProductOption = {
  id: string
  name: string
  sku?: string | null
  sale_price?: number | null
  offer_price?: number | null
  stock_quantity?: number | null
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
}

export function CreateOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { toast } = useToast()
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
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [fulfillmentType, setFulfillmentType] = useState('PICKUP')
  const [shippingCost, setShippingCost] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'review'>('form')

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [items])
  const total = subtotal + shippingCost

  // Load products
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?per_page=12&query=${encodeURIComponent(productSearch)}`, { signal: controller.signal })
        const payload = await res.json().catch(() => ({}))
        const all: ProductOption[] = Array.isArray(payload?.data?.products) ? payload.data.products : []
        setProducts(all.filter((p) => p.stock_quantity === null || (p.stock_quantity ?? 0) > 0))
      } catch {
        setProducts([])
      }
    }, 250)
    return () => { window.clearTimeout(t); controller.abort() }
  }, [open, productSearch])

  // Load customers
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?limit=20&search=${encodeURIComponent(customerSearch)}`, { signal: controller.signal })
        const payload = await res.json().catch(() => ({}))
        setCustomers(Array.isArray(payload?.data) ? payload.data : [])
      } catch {
        setCustomers([])
      }
    }, 250)
    return () => { window.clearTimeout(t); controller.abort() }
  }, [open, customerSearch])

  function reset() {
    setProductSearch(''); setCustomerSearch(''); setCustomerId('')
    setSelectedCustomer(null); setNewCustomer(false)
    setCustomerName(''); setCustomerEmail(''); setCustomerPhone(''); setCustomerAddress('')
    setPaymentMethod('CASH'); setFulfillmentType('PICKUP')
    setShippingCost(0); setNotes(''); setItems([]); setStep('form')
  }

  function addProduct(product: ProductOption) {
    const price = Number(product.offer_price || product.sale_price || 0)
    setItems((cur) => {
      const existing = cur.find((i) => i.productId === product.id)
      if (existing) return cur.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...cur, { productId: product.id, name: product.name, sku: product.sku, quantity: 1, unitPrice: price }]
    })
    setProductSearch('')
  }

  function changeQty(productId: string, delta: number) {
    setItems((cur) =>
      cur
        .map((i) => i.productId === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)
    )
  }

  function removeItem(productId: string) {
    setItems((cur) => cur.filter((i) => i.productId !== productId))
  }

  function selectCustomer(c: CustomerOption) {
    setCustomerId(c.id)
    setSelectedCustomer(c)
    setCustomerSearch('')
  }

  async function submit() {
    if (items.length === 0) {
      toast({ title: 'Pedido vacío', description: 'Agrega al menos un producto.', variant: 'destructive' })
      return
    }
    if (!newCustomer && !customerId) {
      toast({ title: 'Cliente requerido', description: 'Selecciona un cliente o crea uno nuevo.', variant: 'destructive' })
      return
    }
    if (newCustomer && !customerName.trim()) {
      toast({ title: 'Nombre requerido', description: 'Ingresa el nombre del cliente.', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: newCustomer ? null : customerId,
          customer: newCustomer ? { name: customerName, email: customerEmail, phone: customerPhone, address: customerAddress } : undefined,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
          paymentMethod, fulfillmentType, shippingCost, notes,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || payload?.success === false) throw new Error(payload?.error || 'No se pudo crear el pedido.')
      toast({ title: 'Pedido creado', description: 'El cliente ya puede verlo en seguimiento.' })
      reset()
      onOpenChange(false)
      onCreated()
    } catch (error) {
      toast({ title: 'No se pudo crear', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const customerLabel = newCustomer
    ? customerName || 'Nuevo cliente'
    : selectedCustomer?.name || 'Sin cliente'

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) { if (!next) reset(); onOpenChange(next) } }}>
      <DialogContent className="max-h-[92vh] max-w-5xl gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingCart className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">Nuevo pedido</DialogTitle>
              <p className="text-xs text-muted-foreground">
                {items.length > 0
                  ? `${items.length} producto${items.length !== 1 ? 's' : ''} · ${formatMoney(total)}`
                  : 'Agrega productos para comenzar'}
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {items.reduce((s, i) => s + i.quantity, 0)} uds.
            </Badge>
          )}
        </DialogHeader>

        <div className="overflow-y-auto">
          <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
            {/* ── Left column ── */}
            <div className="space-y-0 divide-y">
              {/* Customer section */}
              <div className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Cliente</span>
                    {(customerId || newCustomer) && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Check className="h-3 w-3 text-emerald-500" />
                        {customerLabel}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => {
                      setNewCustomer((v) => !v)
                      setCustomerId('')
                      setSelectedCustomer(null)
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {newCustomer ? 'Elegir existente' : 'Crear nuevo'}
                  </Button>
                </div>

                {newCustomer ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nombre *</Label>
                      <Input className="h-8 text-sm" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre completo" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input className="h-8 text-sm" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@ejemplo.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Teléfono</Label>
                      <Input className="h-8 text-sm" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+595 9xx xxx xxx" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Dirección</Label>
                      <Input className="h-8 text-sm" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Calle, ciudad" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-8 pl-8 text-sm"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Buscar cliente por nombre o teléfono…"
                      />
                    </div>
                    {customers.length > 0 && (
                      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border bg-popover p-1">
                        {customers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectCustomer(c)}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${customerId === c.id ? 'bg-primary/10 font-medium' : ''}`}
                          >
                            <span>{c.name}</span>
                            <span className="text-xs text-muted-foreground">{c.phone || c.email || ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {customerSearch && customers.length === 0 && (
                      <p className="py-2 text-center text-xs text-muted-foreground">Sin resultados. Prueba crear un cliente nuevo.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Products section */}
              <div className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Productos</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8 text-sm"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar por nombre o SKU…"
                  />
                </div>

                {products.length > 0 && (
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {products.slice(0, 8).map((product) => {
                      const inCart = items.find((i) => i.productId === product.id)
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addProduct(product)}
                          className={`group flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all hover:shadow-sm ${
                            inCart
                              ? 'border-primary/40 bg-primary/5'
                              : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{product.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {product.sku || 'Sin SKU'}
                              {product.stock_quantity != null && (
                                <span className="ml-1.5 opacity-60">· {product.stock_quantity} en stock</span>
                              )}
                            </span>
                          </span>
                          <span className="ml-3 shrink-0 text-right">
                            <span className="block text-sm font-bold tabular-nums">
                              {formatMoney(Number(product.offer_price || product.sale_price || 0))}
                            </span>
                            {inCart && (
                              <span className="block text-xs text-primary">×{inCart.quantity}</span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Cart section */}
              <div className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Carrito</span>
                  {items.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    Todavía no agregaste productos
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.productId} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.sku || 'Sin SKU'} · {formatMoney(item.unitPrice)}</p>
                        </div>
                        {/* Qty stepper */}
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => changeQty(item.productId, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                          <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => changeQty(item.productId, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <span className="w-20 text-right text-sm font-bold tabular-nums">{formatMoney(item.quantity * item.unitPrice)}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.productId)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right column — order config ── */}
            <div className="flex flex-col border-l bg-muted/20">
              <div className="flex-1 space-y-4 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configuración</p>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de entrega</Label>
                    <Select value={fulfillmentType} onValueChange={setFulfillmentType}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PICKUP">Retiro en local</SelectItem>
                        <SelectItem value="DELIVERY">Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Método de pago</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Efectivo</SelectItem>
                        <SelectItem value="CARD">Tarjeta</SelectItem>
                        <SelectItem value="TRANSFER">Transferencia</SelectItem>
                        <SelectItem value="DIGITAL_WALLET">Billetera digital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Costo de envío</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 text-sm"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(Math.max(0, Number(e.target.value || 0)))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Notas internas</Label>
                    <Textarea
                      className="resize-none text-sm"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Instrucciones especiales, referencias…"
                    />
                  </div>
                </div>
              </div>

              {/* Order summary + CTA */}
              <div className="border-t p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumen</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatMoney(subtotal)}</span>
                  </div>
                  {shippingCost > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Envío</span>
                      <span className="tabular-nums">{formatMoney(shippingCost)}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="tabular-nums">{formatMoney(total)}</span>
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={submit}
                  disabled={loading || items.length === 0}
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</>
                    : <><Check className="h-4 w-4" /> Confirmar pedido</>
                  }
                </Button>

                {items.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground">Agrega al menos un producto</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
