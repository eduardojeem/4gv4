'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Building2, CheckCircle2, CreditCard, Loader2,
  LogIn, Minus, Package, Phone, Plus, ShoppingCart, Store,
  Tag, Trash2, Truck, User, Wallet, X, Copy, Check,
  HelpCircle, ChevronDown, ChevronUp, Sparkles, Receipt, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { usePublicCart } from '@/hooks/use-public-cart'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useAuth } from '@/contexts/auth-context'
import { formatMoney } from '@/components/dashboard/orders/format'
import { resolveProductImageUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import { getDeliveryCost } from '@/lib/checkout/delivery-cost'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { PublicStoreCredit } from '@/components/public/store-credit/PublicStoreCredit'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { buildPublicOrderRequest } from './checkout-contract'
import { matchDeliveryZone } from '@/lib/checkout/delivery-zone'

// ─── Types ────────────────────────────────────────────────────────────────────
type FulfillmentType = 'PICKUP' | 'DELIVERY'
type PaymentMethod  = 'CASH' | 'CARD' | 'TRANSFER' | 'DIGITAL_WALLET'
type OrderMode      = 'personal' | 'empresarial'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const OTHER_DELIVERY_ZONE_ID = 'other'

const PM_ICON: Record<PaymentMethod, typeof Wallet> = {
  CASH: Wallet, CARD: CreditCard, TRANSFER: CreditCard, DIGITAL_WALLET: Wallet,
}

const PM_KEY_MAP: Record<PaymentMethod, 'cash' | 'card' | 'transfer' | 'digital_wallet'> = {
  CASH: 'cash', CARD: 'card', TRANSFER: 'transfer', DIGITAL_WALLET: 'digital_wallet',
}

function getCartItemDisplayName(item: { name: string; variantName?: string | null }) {
  if (!item.variantName) return item.name
  const suffix = ` (${item.variantName})`
  return item.name.endsWith(suffix) ? item.name.slice(0, -suffix.length) : item.name
}

const checkoutSteps = [
  {
    icon: ShoppingCart,
    title: 'Revisá tu carrito',
    description: 'Confirmá productos, variantes, cantidades y el precio mostrado.',
    example: 'Ejemplo: 2 remeras, talle M, color negro.',
  },
  {
    icon: User,
    title: 'Completá tus datos',
    description: 'Elegí pedido personal o empresarial e ingresá un WhatsApp de contacto.',
    example: 'Ejemplo: Ana López · 0981 123 456.',
  },
  {
    icon: Truck,
    title: 'Elegí cómo recibirlo',
    description: 'Podés retirar en el local o ingresar ciudad, barrio y dirección para delivery.',
    example: 'Ejemplo: Encarnación · Centro · Av. Japón 120.',
  },
  {
    icon: CreditCard,
    title: 'Revisá y confirmá',
    description: 'Antes de enviarlo verás el resumen final. Luego recibirás un código de seguimiento.',
    example: 'Ejemplo: pedido #SC-1049 pendiente de confirmación.',
  },
]

const realExamples = [
  {
    badge: 'Personal + delivery',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    title: 'Compra para recibir en casa',
    scenario: 'Lucas compra auriculares y solicita entrega en Encarnación, Centro.',
    flow: [
      'Selecciona Pedido personal.',
      'Ingresa ciudad, barrio, calle y referencia.',
      'El sistema detecta la tarifa de delivery.',
      'Revisa el total y confirma el pedido.',
    ],
  },
  {
    badge: 'Empresa + retiro',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    title: 'Compra empresarial con RUC',
    scenario: 'Laura compra insumos para su empresa y los retirará en el local.',
    flow: [
      'Selecciona Pedido empresarial.',
      'Completa razón social, RUC y responsable.',
      'Elige retiro en local, sin costo de envío.',
      'La tienda recibe la solicitud de factura.',
    ],
  },
  {
    badge: 'Retiro en local',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    title: 'Pedido rápido sin delivery',
    scenario: 'Martín reserva un producto para retirarlo cuando la tienda lo confirme.',
    flow: [
      'Agrega el producto y verifica la cantidad.',
      'Elige Retiro en local.',
      'Selecciona cómo pagará.',
      'Espera la confirmación antes de ir al local.',
    ],
  },
  {
    badge: 'Otra zona',
    badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
    title: 'Delivery fuera de la zona gratuita',
    scenario: 'Sofía vive en un barrio que no figura entre las zonas específicas.',
    flow: [
      'Ingresa su ciudad y barrio reales.',
      'El sistema aplica la tarifa general configurada.',
      'Completa calle y referencia.',
      'Revisa el costo de envío antes de confirmar.',
    ],
  },
]

function CheckoutHowItWorks() {
  const [activeTab, setActiveTab] = useState<'steps' | 'examples'>('steps')
  const [expanded, setExpanded] = useState(false)

  return (
    <section
      aria-labelledby="checkout-how-it-works-title"
      className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 id="checkout-how-it-works-title" className="text-sm font-bold text-foreground">
              ¿Cómo funciona este pedido?
            </h2>
            <p className="text-xs text-muted-foreground">
              Revisá los pasos y ejemplos antes de confirmar. La tienda validará stock, pago y entrega.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-controls="checkout-help-content"
          onClick={() => setExpanded((current) => !current)}
          className="w-full shrink-0 gap-1.5 rounded-xl sm:w-auto"
        >
          {expanded ? 'Ocultar' : 'Ver guía'}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {expanded && (
        <div id="checkout-help-content" className="mt-4 border-t border-border/60 pt-4">
        <div role="tablist" aria-label="Ayuda para realizar el pedido" className="grid grid-cols-2 gap-1 bg-muted/60 p-1 rounded-xl border border-border/80 text-xs font-bold">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'steps'}
            onClick={() => setActiveTab('steps')}
            className={cn(
              'min-h-9 px-3 py-1 rounded-lg transition-all',
              activeTab === 'steps'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Paso a paso
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'examples'}
            onClick={() => setActiveTab('examples')}
            className={cn(
              'min-h-9 px-3 py-1 rounded-lg transition-all',
              activeTab === 'examples'
                ? 'bg-background text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Ver ejemplos
          </button>
        </div>

      {/* Tab 1: Pasos */}
      {activeTab === 'steps' ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {checkoutSteps.map(({ icon: Icon, title, description, example }, index) => (
            <div key={title} className="flex gap-3 rounded-2xl border border-border/70 bg-muted/30 p-3.5 transition-all hover:bg-muted/50">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-black text-primary-foreground shadow-2xs">
                {index + 1}
              </span>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <p className="text-xs font-bold text-foreground">{title}</p>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
                <p className="text-[10px] font-semibold text-primary/80 dark:text-primary/90 italic">{example}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Tab 2: Ejemplos */
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {realExamples.map((ex) => (
            <div key={ex.title} className="flex flex-col justify-between rounded-2xl border border-border/70 bg-muted/30 p-4 space-y-3">
              <div className="space-y-2">
                <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-extrabold', ex.badgeColor)}>
                  {ex.badge}
                </span>
                <h3 className="text-xs font-bold text-foreground leading-snug">{ex.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed italic">{ex.scenario}</p>
              </div>

              <div className="pt-2 border-t border-border/50 space-y-1 text-[11px] text-muted-foreground">
                {ex.flow.map((step, idx) => (
                  <p key={idx} className="flex gap-1.5 leading-snug"><span className="font-bold text-primary">{idx + 1}.</span><span>{step}</span></p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
        </div>
      )}
    </section>
  )
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
  const customerLoginHref = organizationSlug
    ? `/${organizationSlug}/cliente/login?next=${encodeURIComponent(`/${organizationSlug}/carrito`)}`
    : '/login?redirect=/carrito'
  const { user, loading: loadingAuth, refreshUser } = useAuth()
  const { items, subtotal, setQuantity, setAvailableStock, setUnitPrice, removeItem, clear } = usePublicCart()
  const { settings: siteSettings } = useWebsiteSettings()
  const checkout = siteSettings?.checkout ?? getWebsiteSettingsDefaults().checkout
  const transferOptions = checkout.payment.transfer.transferOptions ?? []
  const deliveryZones = useMemo(() => checkout.delivery.zoneOptions ?? [], [checkout.delivery.zoneOptions])

  // ── Checkout mode ─────────────────────────────────────────────────────────
  const [orderMode, setOrderMode] = useState<OrderMode>('personal')
  const [showModeComparison, setShowModeComparison] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = (text: string, fieldKey: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldKey)
    toast.success(`${label} copiado al portapapeles`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // ── Customer fields ───────────────────────────────────────────────────────
  const [customerName,    setCustomerName]    = useState('')
  const [customerEmail,   setCustomerEmail]   = useState('')
  const [customerPhone,   setCustomerPhone]   = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerCity,    setCustomerCity]    = useState('')
  const [customerNeighborhood, setCustomerNeighborhood] = useState('')
  const [customerReference, setCustomerReference] = useState('')

  // ── Business fields (empresarial mode) ────────────────────────────────────
  const [companyName, setCompanyName] = useState('')
  const [taxId,       setTaxId]       = useState('')   // RUC

  // ── Order fields ──────────────────────────────────────────────────────────
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('PICKUP')
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>('CASH')
  const [notes,           setNotes]           = useState('')
  const [shippingCost,    setShippingCost]    = useState(0)
  const [selectedDeliveryZoneId, setSelectedDeliveryZoneId] = useState('')
  const [promotionCode, setPromotionCode] = useState('')
  const [validatingPromotion, setValidatingPromotion] = useState(false)
  const [appliedPromotion, setAppliedPromotion] = useState<{ code: string; name: string; discountAmount: number } | null>(null)
  const [storeCreditAmount, setStoreCreditAmount] = useState(0)

  // ── UI state ─────────────────────────────────────────────────────────────
  const [loading,             setLoading]             = useState(false)
  const [createdOrderNumber,  setCreatedOrderNumber]  = useState<string | null>(null)
  const [touched,             setTouched]             = useState(false)   // show validation only after submit attempt
  const [showConfirmation, setShowConfirmation] = useState(false)
  const checkoutAttemptId = useRef<string>(crypto.randomUUID())

  useEffect(() => {
    const enabled = ([
      ['CASH', checkout.payment.cash.enabled],
      ['CARD', checkout.payment.card.enabled],
      ['TRANSFER', checkout.payment.transfer.enabled],
      ['DIGITAL_WALLET', checkout.payment.digital_wallet.enabled],
    ] as const).filter(([, isEnabled]) => isEnabled !== false).map(([method]) => method)
    if (!enabled.includes(paymentMethod) && enabled[0]) setPaymentMethod(enabled[0])
  }, [checkout.payment, paymentMethod])

  useEffect(() => {
    if (fulfillmentType === 'PICKUP' && checkout.pickup.enabled === false && checkout.delivery.enabled !== false) {
      setFulfillmentType('DELIVERY')
    } else if (fulfillmentType === 'DELIVERY' && checkout.delivery.enabled === false && checkout.pickup.enabled !== false) {
      setFulfillmentType('PICKUP')
    }
  }, [checkout.delivery.enabled, checkout.pickup.enabled, fulfillmentType])

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
  const selectedDeliveryZone = deliveryZones.find((zone) => zone.id === selectedDeliveryZoneId)
  const isOtherDeliveryZone = selectedDeliveryZoneId === OTHER_DELIVERY_ZONE_ID

  useEffect(() => {
    if (fulfillmentType !== 'DELIVERY' || !customerCity.trim() || !customerNeighborhood.trim()) return
    const match = matchDeliveryZone(deliveryZones, customerCity, customerNeighborhood)
    if (match) {
      setSelectedDeliveryZoneId(match.id)
    } else if (checkout.delivery.defaultCost > 0) {
      setSelectedDeliveryZoneId(OTHER_DELIVERY_ZONE_ID)
    } else {
      setSelectedDeliveryZoneId('')
    }
  }, [checkout.delivery.defaultCost, customerCity, customerNeighborhood, deliveryZones, fulfillmentType])
  const hasFreeDelivery = isFreeDelivery || selectedDeliveryZone?.cost === 0

  useEffect(() => {
    setShippingCost(getDeliveryCost({
      fulfillmentType,
      subtotal,
      defaultCost: deliveryZones.length > 0 && !isOtherDeliveryZone ? 0 : checkout.delivery.defaultCost ?? 0,
      selectedZoneCost: selectedDeliveryZone?.cost,
      freeThreshold: checkout.delivery.freeThreshold,
    }))
  }, [
    checkout.delivery.defaultCost,
    checkout.delivery.freeThreshold,
    deliveryZones.length,
    fulfillmentType,
    selectedDeliveryZone?.cost,
    isOtherDeliveryZone,
    subtotal,
  ])

  // ── Derived totals ────────────────────────────────────────────────────────
  const total = Math.max(0, subtotal + shippingCost - (appliedPromotion?.discountAmount ?? 0))
  const totalAfterStoreCredit = Math.max(0, total - storeCreditAmount)

  useEffect(() => {
    setStoreCreditAmount((current) => Math.min(current, total))
  }, [total])

  useEffect(() => {
    setAppliedPromotion(null)
  }, [items])

  async function validatePromotion() {
    if (!promotionCode.trim() || items.length === 0) return
    setValidatingPromotion(true)
    try {
      const params = organizationSlug ? `?org=${encodeURIComponent(organizationSlug)}` : ''
      const response = await fetch(`/api/public/promotions/validate${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutAttemptId: checkoutAttemptId.current,
          code: promotionCode,
          items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Código promocional inválido.')
      setAppliedPromotion(payload.data)
      setPromotionCode(payload.data.code)
      toast.success('Promoción aplicada', { description: `${payload.data.name}: ahorro de ${formatMoney(payload.data.discountAmount)}.` })
    } catch (error) {
      setAppliedPromotion(null)
      toast.error('No se pudo aplicar la promoción', { description: error instanceof Error ? error.message : 'Código promocional inválido.' })
    } finally {
      setValidatingPromotion(false)
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const emailInvalid   = customerEmail.trim().length > 0 && !EMAIL_RE.test(customerEmail.trim())
  const nameError      = touched && !customerName.trim()  ? 'Requerido' : null
  const phoneError     = touched && !customerPhone.trim() ? 'Requerido' : null
  const emailFmtError  = touched && emailInvalid ? 'Formato de email inválido' : null
  const addressError   = touched && fulfillmentType === 'DELIVERY' && !customerAddress.trim() ? 'Requerido' : null
  const cityError      = touched && fulfillmentType === 'DELIVERY' && !customerCity.trim() ? 'Requerido' : null
  const neighborhoodError = touched && fulfillmentType === 'DELIVERY' && !customerNeighborhood.trim() ? 'Requerido' : null
  const selectedZoneMismatch = Boolean(selectedDeliveryZone) && !matchDeliveryZone(
    selectedDeliveryZone ? [selectedDeliveryZone] : [],
    customerCity,
    customerNeighborhood
  )
  const zoneError = touched && fulfillmentType === 'DELIVERY' && selectedZoneMismatch
    ? `La ciudad y el barrio no corresponden a ${selectedDeliveryZone?.name}.`
    : touched && fulfillmentType === 'DELIVERY' && deliveryZones.length > 0 && !selectedDeliveryZone && !isOtherDeliveryZone
      ? 'Seleccioná una zona de entrega'
      : null
  const referenceError = touched && fulfillmentType === 'DELIVERY' && !customerReference.trim() ? 'Requerido' : null
  const companyError   = touched && orderMode === 'empresarial' && !companyName.trim() ? 'Requerido' : null
  const taxIdError = touched && orderMode === 'empresarial' && !/^\d{5,8}-[\dKk]$/.test(taxId.trim())
    ? 'Ingresá un RUC válido, por ejemplo 80123456-7'
    : null

  const isValid = useMemo(() => {
    if (!customerName.trim()) return false
    if (!customerPhone.trim()) return false
    if (emailInvalid) return false
    if (
      fulfillmentType === 'DELIVERY' &&
      (
        !customerAddress.trim() ||
        !customerCity.trim() ||
        !customerNeighborhood.trim() ||
        !customerReference.trim() ||
        selectedZoneMismatch ||
        (deliveryZones.length > 0 && !selectedDeliveryZone && !isOtherDeliveryZone)
      )
    ) return false
    if (orderMode === 'empresarial' && !companyName.trim()) return false
    if (orderMode === 'empresarial' && !/^\d{5,8}-[\dKk]$/.test(taxId.trim())) return false
    return items.length > 0
  }, [customerName, customerPhone, emailInvalid, fulfillmentType, customerAddress, customerCity, customerNeighborhood, customerReference, selectedZoneMismatch, deliveryZones.length, selectedDeliveryZone, isOtherDeliveryZone, orderMode, companyName, taxId, items.length])

  function reviewOrder() {
    setTouched(true)
    if (!isValid) return
    setShowConfirmation(true)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submitOrder() {
    if (!isValid) return

    setShowConfirmation(false)
    setLoading(true)
    try {
      const params = organizationSlug ? `?org=${encodeURIComponent(organizationSlug)}` : ''

      const notesParts: string[] = []
      if (notes.trim()) notesParts.push(notes.trim())
      if (orderMode === 'empresarial') {
        if (companyName) notesParts.push(`Empresa: ${companyName}`)
        if (taxId) notesParts.push(`RUC: ${taxId}`)
      }

      let finalAddress: string | null = null;
      if (fulfillmentType === 'DELIVERY') {
        const parts = [customerAddress.trim()];
        if (customerNeighborhood.trim()) parts.push(customerNeighborhood.trim());
        if (customerCity.trim()) parts.push(customerCity.trim());
        if (customerReference.trim()) parts.push(`(Ref: ${customerReference.trim()})`);
        finalAddress = parts.join(', ');
      }

      const response = await fetch(`/api/public/orders${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPublicOrderRequest({
          checkoutAttemptId: checkoutAttemptId.current,
          customer: {
            name: customerName,
            email: customerEmail || null,
            phone: customerPhone || null,
            address: finalAddress,
          },
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          fulfillmentType,
          paymentMethod,
          shippingCost: fulfillmentType === 'DELIVERY' ? shippingCost : 0,
          deliveryZoneId: fulfillmentType === 'DELIVERY' ? selectedDeliveryZone?.id ?? null : null,
          deliveryCity: fulfillmentType === 'DELIVERY' ? customerCity.trim() : null,
          deliveryNeighborhood: fulfillmentType === 'DELIVERY' ? customerNeighborhood.trim() : null,
          notes: notesParts.join(' · ') || null,
          promotionCode: appliedPromotion?.code ?? null,
          storeCreditAmount,
        })),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) {
        if (payload?.code === 'STOCK_CHANGED' && Array.isArray(payload?.data?.conflicts)) {
          for (const conflict of payload.data.conflicts) {
            if (typeof conflict?.productId === 'string') {
              const cartItemId = conflict.variantId ? `${conflict.productId}:${conflict.variantId}` : conflict.productId
              setAvailableStock(cartItemId, Number(conflict.available || 0))
            }
          }
        }
        if (payload?.code === 'PRICE_CHANGED' && Array.isArray(payload?.data?.conflicts)) {
          for (const conflict of payload.data.conflicts) {
            if (typeof conflict?.productId !== 'string') continue
            const cartItemId = conflict.variantId ? `${conflict.productId}:${conflict.variantId}` : conflict.productId
            setUnitPrice(cartItemId, Number(conflict.currentPrice || 0))
          }
        }
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
      checkoutAttemptId.current = crypto.randomUUID()
    } catch (error) {
      toast.error('No se pudo confirmar el pedido', {
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
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
            <h1 className="text-2xl font-black">¡Pedido recibido!</h1>
            {/* pending confirmation: el negocio todavía debe aceptar el pedido */}
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              {checkout.confirmationMessage?.trim() || 'Tu pedido fue registrado y está pendiente de confirmación del negocio.'}
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

  if (siteSettings && checkout.commerceMode !== 'cart') {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16">
        <Card className="rounded-lg border shadow-sm">
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-bold">Carrito no disponible</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta tienda no recibe pedidos mediante carrito.
            </p>
            <Button asChild className="mt-6 rounded-lg">
              <Link href={productsHref}>Volver a productos</Link>
            </Button>
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

          {items.length > 0 && <CheckoutHowItWorks />}

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
                  <span>¿Tenés cuenta? <Link href={customerLoginHref} className="font-semibold text-primary hover:underline">Iniciá sesión</Link> para pre-cargar tus datos.</span>
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
                  <Card key={item.cartItemId} className="rounded-2xl overflow-hidden">
                    <CardContent className="grid gap-4 p-4 sm:grid-cols-[72px_1fr_auto] sm:items-center">
                      <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border bg-muted flex items-center justify-center">
                        {image
                          ? <Image src={image} alt={item.name} fill className="object-contain p-2" sizes="72px"
                              unoptimized={image.startsWith('data:') || image === '/placeholder-product.svg'} />
                          : <Package className="h-6 w-6 text-muted-foreground/40" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{getCartItemDisplayName(item)}</p>
                        {item.variantName && <p className="mt-0.5 text-xs font-medium text-primary">Variante: {item.variantName}</p>}
                        <p className="text-xs text-muted-foreground">{item.sku || 'Sin SKU'} · {formatMoney(item.unitPrice)} c/u</p>
                        <div className="mt-2.5 flex w-fit items-center rounded-xl border bg-muted/40">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-l-xl"
                            onClick={() => setQuantity(item.cartItemId, item.quantity - 1)}
                            aria-label={`Quitar una unidad de ${item.name}`}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="min-w-7 text-center text-xs font-bold">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-r-xl"
                            onClick={() => setQuantity(item.cartItemId, item.quantity + 1)}
                            disabled={item.availableStock != null && item.quantity >= item.availableStock}
                            aria-label={`Agregar una unidad de ${item.name}`}
                            title={item.availableStock != null && item.quantity >= item.availableStock
                              ? `Máximo disponible: ${item.availableStock}`
                              : undefined}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {item.availableStock != null && (
                          <p className={cn(
                            'mt-1 text-[11px]',
                            item.quantity >= item.availableStock
                              ? 'font-medium text-amber-700 dark:text-amber-300'
                              : 'text-muted-foreground'
                          )}>
                            {item.quantity >= item.availableStock
                              ? `Máximo disponible: ${item.availableStock}`
                              : `${item.availableStock} disponibles`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <strong className="font-black tabular-nums">{formatMoney(item.quantity * item.unitPrice)}</strong>
                        <button type="button" onClick={() => removeItem(item.cartItemId)}
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <span>Tipo de pedido & Facturación</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowModeComparison((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline transition-colors"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>{showModeComparison ? 'Ocultar diferencias' : '¿Cuál elegir? Ver diferencias y ejemplos'}</span>
                  </button>
                </div>

                {/* Interactive Mode Cards */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Card 1: Personal */}
                  <button
                    type="button"
                    onClick={() => setOrderMode('personal')}
                    aria-pressed={orderMode === 'personal'}
                    className={cn(
                      'relative flex flex-col justify-between p-4 rounded-2xl border-2 text-left transition-all duration-200',
                      orderMode === 'personal'
                        ? 'border-primary bg-primary/[0.04] ring-2 ring-primary/20 shadow-xs'
                        : 'border-border/80 bg-card hover:bg-muted/40'
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                            orderMode === 'personal' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            <User className="h-4 w-4" />
                          </div>
                          <span className="font-bold text-sm text-foreground">Pedido Personal</span>
                        </div>
                        <span className="rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 text-[10px] font-bold">
                          Consumidor Final
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Para vos, tu familia o compras particulares. No requiere datos fiscales complejos.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Solo nombre y WhatsApp</span>
                    </div>
                  </button>

                  {/* Card 2: Empresarial */}
                  <button
                    type="button"
                    onClick={() => setOrderMode('empresarial')}
                    aria-pressed={orderMode === 'empresarial'}
                    className={cn(
                      'relative flex flex-col justify-between p-4 rounded-2xl border-2 text-left transition-all duration-200',
                      orderMode === 'empresarial'
                        ? 'border-primary bg-primary/[0.04] ring-2 ring-primary/20 shadow-xs'
                        : 'border-border/80 bg-card hover:bg-muted/40'
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                            orderMode === 'empresarial' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            <Building2 className="h-4 w-4" />
                          </div>
                          <span className="font-bold text-sm text-foreground">Pedido Empresarial</span>
                        </div>
                        <span className="rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[10px] font-bold">
                          Solicitar factura
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Para empresas, pymes, oficinas o profesionales que desean solicitar una factura con RUC.
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                      <span>Razón Social, RUC y Responsable</span>
                    </div>
                  </button>
                </div>

                {/* Expandable Comparison Details */}
                {showModeComparison && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5 text-xs text-foreground space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-border/60">
                      <div className="flex items-center gap-2 font-bold text-sm text-primary">
                        <FileText className="h-4 w-4" />
                        <span>Comparativa: ¿Cuándo usar cada tipo de pedido?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowModeComparison(false)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        aria-label="Cerrar comparativa"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Personal Details */}
                      <div className="rounded-xl border border-blue-500/20 bg-background/80 p-3.5 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-blue-600 dark:text-blue-400 text-xs">
                          <User className="h-3.5 w-3.5" />
                          <span>Pedido Personal (Consumidor Final)</span>
                        </div>
                        <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                          <li>• <strong>Comprobante emitido:</strong> Ticket o factura simple a consumidor final.</li>
                          <li>• <strong>Datos solicitados:</strong> Nombre y WhatsApp para coordinar despacho.</li>
                          <li>• <strong>Destinado a:</strong> Personas particulares, compras para el hogar o uso propio.</li>
                          <li>• <strong>Ejemplo real:</strong> <em>Compro un cargador para mi teléfono personal y pido que me lo envíen a mi casa.</em></li>
                        </ul>
                      </div>

                      {/* Empresarial Details */}
                      <div className="rounded-xl border border-purple-500/20 bg-background/80 p-3.5 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-purple-600 dark:text-purple-400 text-xs">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>Pedido Empresarial (Solicitud de factura)</span>
                        </div>
                        <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                          <li>• <strong>Solicitud:</strong> Enviamos los datos fiscales a la tienda; el negocio confirma y emite el comprobante correspondiente.</li>
                          <li>• <strong>Datos solicitados:</strong> Razón Social, RUC, y nombre del responsable de compras.</li>
                          <li>• <strong>Destinado a:</strong> Empresas, pymes, estudios, comercios o profesionales que deducen gastos e IVA.</li>
                          <li>• <strong>Ejemplo real:</strong> <em>Compramos 3 notebooks para el equipo comercial a nombre de Innova SRL con RUC 80012345-6.</em></li>
                        </ul>
                      </div>
                    </div>
                  </div>
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
                      <Label htmlFor="checkout-company-name" className="text-xs">Razón social / Empresa <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                        <Input id="checkout-company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Ej. Distribuidora XYZ S.A."
                          aria-invalid={Boolean(companyError)} aria-describedby={companyError ? 'checkout-company-error' : undefined}
                          className={cn('pl-8 h-9 rounded-xl', companyError && 'border-destructive')} />
                      </div>
                      {companyError && <p id="checkout-company-error" role="alert" className="text-[11px] text-destructive">{companyError}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="checkout-tax-id" className="text-xs">RUC <span className="text-destructive">*</span></Label>
                      <Input id="checkout-tax-id" value={taxId} onChange={(e) => setTaxId(e.target.value)}
                        placeholder="Ej. 80123456-7"
                        aria-invalid={Boolean(taxIdError)} aria-describedby={taxIdError ? 'checkout-tax-id-error' : undefined}
                        className={cn('h-9 rounded-xl', taxIdError && 'border-destructive')} />
                      {taxIdError && <p id="checkout-tax-id-error" role="alert" className="text-[11px] text-destructive">{taxIdError}</p>}
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
                      aria-pressed={fulfillmentType === opt.value}
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
                        <Label htmlFor="checkout-city" className="text-xs">Ciudad / Distrito <span className="text-destructive">*</span></Label>
                        <Input id="checkout-city" value={customerCity} onChange={(event) => setCustomerCity(event.target.value)}
                          placeholder="Ej. Encarnación"
                          aria-invalid={Boolean(cityError)}
                          className={cn('h-9 rounded-xl', cityError && 'border-destructive')} />
                        {cityError && <p className="text-[11px] text-destructive">{cityError}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="checkout-neighborhood" className="text-xs">Barrio / Zona <span className="text-destructive">*</span></Label>
                        <Input id="checkout-neighborhood" value={customerNeighborhood} onChange={(event) => setCustomerNeighborhood(event.target.value)}
                          placeholder="Ej. Centro"
                          aria-invalid={Boolean(neighborhoodError)}
                          className={cn('h-9 rounded-xl', neighborhoodError && 'border-destructive')} />
                        {neighborhoodError && <p className="text-[11px] text-destructive">{neighborhoodError}</p>}
                      </div>
                    </div>

                    {deliveryZones.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tarifa detectada</Label>
                        <Select value={selectedDeliveryZoneId || undefined} onValueChange={setSelectedDeliveryZoneId}>
                          <SelectTrigger className="h-9 w-full rounded-xl" aria-invalid={Boolean(zoneError)} aria-label="Zona de delivery">
                            <SelectValue placeholder="Completá ciudad y barrio para detectar la tarifa" />
                          </SelectTrigger>
                          <SelectContent>
                            {deliveryZones.map((zone) => <SelectItem key={zone.id} value={zone.id}>{zone.name} · {zone.cost === 0 ? 'Gratis' : formatMoney(zone.cost)}</SelectItem>)}
                            {checkout.delivery.defaultCost > 0 && <SelectItem value={OTHER_DELIVERY_ZONE_ID}>Otra zona · {formatMoney(checkout.delivery.defaultCost)}</SelectItem>}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">Se selecciona automáticamente; podés corregirla si es necesario.</p>
                        {zoneError && <p className="text-[11px] text-destructive">{zoneError}</p>}
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="checkout-address" className="text-xs">Calle y número <span className="text-destructive">*</span></Label>
                        <Input id="checkout-address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Ej. Av. San Martín 123" className={cn('h-9 rounded-xl', addressError && 'border-destructive')} />
                        {addressError && <p className="text-[11px] text-destructive">{addressError}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="checkout-reference" className="text-xs">Referencia <span className="text-destructive">*</span></Label>
                        <Input id="checkout-reference" value={customerReference} onChange={(e) => setCustomerReference(e.target.value)} placeholder="Ej. Portón negro frente a la plaza" className={cn('h-9 rounded-xl', referenceError && 'border-destructive')} />
                        {referenceError && <p className="text-[11px] text-destructive">{referenceError}</p>}
                      </div>
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

                    {deliveryZones.length > 0 && !selectedDeliveryZone && !isOtherDeliveryZone && (
                      <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3">
                        <p className="text-xs font-semibold">Seleccioná tu zona para ver el costo de envío</p>
                      </div>
                    )}
                    {selectedDeliveryZone && (isFreeDelivery || selectedDeliveryZone.cost === 0) && (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Delivery a {selectedDeliveryZone.name}</span>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Gratis</span>
                      </div>
                    )}
                    {selectedDeliveryZone && !isFreeDelivery && selectedDeliveryZone.cost > 0 && (
                      <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
                        <span className="text-sm font-semibold text-muted-foreground">Delivery a {selectedDeliveryZone.name}</span>
                        <span className="text-sm font-bold">{formatMoney(shippingCost)}</span>
                      </div>
                    )}
                    {deliveryZones.length === 0 && !isFreeDelivery && checkout.delivery.defaultCost > 0 && (
                      <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
                        <span className="text-sm font-semibold text-muted-foreground">Costo de envío</span>
                        <span className="text-sm font-bold">{formatMoney(shippingCost)}</span>
                      </div>
                    )}
                    {deliveryZones.length === 0 && !isFreeDelivery && (!checkout.delivery.defaultCost || checkout.delivery.defaultCost === 0) && (
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

              {/* ── Promotion code ── */}
              <div className="space-y-3 rounded-2xl border p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" /> Código promocional
                </p>
                {appliedPromotion ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                    <div>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{appliedPromotion.code}</p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">{appliedPromotion.name} · Ahorrás {formatMoney(appliedPromotion.discountAmount)}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setAppliedPromotion(null); setPromotionCode('') }} aria-label="Quitar código promocional">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={promotionCode}
                      onChange={(event) => setPromotionCode(event.target.value.toUpperCase())}
                      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void validatePromotion() } }}
                      placeholder="Ingresá tu código"
                      maxLength={80}
                      className="h-10 rounded-xl font-mono uppercase"
                    />
                    <Button type="button" variant="outline" onClick={() => void validatePromotion()} disabled={validatingPromotion || !promotionCode.trim()} className="rounded-xl">
                      {validatingPromotion ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                    </Button>
                  </div>
                )}
              </div>

              <PublicStoreCredit
                authenticated={Boolean(user)}
                organizationSlug={organizationSlug}
                orderTotal={total}
                amount={storeCreditAmount}
                onAmountChange={setStoreCreditAmount}
              />

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
                            aria-pressed={sel}
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
                {(checkout.payment[PM_KEY_MAP[paymentMethod]]?.instructions ||
                  (paymentMethod === 'TRANSFER' && (
                    transferOptions.length > 0 ||
                    checkout.payment.transfer.bankAlias ||
                    checkout.payment.transfer.bankCbu
                  )) ||
                  (paymentMethod === 'DIGITAL_WALLET' && checkout.payment.digital_wallet.walletAlias)) && (
                  <div className="rounded-xl border bg-muted/40 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                    {checkout.payment[PM_KEY_MAP[paymentMethod]]?.instructions}
                    {/* Bank details for transfer */}
                    {paymentMethod === 'TRANSFER' && transferOptions.length > 0 && (
                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        {transferOptions.map((option) => (
                          <div key={option.id} className="rounded-xl border border-border/80 bg-background p-3.5 text-foreground space-y-2 shadow-2xs">
                            <p className="font-bold text-xs">{option.bankName}</p>
                            {option.accountHolder && <p className="text-[11px] text-muted-foreground">Titular: <span className="font-medium text-foreground">{option.accountHolder}</span></p>}

                            {option.alias && (
                              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs">
                                <span>Alias: <strong className="font-mono">{option.alias}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(option.alias!, `alias-${option.id}`, 'Alias bancario')}
                                  className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5 text-[10px] font-bold text-primary shadow-2xs border border-border/60 hover:bg-muted"
                                >
                                  {copiedField === `alias-${option.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                  <span>{copiedField === `alias-${option.id}` ? 'Copiado' : 'Copiar'}</span>
                                </button>
                              </div>
                            )}

                            {option.accountNumber && (
                              <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs">
                                <span>Cuenta: <strong className="font-mono">{option.accountNumber}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(option.accountNumber!, `acc-${option.id}`, 'Número de cuenta')}
                                  className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5 text-[10px] font-bold text-primary shadow-2xs border border-border/60 hover:bg-muted"
                                >
                                  {copiedField === `acc-${option.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                  <span>{copiedField === `acc-${option.id}` ? 'Copiado' : 'Copiar'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {paymentMethod === 'TRANSFER' && transferOptions.length === 0 && (checkout.payment.transfer.bankAlias || checkout.payment.transfer.bankCbu) && (
                      <div className="mt-3 space-y-2">
                        {checkout.payment.transfer.bankName && <p className="font-bold text-xs text-foreground">{checkout.payment.transfer.bankName}</p>}

                        {checkout.payment.transfer.bankAlias && (
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-background p-2 text-xs border">
                            <span>Alias: <strong className="font-mono">{checkout.payment.transfer.bankAlias}</strong></span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(checkout.payment.transfer.bankAlias!, 'default-alias', 'Alias bancario')}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-muted/80"
                            >
                              {copiedField === 'default-alias' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                              <span>{copiedField === 'default-alias' ? 'Copiado' : 'Copiar'}</span>
                            </button>
                          </div>
                        )}

                        {checkout.payment.transfer.bankCbu && (
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-background p-2 text-xs border">
                            <span>CBU/CVU: <strong className="font-mono">{checkout.payment.transfer.bankCbu}</strong></span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(checkout.payment.transfer.bankCbu!, 'default-cbu', 'CBU/CVU')}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-muted/80"
                            >
                              {copiedField === 'default-cbu' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                              <span>{copiedField === 'default-cbu' ? 'Copiado' : 'Copiar'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Wallet alias */}
                    {paymentMethod === 'DIGITAL_WALLET' && checkout.payment.digital_wallet.walletAlias && (
                      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-background p-2 text-xs border">
                        <span>Alias / CVU billetera: <strong className="font-mono">{checkout.payment.digital_wallet.walletAlias}</strong></span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(checkout.payment.digital_wallet.walletAlias!, 'wallet-alias', 'Alias de billetera')}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-muted/80"
                        >
                          {copiedField === 'wallet-alias' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedField === 'wallet-alias' ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
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
                onClick={reviewOrder}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando…</>
                  : <><CheckCircle2 className="h-4 w-4" /> Revisar pedido</>
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
                  <div key={item.cartItemId} className="flex justify-between items-start text-xs text-muted-foreground">
                    <span className="truncate pr-3 flex-1">
                      {item.quantity}× <strong className="text-foreground">{getCartItemDisplayName(item)}</strong>
                      {item.variantName && <span className="block pl-4 text-[10px] text-primary">{item.variantName}</span>}
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
                  <span className={cn('tabular-nums', (fulfillmentType === 'PICKUP' || (fulfillmentType === 'DELIVERY' && hasFreeDelivery)) && 'text-emerald-600 dark:text-emerald-400 font-semibold')}>
                    {fulfillmentType === 'PICKUP'
                      ? 'Gratis'
                      : deliveryZones.length > 0 && !selectedDeliveryZone && !isOtherDeliveryZone
                      ? <span className="italic text-muted-foreground/60 text-xs">Elegí una zona</span>
                      : hasFreeDelivery
                      ? 'Gratis'
                      : shippingCost > 0
                      ? formatMoney(shippingCost)
                      : <span className="italic text-muted-foreground/60 text-xs">A coordinar</span>
                    }
                  </span>
                </div>

                {appliedPromotion && (
                  <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>Promoción {appliedPromotion.code}</span>
                    <span className="tabular-nums">-{formatMoney(appliedPromotion.discountAmount)}</span>
                  </div>
                )}

                {storeCreditAmount > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                    <span>Saldo a favor reservado</span>
                    <span className="tabular-nums">-{formatMoney(storeCreditAmount)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary tabular-nums">{formatMoney(totalAfterStoreCredit)}</span>
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
                  <span>
                    {fulfillmentType === 'PICKUP'
                      ? 'Retiro en local'
                      : selectedDeliveryZone
                      ? `Delivery · ${selectedDeliveryZone.name}`
                      : 'Delivery'}
                  </span>
                </div>
              </div>

            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={showConfirmation} onOpenChange={(open) => !loading && setShowConfirmation(open)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Revisar y confirmar pedido</DialogTitle>
            <DialogDescription>
              Verificá productos, entrega y total. Al confirmar reservaremos el stock; la tienda validará disponibilidad y pago.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border p-3">
              {items.map((item) => (
                <div key={item.cartItemId} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.quantity}× {getCartItemDisplayName(item)}</p>
                    {item.variantName && <p className="text-xs text-primary">Variante: {item.variantName}</p>}
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatMoney(item.quantity * item.unitPrice)}</span>
                </div>
              ))}
            </div>

            <div className="grid gap-3 rounded-xl bg-muted/40 p-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-semibold">{orderMode === 'empresarial' ? companyName : customerName}</p>
                {orderMode === 'empresarial' && <p className="text-xs text-muted-foreground">RUC {taxId} · Responsable: {customerName}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entrega y pago</p>
                <p className="font-semibold">{fulfillmentType === 'PICKUP' ? 'Retiro en local' : `Delivery${selectedDeliveryZone ? ` · ${selectedDeliveryZone.name}` : isOtherDeliveryZone ? ` · ${customerCity}` : ''}`}</p>
                <p className="text-xs text-muted-foreground">{{ CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', DIGITAL_WALLET: 'Billetera digital' }[paymentMethod]}</p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border p-3 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
              {shippingCost > 0 && <div className="flex justify-between text-muted-foreground"><span>Envío</span><span>{formatMoney(shippingCost)}</span></div>}
              {appliedPromotion && <div className="flex justify-between text-emerald-600"><span>Promoción</span><span>-{formatMoney(appliedPromotion.discountAmount)}</span></div>}
              {storeCreditAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Saldo a favor</span><span>-{formatMoney(storeCreditAmount)}</span></div>}
              <Separator />
              <div className="flex justify-between text-base font-black"><span>Total final</span><span className="text-primary">{formatMoney(totalAfterStoreCredit)}</span></div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={loading} onClick={() => setShowConfirmation(false)}>Volver y editar</Button>
            <Button type="button" disabled={loading} onClick={() => void submitOrder()} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {loading ? 'Procesando…' : 'Confirmar pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
