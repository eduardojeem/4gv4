'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Hash,
  Loader2,
  PackageSearch,
  Search,
  Truck,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/auth-context'
import {
  ORDER_FLOW,
  ORDER_STATUS_META,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
  UNKNOWN_STATUS_META,
} from '@/lib/orders/constants'
import { getOrderProgress } from '@/lib/orders/helpers'
import type { CustomerOrder, OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/orders/types'
import { formatDate, formatMoney } from '@/components/dashboard/orders/format'

// Only order numbers are stored in history — never emails or phones
const HISTORY_KEY = 'mipos-order-track-history'

export function TrackOrderClient({ organizationSlug }: { organizationSlug?: string | null }) {
  const { toast } = useToast()
  const { user, loading: loadingAuth } = useAuth()
  const [orderNumber, setOrderNumber] = useState('')
  const [contact, setContact]         = useState('')   // email or phone
  const [order, setOrder]             = useState<CustomerOrder | null>(null)
  const [loading, setLoading]         = useState(false)
  const [myOrdersLoading, setMyOrdersLoading] = useState(false)
  const [notFound, setNotFound]       = useState(false)
  const [history, setHistory]         = useState<string[]>([])
  const [myOrders, setMyOrders]       = useState<CustomerOrder[]>([])

  // Pre-fill order number from URL and load history
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initial = params.get('orderNumber') || ''
    if (initial) setOrderNumber(initial)

    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
      setHistory(Array.isArray(stored) ? stored.slice(0, 5) : [])
    } catch {
      setHistory([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (loadingAuth || !user) {
      setMyOrders([])
      return
    }

    let cancelled = false

    async function loadMyOrders() {
      setMyOrdersLoading(true)
      try {
        const params = new URLSearchParams()
        if (organizationSlug) params.set('org', organizationSlug)

        const response = await fetch(`/api/public/orders/me?${params}`, { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || 'No se pudieron cargar tus pedidos.')
        }

        if (!cancelled) {
          setMyOrders(Array.isArray(payload?.data?.orders) ? payload.data.orders : [])
        }
      } catch (error) {
        if (!cancelled) {
          setMyOrders([])
          toast({
            title: 'No se pudieron cargar tus pedidos',
            description: error instanceof Error ? error.message : 'Intenta nuevamente.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setMyOrdersLoading(false)
      }
    }

    void loadMyOrders()

    return () => {
      cancelled = true
    }
  }, [loadingAuth, user, organizationSlug, toast])

  const progress = useMemo(
    () => (order ? getOrderProgress(order.status) : -1),
    [order]
  )

  function rememberOrderNumber(num: string) {
    const next = [
      num,
      ...history.filter((h) => h.toLowerCase() !== num.toLowerCase()),
    ].slice(0, 5)
    setHistory(next)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    } catch {
      // History is a convenience, not critical
    }
  }

  function selectTrackedOrder(nextOrder: CustomerOrder) {
    setOrder(nextOrder)
    setOrderNumber(nextOrder.order_number)
    setNotFound(false)
    rememberOrderNumber(nextOrder.order_number)
  }

  async function searchOrder() {
    const num = orderNumber.trim()
    const ctc = contact.trim()

    if (!num) {
      toast({ title: 'Dato requerido', description: 'Ingresa el número de pedido.', variant: 'destructive' })
      return
    }
    if (!ctc) {
      toast({ title: 'Dato requerido', description: 'Ingresa el email o teléfono con el que realizaste el pedido.', variant: 'destructive' })
      return
    }

    setLoading(true)
    setNotFound(false)
    setOrder(null)

    try {
      const isEmail = ctc.includes('@')
      const params  = new URLSearchParams({ orderNumber: num })
      if (isEmail) {
        params.set('customerEmail', ctc)
      } else {
        params.set('customerPhone', ctc)
      }
      if (organizationSlug) params.set('org', organizationSlug)

      const response = await fetch(`/api/public/orders/track?${params}`, { cache: 'no-store' })
      const payload  = await response.json().catch(() => ({}))

      if (response.status === 404) {
        setNotFound(true)
        return
      }
      if (response.status === 429) {
        toast({
          title: 'Demasiadas consultas',
          description: payload?.error || 'Intenta de nuevo en unos minutos.',
          variant: 'destructive',
        })
        return
      }
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || 'No se pudo consultar el pedido.')
      }

      setOrder(payload.data.order)
      rememberOrderNumber(num)
    } catch (error) {
      toast({
        title: 'No se pudo buscar',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const statusMeta    = order ? ORDER_STATUS_META[order.status as OrderStatus] ?? UNKNOWN_STATUS_META : null
  const paymentMeta   = order ? PAYMENT_STATUS_META[order.payment_status as PaymentStatus] ?? PAYMENT_STATUS_META.PENDING : null
  const paymentMethod = order ? PAYMENT_METHOD_META[order.payment_method as PaymentMethod] ?? PAYMENT_METHOD_META.CASH : null
  const StatusIcon    = statusMeta?.icon

  return (
    <div className="container max-w-7xl py-10 md:py-16 px-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <section className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-8">

          {/* ── Search card ── */}
          {!loadingAuth && user && (
            <Card className="rounded-3xl border border-gray-200/60 bg-white/80 shadow-xl shadow-gray-200/10 dark:border-gray-800 dark:bg-gray-950/50 dark:shadow-black/5">
              <CardHeader className="border-b border-gray-100/70 pb-4 dark:border-gray-800/70">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-xl font-extrabold tracking-tight">Mis pedidos</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pedidos realizados con tu cuenta en esta tienda.
                    </p>
                  </div>
                  {myOrders.length > 0 && (
                    <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs">
                      {myOrders.length} pedidos
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {myOrdersLoading ? (
                  <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando tus pedidos...
                  </div>
                ) : myOrders.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {myOrders.map((item) => {
                      const itemStatus = ORDER_STATUS_META[item.status as OrderStatus] ?? UNKNOWN_STATUS_META
                      const itemPayment = PAYMENT_STATUS_META[item.payment_status as PaymentStatus] ?? PAYMENT_STATUS_META.PENDING
                      const ItemIcon = itemStatus.icon

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectTrackedOrder(item)}
                          className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
                        >
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${itemStatus.className}`}>
                            <ItemIcon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-bold text-foreground">{item.order_number}</span>
                              <Badge variant="outline" className={`border text-[10px] font-bold ${itemStatus.className}`}>
                                {itemStatus.label}
                              </Badge>
                              <Badge variant="outline" className={`border text-[10px] font-bold ${itemPayment.className}`}>
                                Pago: {itemPayment.label}
                              </Badge>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{formatDate(item.created_at)}</span>
                              <span>{formatMoney(item.total)}</span>
                              <span>{item.fulfillment_type === 'PICKUP' ? 'Retiro en local' : 'Delivery'}</span>
                            </div>
                          </div>
                          <Search className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-10 text-center">
                    <PackageSearch className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-3 text-sm font-semibold text-foreground">Todavia no hay pedidos vinculados a tu cuenta.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tambien podes buscar manualmente con numero de pedido y contacto.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="relative rounded-3xl border border-gray-200/60 dark:border-gray-800 bg-white/70 dark:bg-gray-950/40 backdrop-blur-xl p-6 md:p-10 shadow-xl shadow-gray-200/10 dark:shadow-black/5 overflow-hidden">
            {/* Brillo decorativo superior */}
            <div className="absolute -top-24 -left-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 -right-24 h-48 w-48 rounded-full bg-gradient-to-br from-pink-500/5 to-rose-500/5 blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
                <PackageSearch className="h-4 w-4" />
                Seguimiento de Pedidos
              </div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-4xl">
                ¿Dónde está mi pedido?
              </h1>
              <p className="mt-2.5 max-w-xl text-sm text-muted-foreground leading-relaxed">
                Ingresá el número de pedido único y el email o teléfono con el que registraste tu compra para conocer el estado actual en tiempo real.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {/* Order number */}
                <div className="space-y-2">
                  <Label htmlFor="track-order-number" className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Número de pedido
                  </Label>
                  <div className="relative group">
                    <Hash className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground/80 group-focus-within:text-primary transition-colors" />
                    <Input
                      id="track-order-number"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void searchOrder()}
                      className="h-12 pl-10.5 rounded-xl border-gray-200 focus-visible:ring-primary/20 focus-visible:border-primary transition-all font-mono"
                      placeholder="PED-20260527-ABCDE"
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-2">
                  <Label htmlFor="track-contact" className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Dato de contacto
                  </Label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground/80 group-focus-within:text-primary transition-colors" />
                    <Input
                      id="track-contact"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void searchOrder()}
                      className="h-12 pl-10.5 rounded-xl border-gray-200 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                      placeholder="nombre@email.com o 0981..."
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-gray-100/50 dark:border-gray-800/40 pt-6">
                {/* Recent order numbers */}
                {history.length > 0 ? (
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Consultas recientes:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {history.slice(0, 3).map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setOrderNumber(item)}
                          className="rounded-lg border border-gray-200/60 dark:border-gray-800 px-3 py-1.5 text-2xs font-bold tracking-tight text-muted-foreground bg-gray-50/50 hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-all duration-200"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : <div className="hidden sm:block text-2xs text-muted-foreground">Completa los campos para rastrear tu orden.</div>}

                <Button
                  className="h-12 w-full sm:w-auto rounded-xl px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary hover:to-primary/90 shadow-md hover:shadow-lg shadow-primary/10 transition-all duration-300 font-semibold shrink-0"
                  onClick={() => void searchOrder()}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4.5 w-4.5" />
                      Rastrear pedido
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* ── Not found ── */}
          {notFound && (
            <Card className="border-amber-200/70 bg-amber-50/50 dark:border-amber-950/40 dark:bg-amber-950/10 rounded-2xl shadow-sm animate-in zoom-in-95 duration-200">
              <CardContent className="flex items-start gap-4 p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/30 text-amber-600">
                  <AlertCircle className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200">No encontramos ese pedido</h4>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    Verificá que el número de pedido exacto y el dato de contacto (email o teléfono de registro) coincidan estrictamente. Si el problema persiste, ponte en contacto con soporte.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Order result ── */}
          {order && statusMeta && (
            <Card className="border-none shadow-xl shadow-gray-200/10 dark:shadow-black/5 overflow-hidden rounded-3xl animate-in zoom-in-98 duration-300">
              <CardHeader className="bg-gradient-to-r from-gray-50/70 to-white dark:from-gray-950/30 dark:to-gray-900/10 p-6 md:p-8 border-b border-gray-100/50 dark:border-gray-800/30">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${statusMeta.className} bg-white dark:bg-gray-950 shadow-sm shrink-0`}>
                      {StatusIcon && <StatusIcon className="h-5.5 w-5.5" />}
                    </div>
                    <div>
                      <CardTitle className="font-mono text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{order.order_number}</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Última actualización {formatDate(order.updated_at)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`w-fit gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wider ${statusMeta.className}`}
                  >
                    {statusMeta.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 p-6 md:p-8">

                {/* Fulfillment Status Banner */}
                <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-muted/10 p-5 flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-200 text-sm md:text-base leading-snug">{statusMeta.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground font-medium">
                      Modalidad de envío: {order.fulfillment_type === 'PICKUP' ? '🛒 Retiro exclusivo en local' : '🚚 Entrega por delivery a domicilio'}
                    </p>
                  </div>
                </div>

                {/* Progress flow Stepper / Linea de tiempo */}
                {order.status === 'CANCELLED' ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5 flex items-start gap-3.5 text-rose-700 dark:border-rose-950/40 dark:bg-rose-950/10 dark:text-rose-300">
                    <AlertCircle className="h-5.5 w-5.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">Pedido Cancelado</h4>
                      <p className="mt-1 text-xs leading-relaxed opacity-90">Este pedido fue cancelado y no completará su flujo. Ponte en contacto con soporte si tienes alguna duda respecto al reembolso o cancelación.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-gray-100/50 pb-2">Estado del Envío</h3>
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
                      {ORDER_FLOW.map((step, index) => {
                        const meta = ORDER_STATUS_META[step]
                        const active = index <= progress
                        const current = index === progress
                        return (
                          <div
                            key={step}
                            className={`relative rounded-xl border p-3 flex flex-col justify-between transition-all duration-300 ${
                              current
                                ? 'border-primary bg-primary/5 shadow-inner shadow-primary/5 ring-1 ring-primary/20'
                                : active
                                ? 'border-emerald-100 bg-emerald-50/30 dark:border-emerald-950/30 dark:bg-emerald-950/5'
                                : 'border-gray-100 bg-gray-50/20 dark:border-gray-900/20 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <meta.icon
                                className={`h-5 w-5 ${
                                  current ? 'text-primary' : active ? 'text-emerald-600' : 'text-muted-foreground'
                                }`}
                              />
                              {current && (
                                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                              )}
                              {active && !current && (
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-3xs font-extrabold select-none">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="mt-4">
                              <span className="block text-3xs font-bold text-muted-foreground uppercase tracking-wider leading-none">Paso {index + 1}</span>
                              <p className={`mt-1 text-2xs font-extrabold leading-tight ${current ? 'text-primary' : active ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                                {meta.label}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Items detail list */}
                <div className="space-y-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-gray-100/50 pb-2">Productos en tu pedido</h3>
                  <div className="grid gap-3">
                    {order.order_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 p-4 hover:bg-gray-50/40 dark:hover:bg-gray-950/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900 text-muted-foreground shrink-0 select-none">
                            📦
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground font-medium mt-0.5">
                              {item.quantity} unidades × {formatMoney(item.unit_price)}
                            </p>
                          </div>
                        </div>
                        <strong className="text-sm font-extrabold text-gray-950 dark:text-white">{formatMoney(item.subtotal)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-6">
          <Card className="border-none shadow-xl shadow-gray-200/10 dark:shadow-black/5 rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-gray-50/70 to-white dark:from-gray-950/30 dark:to-gray-900/10 p-5 border-b border-gray-100/50">
              <CardTitle className="text-base font-extrabold tracking-tight">Resumen de Cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 text-sm">
              {order ? (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Cliente</span>
                    <strong className="text-right text-gray-800 dark:text-gray-200 font-semibold">{order.customer_name}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Método de pago</span>
                    <strong className="text-gray-800 dark:text-gray-200 font-semibold">{paymentMethod?.label}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Estado pago</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-3xs font-extrabold uppercase tracking-widest ${paymentMeta?.className}`}>
                      {paymentMeta?.label}
                    </span>
                  </div>
                  <div className="my-2 border-t border-gray-100/50 dark:border-gray-800 pt-3 flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Subtotal</span>
                    <strong className="font-semibold">{formatMoney(order.subtotal)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Envío</span>
                    <strong className="font-semibold">{formatMoney(order.shipping_cost)}</strong>
                  </div>
                  <div className="flex justify-between border-t border-gray-200/60 pt-3.5 text-lg font-black text-gray-950 dark:text-white items-center">
                    <span>Total</span>
                    <strong className="text-xl font-black text-primary">{formatMoney(order.total)}</strong>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 text-muted-foreground p-2">
                  <Clock className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
                  <p className="text-xs leading-relaxed leading-normal">Buscá un pedido completando el formulario para ver el resumen detallado de importes, productos, método de pago e información de despacho.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl shadow-gray-200/10 dark:shadow-black/5 rounded-3xl overflow-hidden bg-gradient-to-br from-gray-50/50 to-white">
            <CardContent className="flex items-start gap-3.5 p-6 text-xs text-muted-foreground leading-relaxed font-medium">
              {order?.status === 'DELIVERED' ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Truck className="h-5 w-5" />
                </div>
              )}
              <p>
                La información reflejada se sincroniza de forma inmediata al momento que el comercio actualiza el estado de tu pedido en el panel administrativo principal.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  )
}
