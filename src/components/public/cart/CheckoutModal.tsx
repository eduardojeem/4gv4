'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, MapPin, Minus, Package, Plus, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { usePublicCart } from '@/hooks/use-public-cart'
import { formatPrice } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CheckoutModal({ open, onClose, onSuccess }: Props) {
  const { toast } = useToast()
  const { tenantSlug, items, subtotal, setQuantity, clear } = usePublicCart()

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [fulfillmentType, setFulfillmentType] = useState('PICKUP')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

  // Phone is valid if it has at least 6 digits (ignoring spaces/symbols)
  const phoneDigits = customerPhone.replace(/\D/g, '')
  const phoneValid  = phoneDigits.length >= 6

  const canSubmit = useMemo(
    () =>
      items.length > 0 &&
      customerName.trim().length > 0 &&
      (customerEmail.trim().length > 0 || phoneValid),
    [items.length, customerName, customerEmail, phoneValid]
  )

  function handleClose() {
    if (loading) return
    if (orderNumber) {
      onSuccess()
    }
    onClose()
  }

  async function submitOrder() {
    if (!canSubmit) {
      toast({
        title: 'Datos incompletos',
        description: 'Completá nombre y al menos email o teléfono.',
        variant: 'destructive',
      })
      return
    }
    if (fulfillmentType === 'DELIVERY' && !customerAddress.trim()) {
      toast({
        title: 'Falta la dirección',
        description: 'Ingresá una dirección para el delivery.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const params = tenantSlug ? `?org=${encodeURIComponent(tenantSlug)}` : ''
      const res = await fetch(`/api/public/orders${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim() || undefined,
            phone: customerPhone.trim() || undefined,
            address: customerAddress.trim() || undefined,
          },
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          fulfillmentType,
          paymentMethod,
          notes: notes.trim() || undefined,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      if (res.status === 429) {
        throw new Error('Demasiados pedidos. Esperá unos minutos e intentá de nuevo.')
      }
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || 'No se pudo crear el pedido.')
      }
      const num = payload.data.order_number as string
      clear()
      setOrderNumber(num)
    } catch (err) {
      toast({
        title: 'Error al confirmar',
        description: err instanceof Error ? err.message : 'Intentá nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Reset form when modal opens fresh
  function handleOpenChange(val: boolean) {
    if (!val) handleClose()
  }

  const trackHref = tenantSlug
    ? `/${tenantSlug}/track?orderNumber=${encodeURIComponent(orderNumber ?? '')}`
    : `/track?orderNumber=${encodeURIComponent(orderNumber ?? '')}`

  const productsHref = tenantSlug ? `/${tenantSlug}/productos` : '/productos'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {orderNumber ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-50">
              ¡Pedido recibido!
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              El negocio ya puede gestionar tu pedido desde el panel.
            </p>
            <div className="mt-5 rounded-lg border bg-muted/40 px-5 py-3 font-mono text-lg font-bold tracking-widest">
              {orderNumber}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Guardá este número para rastrear tu pedido
            </p>
            <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href={trackHref} onClick={onSuccess}>
                  Rastrear pedido
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1" onClick={onSuccess}>
                <Link href={productsHref} onClick={onSuccess}>
                  Seguir comprando
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="border-b px-5 py-4">
              <DialogTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Completar pedido
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto">
              {/* Order summary */}
              <div className="border-b bg-muted/30 px-5 py-3">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Resumen ({items.length} producto{items.length !== 1 ? 's' : ''})
                </p>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{item.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {/* Inline quantity control */}
                        <div className="flex items-center rounded-md border">
                          <button
                            type="button"
                            onClick={() => setQuantity(item.productId, item.quantity - 1)}
                            className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-7 text-center text-xs font-semibold">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity(item.productId, item.quantity + 1)}
                            className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="w-20 text-right font-semibold">
                          {formatPrice(item.quantity * item.unitPrice)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between border-t pt-3 text-sm font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(subtotal)}</span>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4 px-5 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="co-name">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="co-name"
                    placeholder="Tu nombre completo"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="co-email">Email</Label>
                    <Input
                      id="co-email"
                      type="email"
                      placeholder="tu@email.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="co-phone">
                      Teléfono {!customerEmail.trim() && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="co-phone"
                      type="tel"
                      placeholder="+595 9xx xxx xxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      autoComplete="tel"
                    />
                    {customerPhone.trim() && !phoneValid && (
                      <p className="text-[11px] text-destructive">
                        Ingresá al menos 6 dígitos.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Entrega</Label>
                    <Select value={fulfillmentType} onValueChange={setFulfillmentType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PICKUP">Retiro en local</SelectItem>
                        <SelectItem value="DELIVERY">Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Método de pago</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Efectivo</SelectItem>
                        <SelectItem value="CARD">Tarjeta</SelectItem>
                        <SelectItem value="TRANSFER">Transferencia</SelectItem>
                        <SelectItem value="DIGITAL_WALLET">Billetera digital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {fulfillmentType === 'DELIVERY' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="co-address" className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      Dirección de entrega <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="co-address"
                      placeholder="Calle, número, barrio..."
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      autoComplete="street-address"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="co-notes">Notas (opcional)</Label>
                  <Textarea
                    id="co-notes"
                    placeholder="Indicaciones especiales para tu pedido..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    maxLength={300}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-5 py-4">
              <Button
                className="w-full"
                size="lg"
                onClick={submitOrder}
                disabled={loading || !canSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirmar pedido · {formatPrice(subtotal)}
                  </>
                )}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Al confirmar, el negocio recibirá tu pedido para gestionarlo.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
