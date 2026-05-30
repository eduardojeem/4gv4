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
  const [orderNumber, setOrderNumber] = useState('')
  const [contact, setContact]         = useState('')   // email or phone
  const [order, setOrder]             = useState<CustomerOrder | null>(null)
  const [loading, setLoading]         = useState(false)
  const [notFound, setNotFound]       = useState(false)
  const [history, setHistory]         = useState<string[]>([])

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
    <div className="container py-8 md:py-12">
      <section className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">

          {/* ── Search card ── */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <PackageSearch className="h-3.5 w-3.5" />
              Seguimiento público
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
              Seguí tu pedido
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Ingresá el número de pedido y el email o teléfono que usaste al comprar.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {/* Order number */}
              <div className="space-y-1.5">
                <Label htmlFor="track-order-number" className="text-sm font-medium">
                  Número de pedido
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="track-order-number"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void searchOrder()}
                    className="h-11 pl-9"
                    placeholder="PED-20260527-ABCDE"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-1.5">
                <Label htmlFor="track-contact" className="text-sm font-medium">
                  Email o teléfono
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="track-contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void searchOrder()}
                    className="h-11 pl-9"
                    placeholder="nombre@email.com o 0981..."
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <Button
              className="mt-4 h-11 w-full sm:w-auto"
              onClick={() => void searchOrder()}
              disabled={loading}
            >
              {loading
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Search className="mr-2 h-4 w-4" />}
              Consultar pedido
            </Button>

            {/* Recent order numbers */}
            {history.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-muted-foreground">Pedidos recientes:</p>
                <div className="flex flex-wrap gap-2">
                  {history.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setOrderNumber(item)}
                      className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Not found ── */}
          {notFound && (
            <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
              <CardContent className="flex items-start gap-3 p-5">
                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-semibold">No encontramos ese pedido</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Verificá que el número de pedido y el dato de contacto sean correctos.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Order result ── */}
          {order && statusMeta && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="font-mono text-xl">{order.order_number}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Actualizado {formatDate(order.updated_at)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`w-fit gap-1.5 border ${statusMeta.className}`}
                  >
                    {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
                    {statusMeta.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="font-medium">{statusMeta.description}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.fulfillment_type === 'PICKUP' ? 'Retiro en local.' : 'Entrega por delivery.'}
                  </p>
                </div>

                {order.status === 'CANCELLED' ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
                    Este pedido fue cancelado. Contactá al negocio si necesitás más información.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-6">
                    {ORDER_FLOW.map((step, index) => {
                      const meta    = ORDER_STATUS_META[step]
                      const active  = index <= progress
                      const current = index === progress
                      return (
                        <div
                          key={step}
                          className={`rounded-lg border p-3 ${
                            current
                              ? 'border-primary bg-primary/5'
                              : active
                              ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                              : 'bg-muted/20'
                          }`}
                        >
                          <meta.icon
                            className={`h-4 w-4 ${active ? 'text-emerald-600' : 'text-muted-foreground'}`}
                          />
                          <p className="mt-2 text-xs font-semibold">{meta.label}</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="space-y-3">
                  {order.order_items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × {formatMoney(item.unit_price)}
                        </p>
                      </div>
                      <strong>{formatMoney(item.subtotal)}</strong>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {order ? (
                <>
                  <div className="flex justify-between">
                    <span>Cliente</span>
                    <strong className="text-right">{order.customer_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Pago</span>
                    <strong>{paymentMethod?.label}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Estado pago</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${paymentMeta?.className}`}>
                      {paymentMeta?.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <strong>{formatMoney(order.subtotal)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Envío</span>
                    <strong>{formatMoney(order.shipping_cost)}</strong>
                  </div>
                  <div className="flex justify-between border-t pt-3 text-base">
                    <span>Total</span>
                    <strong>{formatMoney(order.total)}</strong>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-3 text-muted-foreground">
                  <Clock className="mt-0.5 h-4 w-4" />
                  <p>Buscá un pedido para ver el estado, productos, pago y entrega.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
              {order?.status === 'DELIVERED'
                ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                : <Truck className="mt-0.5 h-5 w-5" />}
              <p>
                La información se actualiza cuando el negocio modifica el pedido
                desde el panel administrativo.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  )
}
