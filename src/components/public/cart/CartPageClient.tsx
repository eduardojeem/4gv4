'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Building2, CheckCircle2, CreditCard, Loader2,
  LogIn, Minus, Package, Phone, Plus, ShoppingCart, Store,
  Trash2, Truck, User, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { usePublicCart } from '@/hooks/use-public-cart'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useAuth } from '@/contexts/auth-context'
import { formatMoney } from '@/components/dashboard/orders/format'
import { resolveProductImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'

// ─── Types ────────────────────────────────────────────────────────────────────
type FulfillmentType = 'PICKUP' | 'DELIVERY'
type PaymentMethod  = 'CASH' | 'CARD' | 'TRANSFER' | 'DIGITAL_WALLET'
type OrderMode      = 'personal' | 'empresarial'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PM_ICON: Record<PaymentMethod, typeof Wallet> = {
  CASH: Wallet, CARD: CreditCard, TRANSFER: CreditCard, DIGITAL_WALLET: Wallet,
}

const PM_KEY_MAP: Record<PaymentMethod, 'cash' | 'card' | 'transfer' | 'digital_wallet'> = {
  CASH: 'cash', CARD: 'card', TRANSFER: 'transfer', DIGITAL_WALLET: 'digital_wallet',
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CartPageClient({
  organizationSlug,
  productsHref,
  trackHref,
}: {
  organizationSlug: string | null
  productsHref: string
  trackHref: string
}) {
  const { toast } = useToast()
  const { user, loading: loadingAuth, refreshUser } = useAuth()
  const { items, subtotal, setQuantity, removeItem, clear } = usePublicCart()
  const { settings: siteSettings } = useWebsiteSettings()
  const checkout = siteSettings?.checkout ?? getWebsiteSettingsDefaults().checkout

  // ── Checkout mode ─────────────────────────────────────────────────────────
  const [orderMode, setOrderMode] = useState<OrderMode>('personal')

  // ── Customer fields ───────────────────────────────────────────────────────
  const [customerName,    setCustomerName]    = useState('')
  const [customerEmail,   setCustomerEmail]   = useState('')
  const [customerPhone,   setCustomerPhone]   = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerCity,    setCustomerCity]    = useState('')
  const [customerReference, setCustomerReference] = useState('')

  // ── Business fields (empresarial mode) ────────────────────────────────────
  const [companyName, setCompanyName] = useState('')
  const [taxId,       setTaxId]       = useState('')   // RUC / NIT / CUIT

  // ── Order fields ──────────────────────────────────────────────────────────
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('PICKUP')
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>('CASH')
  const [notes,           setNotes]           = useState('')
  const [shippingCost,    setShippingCost]    = useState(0)

  // ── UI state ─────────────────────────────────────────────────────────────
  const [loading,             setLoading]             = useState(false)
  const [createdOrderNumber,  setCreatedOrderNumber]  = useState<string | null>(null)
  const [touched,             setTouched]             = useState(false)   // show validation only after submit attempt

  // ── Auto-fill from session ─────────────────────────────────────────────
  useEffect(() => {
    if (loadingAuth || !user) return

    const name = user.profile?.name || user.user_metadata?.name || ''
    const phone = user.profile?.phone || user.user_metadata?.phone || ''
    const email = user.email || ''
    const deliveryLocation = user.profile?.delivery_location

    if (name && !customerName) setCustomerName(name)
    if (email && !customerEmail) setCustomerEmail(email)
    if (phone && !customerPhone) setCustomerPhone(phone)
    if (deliveryLocation) {
      if (deliveryLocation.city && !customerCity) setCustomerCity(deliveryLocation.city)
      if (deliveryLocation.address && !customerAddress) setCustomerAddress(deliveryLocation.address)
      if (deliveryLocation.reference && !customerReference) setCustomerReference(deliveryLocation.reference)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingAuth, user])

  // ── Shipping cost: pre-load from settings when DELIVERY selected ─────────
  const isFreeDelivery = checkout.delivery.freeThreshold > 0 && subtotal >= checkout.delivery.freeThreshold

  useEffect(() => {
    if (fulfillmentType === 'PICKUP') {
      setShippingCost(0)
    } else {
      const configured = checkout.delivery.defaultCost ?? 0
      setShippingCost(isFreeDelivery ? 0 : configured)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillmentType, checkout.delivery.defaultCost, isFreeDelivery])

  // ── Derived totals ────────────────────────────────────────────────────────
  const total = Math.max(0, subtotal + shippingCost)

  // ── Validation ────────────────────────────────────────────────────────────
  const emailInvalid   = customerEmail.trim().length > 0 && !EMAIL_RE.test(customerEmail.trim())
  const nameError      = touched && !customerName.trim()  ? 'Requerido' : null
  const phoneError     = touched && !customerPhone.trim() ? 'Requerido' : null
  const emailFmtError  = touched && emailInvalid ? 'Formato de email inválido' : null
  const addressError   = touched && fulfillmentType === 'DELIVERY' && !customerAddress.trim() ? 'Requerido' : null
  const cityError      = touched && fulfillmentType === 'DELIVERY' && !customerCity.trim() ? 'Requerido' : null
  const referenceError = touched && fulfillmentType === 'DELIVERY' && !customerReference.trim() ? 'Requerido' : null
  const companyError   = touched && orderMode === 'empresarial' && !companyName.trim() ? 'Requerido' : null

  const isValid = useMemo(() => {
    if (!customerName.trim()) return false
    if (!customerPhone.trim()) return false
    if (emailInvalid) return false
    if (fulfillmentType === 'DELIVERY' && (!customerAddress.trim() || !customerCity.trim() || !customerReference.trim())) return false
    if (orderMode === 'empresarial' && !companyName.trim()) return false
    return items.length > 0
  }, [customerName, customerPhone, customerEmail, emailInvalid, fulfillmentType, customerAddress, customerCity, customerReference, orderMode, companyName, items.length])

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submitOrder() {
    setTouched(true)
    if (!isValid) return

    setLoading(true)
    try {
      const params = organizationSlug ? `?org=${encodeURIComponent(organizationSlug)}` : ''

      const notesParts: string[] = []
      if (notes.trim()) notesParts.push(notes.trim())
      if (orderMode === 'empresarial') {
        if (companyName) notesParts.push(`Empresa: ${companyName}`)
        if (taxId) notesParts.push(`RUC/NIT: ${taxId}`)
      }

      let finalAddress: string | null = null;
      if (fulfillmentType === 'DELIVERY') {
        const parts = [customerAddress.trim()];
        if (customerCity.trim()) parts.push(customerCity.trim());
        if (customerReference.trim()) parts.push(`(Ref: ${customerReference.trim()})`);
        finalAddress = parts.join(', ');
      }

      const response = await fetch(`/api/public/orders${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: customerName,
            email: customerEmail || null,
            phone: customerPhone || null,
            address: finalAddress,
          },
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          fulfillmentType,
          paymentMethod,
          shippingCost: fulfillmentType === 'DELIVERY' ? shippingCost : 0,
          notes: notesParts.join(' · ') || null,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || 'No se pudo crear el pedido.')
      }

      if (user && fulfillmentType === 'DELIVERY' && finalAddress) {
        try {
          const saveResponse = await fetch('/api/auth/delivery-location', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              city: customerCity,
              address: customerAddress,
              reference: customerReference,
              fullAddress: finalAddress,
            }),
          })
          if (saveResponse.ok) void refreshUser()
        } catch {
          // El pedido ya fue creado; guardar la direccion es una comodidad secundaria.
        }
      }

      clear()
      setCreatedOrderNumber(payload.data.order_number as string)
    } catch (error) {
      toast({
        title: 'No se pudo confirmar',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (createdOrderNumber) {
    return (
      <div className="container py-16 px-4 max-w-lg mx-auto">
        <Card className="overflow-hidden rounded-3xl border shadow-xl">
          <div className="h-1.5 bg-emerald-500" />
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 mb-5">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black">¡Pedido confirmado!</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              {checkout.confirmationMessage?.trim() || 'Tu pedido fue registrado. El negocio lo está gestionando.'}
            </p>
            <div className="mt-6 rounded-2xl border border-dashed bg-muted/30 px-8 py-4 text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Código de seguimiento</span>
              <div className="mt-1 font-mono text-2xl font-black text-primary tracking-wider">{createdOrderNumber}</div>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild className="flex-1 rounded-xl h-11">
                <Link href={`${trackHref}?orderNumber=${encodeURIComponent(createdOrderNumber)}`}>Rastrear pedido</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1 rounded-xl h-11">
                <Link href={productsHref}>Seguir comprando</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="container py-8 px-4 max-w-6xl mx-auto md:py-12">
      <Link href={productsHref}
        className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Volver a productos
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* ── Left: items + form ── */}
        <div className="space-y-6 min-w-0">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Mi Pedido</h1>
            <p className="mt-1 text-sm text-muted-foreground">Revisá los productos y completá tus datos para confirmar.</p>
          </div>

          {/* Session banner */}
          {!loadingAuth && (
            <div className={cn(
              'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm',
              user
                ? 'border-primary/20 bg-primary/5 text-primary'
                : 'border-border bg-muted/30 text-muted-foreground'
            )}>
              {user ? (
                <>
                  <User className="h-4 w-4 shrink-0" />
                  <span>
                    Hola, <strong>{user.profile?.name || user.email}</strong>. Tus datos fueron pre-cargados.
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 shrink-0" />
                  <span>¿Tenés cuenta? <Link href="/login" className="font-semibold text-primary hover:underline">Iniciá sesión</Link> para pre-cargar tus datos.</span>
                </>
              )}
            </div>
          )}

          {/* Cart items */}
          {items.length === 0 ? (
            <Card className="rounded-3xl border-dashed">
              <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/50 mb-4">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <h3 className="font-bold">Tu carrito está vacío</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-xs">Agregá productos desde la tienda para comenzar.</p>
                <Button asChild className="mt-5 rounded-xl"><Link href={productsHref}>Ver productos</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => {
                const image = resolveProductImageUrl(item.image)
                return (
                  <Card key={item.productId} className="rounded-2xl overflow-hidden">
                    <CardContent className="grid gap-4 p-4 sm:grid-cols-[72px_1fr_auto] sm:items-center">
                      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border bg-muted flex items-center justify-center">
                        {image
                          ? <Image src={image} alt={item.name} fill className="object-contain p-2" sizes="72px"
                              unoptimized={image.startsWith('data:') || image === '/placeholder-product.svg'} />
                          : <Package className="h-6 w-6 text-muted-foreground/40" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku || 'Sin SKU'} · {formatMoney(item.unitPrice)} c/u</p>
                        <div className="mt-2.5 flex w-fit items-center rounded-xl border bg-muted/40">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-l-xl"
                            onClick={() => setQuantity(item.productId, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="min-w-7 text-center text-xs font-bold">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-r-xl"
                            onClick={() => setQuantity(item.productId, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <strong className="font-black tabular-nums">{formatMoney(item.quantity * item.unitPrice)}</strong>
                        <button type="button" onClick={() => removeItem(item.productId)}
                          className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 font-semibold transition-colors">
                          <Trash2 className="h-3.5 w-3.5" /> Quitar
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* ── Checkout form ── */}
          {items.length > 0 && (
            <div className="space-y-5">

              {/* Mode toggle: Personal vs Empresarial */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de pedido</p>
                <div className="flex overflow-hidden rounded-xl border">
                  {(['personal', 'empresarial'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setOrderMode(mode)}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors',
                        orderMode === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {mode === 'personal'
                        ? <><User className="h-3.5 w-3.5" /> Personal</>
                        : <><Building2 className="h-3.5 w-3.5" /> Empresarial</>}
                    </button>
                  ))}
                </div>
                {orderMode === 'empresarial' && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Usá este modo para facturar a nombre de tu empresa (RUC/NIT).
                  </p>
                )}
              </div>

              {/* ── Contact fields ── */}
              <div className="space-y-4 rounded-2xl border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Contacto
                </p>

                {/* Business fields (empresarial mode) */}
                {orderMode === 'empresarial' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Razón social / Empresa <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Ej. Distribuidora XYZ S.A."
                          className={cn('pl-8 h-9 rounded-xl', companyError && 'border-destructive')} />
                      </div>
                      {companyError && <p className="text-[11px] text-destructive">{companyError}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">RUC / NIT / CUIT</Label>
                      <Input value={taxId} onChange={(e) => setTaxId(e.target.value)}
                        placeholder="Ej. 80123456-7"
                        className="h-9 rounded-xl" />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {orderMode === 'empresarial' ? 'Nombre del responsable' : 'Nombre completo'}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className={cn('h-9 rounded-xl', nameError && 'border-destructive')} />
                  {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Teléfono / WhatsApp <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                      <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Ej. +595 981 123 456"
                        className={cn('pl-8 h-9 rounded-xl', phoneError && 'border-destructive')} />
                    </div>
                    {phoneError && <p className="text-[11px] text-destructive">{phoneError}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email <span className="text-muted-foreground font-normal">(Opcional)</span></Label>
                    <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="juan@email.com"
                      className={cn('h-9 rounded-xl', emailFmtError && 'border-destructive')} />
                    {emailFmtError && <p className="text-[11px] text-destructive">{emailFmtError}</p>}
                  </div>
                </div>
              </div>

              {/* ── Fulfillment ── */}
              <div className="space-y-3 rounded-2xl border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> Entrega
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[
                    { value: 'PICKUP'   as const, label: '📦 Retiro en local',  desc: checkout.pickup.estimatedTime   ? `Listo en ${checkout.pickup.estimatedTime}` : 'Sin costo adicional', icon: Store, enabled: checkout.pickup.enabled   },
                    { value: 'DELIVERY' as const, label: '🛵 Delivery', desc: checkout.delivery.estimatedTime ? `Aprox. ${checkout.delivery.estimatedTime}` : 'Costo a coordinar',   icon: Truck, enabled: checkout.delivery.enabled },
                  ].filter((opt) => opt.enabled).map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setFulfillmentType(opt.value)}
                      className={cn(
                        'flex flex-col gap-2 p-3.5 text-left rounded-2xl border-2 transition-all',
                        fulfillmentType === opt.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-muted hover:border-border hover:bg-muted/10'
                      )}>
                      <div className={cn('p-1.5 w-fit rounded-xl transition-colors',
                        fulfillmentType === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        <opt.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {fulfillmentType === 'DELIVERY' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Ciudad / Barrio <span className="text-destructive">*</span></Label>
                        <Input value={customerCity} onChange={(e) => setCustomerCity(e.target.value)}
                          placeholder="Ej. Asunción, Carmelitas"
                          className={cn('h-9 rounded-xl', cityError && 'border-destructive')} />
                        {cityError && <p className="text-[11px] text-destructive">{cityError}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Calle y número <span className="text-destructive">*</span></Label>
                        <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)}
                          placeholder="Ej. Av. San Martín 123"
                          className={cn('h-9 rounded-xl', addressError && 'border-destructive')} />
                        {addressError && <p className="text-[11px] text-destructive">{addressError}</p>}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Referencias de la casa <span className="text-destructive">*</span></Label>
                      <Input value={customerReference} onChange={(e) => setCustomerReference(e.target.value)}
                        placeholder="Ej. Portón negro frente a la plaza"
                        className={cn('h-9 rounded-xl', referenceError && 'border-destructive')} />
                      {referenceError && <p className="text-[11px] text-destructive">{referenceError}</p>}
                    </div>

                    {/* Free shipping progress */}
                    {checkout.delivery.freeThreshold > 0 && subtotal < checkout.delivery.freeThreshold && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200/60 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
                        🎁 Agregá {formatMoney(checkout.delivery.freeThreshold - subtotal)} más para obtener <strong>envío gratis</strong>.
                      </div>
                    )}
                    {checkout.delivery.freeThreshold > 0 && subtotal >= checkout.delivery.freeThreshold && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200/60 px-3 py-2 text-[11px] text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                        ✅ ¡Superaste el mínimo para <strong>envío gratis</strong>!
                      </div>
                    )}
                    {checkout.delivery.zones && (
                      <p className="text-[11px] text-muted-foreground">📍 Cobertura: {checkout.delivery.zones}</p>
                    )}
                    {checkout.delivery.instructions && (
                      <p className="text-[11px] text-muted-foreground italic">{checkout.delivery.instructions}</p>
                    )}

                    {!isFreeDelivery && checkout.delivery.defaultCost > 0 && (
                      <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
                        <span className="text-sm font-semibold text-muted-foreground">Costo de envío</span>
                        <span className="text-sm font-bold">{formatMoney(checkout.delivery.defaultCost)}</span>
                      </div>
                    )}
                    {!isFreeDelivery && (!checkout.delivery.defaultCost || checkout.delivery.defaultCost === 0) && (
                      <div className="rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Costo de envío a coordinar</p>
                        <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
                          El negocio te informará el monto exacto tras confirmar el pedido.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Pickup instructions */}
                {fulfillmentType === 'PICKUP' && checkout.pickup.instructions && (
                  <p className="text-[11px] text-muted-foreground italic animate-in fade-in duration-200">
                    📍 {checkout.pickup.instructions}
                  </p>
                )}
              </div>

              {/* ── Payment ── */}
              <div className="space-y-3 rounded-2xl border p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Método de pago
                </p>
                {/* Only show enabled payment methods from settings */}
                {(() => {
                  const enabled = (
                    [
                      ['CASH', 'cash'], ['CARD', 'card'],
                      ['TRANSFER', 'transfer'], ['DIGITAL_WALLET', 'digital_wallet'],
                    ] as [PaymentMethod, keyof typeof checkout.payment][]
                  ).filter(([, key]) => checkout.payment[key]?.enabled !== false)

                  return (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {enabled.map(([pm, key]) => {
                        const cfg  = checkout.payment[key]
                        const Icon = PM_ICON[pm]
                        const sel  = paymentMethod === pm
                        const lbl  = cfg?.label || { CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', DIGITAL_WALLET: 'Billetera digital' }[pm]
                        return (
                          <button key={pm} type="button" onClick={() => setPaymentMethod(pm)}
                            className={cn(
                              'flex items-center gap-3 p-3 text-left rounded-xl border transition-all',
                              sel ? 'border-primary bg-primary/5 ring-1 ring-primary/10' : 'border-border hover:bg-muted/10'
                            )}>
                            <div className={cn('p-1.5 rounded-lg shrink-0', sel ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <p className="font-bold text-xs">{lbl}</p>
                          </button>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Contextual instructions from settings */}
                {checkout.payment[PM_KEY_MAP[paymentMethod]]?.instructions && (
                  <div className="rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                    {checkout.payment[PM_KEY_MAP[paymentMethod]]?.instructions}
                    {/* Bank details for transfer */}
                    {paymentMethod === 'TRANSFER' && (checkout.payment.transfer.bankAlias || checkout.payment.transfer.bankCbu) && (
                      <div className="mt-2 space-y-0.5 font-medium text-foreground">
                        {checkout.payment.transfer.bankAlias && <p>Alias: <strong>{checkout.payment.transfer.bankAlias}</strong></p>}
                        {checkout.payment.transfer.bankCbu   && <p>CBU: <strong>{checkout.payment.transfer.bankCbu}</strong></p>}
                        {checkout.payment.transfer.bankName  && <p>Banco: {checkout.payment.transfer.bankName}</p>}
                      </div>
                    )}
                    {/* Wallet alias */}
                    {paymentMethod === 'DIGITAL_WALLET' && checkout.payment.digital_wallet.walletAlias && (
                      <p className="mt-1 font-medium text-foreground">Alias: <strong>{checkout.payment.digital_wallet.walletAlias}</strong></p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Notes ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Notas adicionales <span className="font-normal normal-case">(opcional)</span>
                </Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Entregar antes de las 18 hs, sin cebolla, timbre roto…"
                  rows={2} maxLength={500}
                  className="rounded-xl resize-none" />
                <p className="text-[10px] text-right text-muted-foreground">{notes.length}/500</p>
              </div>

              {/* ── Submit ── */}
              <Button
                className="w-full h-12 rounded-2xl text-base font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                disabled={loading || items.length === 0}
                onClick={submitOrder}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando…</>
                  : <><CheckCircle2 className="h-4 w-4" /> Confirmar pedido</>
                }
              </Button>

              {touched && !isValid && (
                <p className="text-center text-xs text-destructive font-medium">
                  Completá los campos requeridos para continuar.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Right: summary ── */}
        <aside className="h-fit">
          <Card className="rounded-3xl border shadow-md sticky top-4">
            <CardHeader className="border-b bg-muted/20 px-5 py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" /> Resumen de compra
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Line items */}
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between items-start text-xs text-muted-foreground">
                    <span className="truncate pr-3 flex-1">
                      {item.quantity}× <strong className="text-foreground">{item.name}</strong>
                    </span>
                    <span className="tabular-nums font-medium text-foreground shrink-0">
                      {formatMoney(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Totals breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatMoney(subtotal)}</span>
                </div>

                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" /> Envío
                  </span>
                  <span className={cn('tabular-nums', (fulfillmentType === 'PICKUP' || (fulfillmentType === 'DELIVERY' && isFreeDelivery)) && 'text-emerald-600 dark:text-emerald-400 font-semibold')}>
                    {fulfillmentType === 'PICKUP'
                      ? 'Gratis'
                      : isFreeDelivery
                      ? 'Gratis'
                      : shippingCost > 0
                      ? formatMoney(shippingCost)
                      : <span className="italic text-muted-foreground/60 text-xs">A coordinar</span>
                    }
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary tabular-nums">{formatMoney(total)}</span>
                </div>
              </div>

              {/* Mode + fulfillment recap */}
              <div className="rounded-xl bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {orderMode === 'personal' ? <User className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                  <span className="font-semibold text-foreground capitalize">{orderMode}</span>
                  {orderMode === 'empresarial' && companyName && <span>· {companyName}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {fulfillmentType === 'PICKUP' ? <Store className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                  <span>{fulfillmentType === 'PICKUP' ? 'Retiro en local' : 'Delivery'}</span>
                </div>
              </div>

              {items.length > 0 && (
                <Button
                  className="w-full rounded-xl h-10 font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={loading || items.length === 0}
                  onClick={submitOrder}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirmar pedido
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
