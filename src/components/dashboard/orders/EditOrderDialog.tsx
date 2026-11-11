'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Lock, Pencil, Store, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { useCommercePaymentControls } from '@/hooks/use-commerce-payment-controls'
import { validateDeliveryContact, validateOrderAmounts } from '@/lib/orders/creation-rules'
import { PAYMENT_METHOD_META } from '@/lib/orders/constants'
import type { CustomerOrder, FulfillmentType, PaymentMethod } from '@/lib/orders/types'
import { formatMoney } from './format'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'CASH', label: PAYMENT_METHOD_META.CASH.label },
  { value: 'CARD', label: PAYMENT_METHOD_META.CARD.label },
  { value: 'TRANSFER', label: PAYMENT_METHOD_META.TRANSFER.label },
  { value: 'DIGITAL_WALLET', label: PAYMENT_METHOD_META.DIGITAL_WALLET.label },
]

export interface EditOrderDialogProps {
  order: CustomerOrder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (updated: CustomerOrder) => void
}

export function EditOrderDialog(props: EditOrderDialogProps) {
  if (!props.open || !props.order) return null
  return <EditOrderDialogContent key={props.order.id} {...props} order={props.order} />
}

function EditOrderDialogContent({
  order,
  open,
  onOpenChange,
  onUpdated,
}: {
  order: CustomerOrder
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (updated: CustomerOrder) => void
}) {
  const { effectiveModules } = useSubscriptionStatus()
  const paymentControls = useCommercePaymentControls()
  const hasDelivery = effectiveModules.includes('delivery')
  const financialLocked = order.payment_status !== 'PENDING' || ['DELIVERED', 'CANCELLED'].includes(order.status)
  const shippingLocksPickup = financialLocked && order.shipping_cost > 0

  const [customerName, setCustomerName] = useState(order.customer_name)
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone ?? '')
  const [customerEmail, setCustomerEmail] = useState(order.customer_email ?? '')
  const [customerAddress, setCustomerAddress] = useState(order.customer_address ?? '')
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(order.fulfillment_type)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order.payment_method)
  const [shippingInput, setShippingInput] = useState(String(order.shipping_cost || 0))
  const [discountInput, setDiscountInput] = useState(String(order.discount_amount || 0))
  const [notes, setNotes] = useState(order.notes ?? '')
  const [saving, setSaving] = useState(false)

  const allowedPaymentOptions = useMemo(
    () => (paymentControls.ready ? PAYMENT_OPTIONS.filter((opt) => paymentControls.allows(opt.value)) : []),
    [paymentControls]
  )

  const currentMethodAllowed = paymentControls.ready && paymentControls.allows(paymentMethod)
  const effectivePaymentOptions = useMemo(() => {
    if (allowedPaymentOptions.some((opt) => opt.value === paymentMethod)) return allowedPaymentOptions
    const currentOpt = PAYMENT_OPTIONS.find((opt) => opt.value === paymentMethod)
    return currentOpt ? [currentOpt, ...allowedPaymentOptions] : allowedPaymentOptions
  }, [allowedPaymentOptions, paymentMethod])

  const parsedShipping = financialLocked
    ? order.shipping_cost
    : fulfillmentType === 'PICKUP'
      ? 0
      : Math.max(0, Number(shippingInput) || 0)
  const parsedDiscount = financialLocked ? order.discount_amount : Math.max(0, Number(discountInput) || 0)
  const previewTotal = Math.max(0, order.subtotal + parsedShipping - parsedDiscount)

  const validationError = useMemo(() => {
    if (!customerName.trim()) return 'El nombre del cliente es obligatorio.'
    if (customerEmail.trim() && !EMAIL_RE.test(customerEmail.trim())) {
      return 'El correo del cliente no es válido.'
    }
    const deliveryErr = validateDeliveryContact({
      fulfillmentType,
      phone: customerPhone,
      address: customerAddress,
    })
    if (deliveryErr) return deliveryErr
    if (shippingLocksPickup && fulfillmentType === 'PICKUP') {
      return 'No se puede cambiar a retiro en local porque el pedido ya tiene envío cobrado o está cerrado.'
    }
    if (!financialLocked) {
      const amountsErr = validateOrderAmounts({
        subtotal: order.subtotal,
        shippingCost: parsedShipping,
        discountAmount: parsedDiscount,
        fulfillmentType,
      })
      if (amountsErr) return amountsErr
    }
    if (paymentControls.error) return paymentControls.error
    if (!paymentControls.ready) return 'Verificando medios de pago habilitados...'
    if (!paymentControls.allows(paymentMethod)) {
      return 'Seleccioná un medio de pago habilitado para este comercio.'
    }
    return null
  }, [
    customerAddress,
    customerEmail,
    customerName,
    customerPhone,
    financialLocked,
    fulfillmentType,
    order.subtotal,
    parsedDiscount,
    parsedShipping,
    paymentControls,
    paymentMethod,
    shippingLocksPickup,
  ])

  const handleSave = async () => {
    if (validationError || saving) {
      if (validationError) toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      const payloadBody: Record<string, unknown> = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_email: customerEmail.trim(),
        customer_address: customerAddress.trim() || null,
        fulfillment_type: fulfillmentType,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
      }
      if (!financialLocked) {
        payloadBody.shipping_cost = parsedShipping
        payloadBody.discount_amount = parsedDiscount
      }

      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error ?? 'No se pudo actualizar el pedido.')
      }
      const updated = payload.data as CustomerOrder
      toast.success('Pedido actualizado', { description: `#${updated.order_number}` })
      onUpdated(updated)
      onOpenChange(false)
    } catch (error) {
      toast.error('No se pudo guardar los cambios', {
        description: error instanceof Error ? error.message : 'Intentá nuevamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-blue-600" />
            <span>Editar pedido #{order.order_number}</span>
          </DialogTitle>
          <DialogDescription>
            Actualizá datos de contacto, modalidad de entrega, medio de pago o notas internas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {financialLocked && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/80 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold">Importes bloqueados</p>
                <p className="mt-0.5 leading-relaxed opacity-90">
                  El pedido ya tiene pagos registrados o se encuentra cerrado ({order.status}). Solo podés editar datos del cliente, entrega, medio de pago y notas.
                </p>
              </div>
            </div>
          )}

          {/* Cliente */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Datos del cliente</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-customer-name">Nombre *</Label>
                <Input
                  id="edit-customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-customer-phone">
                  Teléfono {fulfillmentType === 'DELIVERY' ? '*' : ''}
                </Label>
                <Input
                  id="edit-customer-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ej.: 0981 123 456"
                  maxLength={50}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-customer-email">Email</Label>
                <Input
                  id="edit-customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="cliente@correo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-customer-address">
                  Dirección {fulfillmentType === 'DELIVERY' ? '*' : ''}
                </Label>
                <Input
                  id="edit-customer-address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Calle, nro., referencia"
                  maxLength={500}
                />
              </div>
            </div>
          </div>

          {/* Entrega y Pago */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Modalidad de entrega</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={shippingLocksPickup}
                  onClick={() => setFulfillmentType('PICKUP')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    fulfillmentType === 'PICKUP'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  } disabled:opacity-45 disabled:cursor-not-allowed`}
                >
                  <Store className="h-3.5 w-3.5" />
                  Retiro
                </button>
                <button
                  type="button"
                  disabled={!hasDelivery}
                  onClick={() => setFulfillmentType('DELIVERY')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    fulfillmentType === 'DELIVERY'
                      ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  } disabled:opacity-45 disabled:cursor-not-allowed`}
                >
                  <Truck className="h-3.5 w-3.5" />
                  Delivery
                </button>
              </div>
              {!hasDelivery && (
                <p className="text-[11px] text-muted-foreground">El módulo de delivery no está activo en tu plan.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Medio de pago acordado</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                disabled={!paymentControls.ready}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un medio" />
                </SelectTrigger>
                <SelectContent>
                  {effectivePaymentOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      disabled={paymentControls.ready && !paymentControls.allows(opt.value)}
                    >
                      {opt.label}
                      {paymentControls.ready && !paymentControls.allows(opt.value) ? ' (deshabilitado)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {paymentControls.error && (
                <p className="text-[11px] text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {paymentControls.error}
                </p>
              )}
              {paymentControls.ready && !currentMethodAllowed && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  El medio anterior no está habilitado; elegí uno activo para guardar cambios.
                </p>
              )}
            </div>
          </div>

          {/* Importes */}
          <div className="rounded-xl border border-border bg-muted/25 p-3.5 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-shipping-cost">Costo de envío</Label>
                <Input
                  id="edit-shipping-cost"
                  type="number"
                  min={0}
                  step={1000}
                  value={financialLocked ? order.shipping_cost : fulfillmentType === 'PICKUP' ? 0 : shippingInput}
                  disabled={financialLocked || fulfillmentType === 'PICKUP'}
                  onChange={(e) => setShippingInput(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-discount-amount">Descuento</Label>
                <Input
                  id="edit-discount-amount"
                  type="number"
                  min={0}
                  max={order.subtotal}
                  step={1000}
                  value={financialLocked ? order.discount_amount : discountInput}
                  disabled={financialLocked}
                  onChange={(e) => setDiscountInput(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs">
              <span className="text-muted-foreground">Subtotal: <strong className="text-foreground">{formatMoney(order.subtotal)}</strong></span>
              <span className="font-bold text-sm text-foreground">Nuevo total: {formatMoney(previewTotal)}</span>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-order-notes">Notas / indicaciones</Label>
            <Textarea
              id="edit-order-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Indicaciones para preparación, horario o entrega…"
            />
          </div>

          {validationError && !paymentControls.error && paymentControls.ready && (
            <p className="text-xs font-medium text-destructive">{validationError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || Boolean(validationError)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
