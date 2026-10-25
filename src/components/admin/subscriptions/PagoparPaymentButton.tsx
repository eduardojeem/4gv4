'use client'

import { useState } from 'react'
import { AlertTriangle, CreditCard, Globe, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PagoparPaymentMethodSelector,
  type SubscriptionPaymentMethod,
} from '@/components/admin/subscriptions/PagoparPaymentMethodSelector'

type PagoparPaymentButtonProps = {
  missingFields?: string[]
  isPaidPlan: boolean
  planName: string
  planAmount: string
  stripeEnabled?: boolean
}

type PagoparCheckoutErrorPayload = { error?: string; correlationId?: string } | null

export function getPagoparCheckoutErrorMessage(
  payload: PagoparCheckoutErrorPayload,
  requestCorrelationId: string,
) {
  return payload?.error || `No se pudo iniciar el pago. Código: ${payload?.correlationId || requestCorrelationId}`
}

export function PagoparPaymentButton({ missingFields = [], isPaidPlan, planName, planAmount, stripeEnabled = false }: PagoparPaymentButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<SubscriptionPaymentMethod>('card')

  if (!isPaidPlan) return null

  const providerName = paymentMethod === 'stripe' ? 'Stripe' : 'Pagopar'

  async function startPayment() {
    if (missingFields.length > 0) {
      setStatus('error')
      setMessage(`Completa los datos de facturacion antes de pagar con ${providerName}.`)
      return
    }

    setStatus('loading')
    setMessage(null)

    try {
      const correlationId = crypto.randomUUID()
      const response = await fetch(
        paymentMethod === 'stripe'
          ? '/api/admin/subscriptions/payments/stripe'
          : '/api/admin/subscriptions/payments/pagopar',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
          },
          body: JSON.stringify(paymentMethod === 'stripe' ? {} : { paymentMethod }),
        },
      )
      const payload = await response.json().catch(() => null) as ({ checkoutUrl?: string } & PagoparCheckoutErrorPayload) | null

      if (!response.ok || !payload?.checkoutUrl) {
        setStatus('error')
        setMessage(getPagoparCheckoutErrorMessage(payload, correlationId))
        return
      }

      window.location.assign(payload.checkoutUrl)
    } catch {
      setStatus('error')
      setMessage(`No se pudo conectar con ${providerName}. Intentá nuevamente.`)
    }
  }

  const PaymentIcon = paymentMethod === 'qr' ? QrCode : paymentMethod === 'stripe' ? Globe : CreditCard

  return (
    <div className="w-full max-w-sm space-y-3">
      <PagoparPaymentMethodSelector
        value={paymentMethod}
        onChange={setPaymentMethod}
        disabled={status === 'loading'}
        includeStripe={stripeEnabled}
      />
      <Button type="button" onClick={startPayment} disabled={status === 'loading'} className="w-full gap-2">
        <PaymentIcon className="h-4 w-4" />
        {status === 'loading'
          ? `Conectando con ${providerName}...`
          : paymentMethod === 'qr'
            ? 'Pagar con QR'
            : paymentMethod === 'stripe'
              ? 'Pagar con Stripe'
              : 'Pagar con tarjeta'}
      </Button>
      <p className="text-xs text-muted-foreground">{planName} · {planAmount}/mes</p>
      {missingFields.length > 0 && (
        <div className="max-w-sm rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-200">
          <div className="flex gap-2 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            Faltan datos para pagar
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-9">
            {missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
          <a href="#billing-form" className="mt-2 block text-orange-800 underline underline-offset-2 hover:text-orange-900 dark:text-orange-300 dark:hover:text-orange-200">
            Completar datos de facturacion →
          </a>
        </div>
      )}
      {message && <p className="max-w-sm text-sm text-destructive">{message}</p>}
    </div>
  )
}
