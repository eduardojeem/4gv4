'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CreditCard, Globe, QrCode, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BankTransferPayment } from '@/components/admin/subscriptions/BankTransferPayment'
import {
  PagoparPaymentMethodSelector,
  type SubscriptionPaymentMethod,
} from '@/components/admin/subscriptions/PagoparPaymentMethodSelector'

type SubscriptionPaymentPanelProps = {
  missingFields?: string[]
  isPaidPlan: boolean
  planName: string
  planAmount: string
  stripeEnabled?: boolean
  canPayByTransfer?: boolean
}

type CheckoutErrorPayload = { error?: string; correlationId?: string } | null

/** Las formas que redirigen a una pasarela piden RUC o CI para facturar. */
const CHECKOUT_METHODS: SubscriptionPaymentMethod[] = ['card', 'qr', 'stripe']

export function getPagoparCheckoutErrorMessage(
  payload: CheckoutErrorPayload,
  requestCorrelationId: string,
) {
  return payload?.error || `No se pudo iniciar el pago. Código: ${payload?.correlationId || requestCorrelationId}`
}

/**
 * Todas las formas de pagar la suscripción en un solo lugar: tarjeta y QR por
 * Pagopar, transferencia con comprobante y, solo si se habilita, Stripe.
 */
export function SubscriptionPaymentPanel({
  missingFields = [],
  isPaidPlan,
  planName,
  planAmount,
  stripeEnabled = false,
  canPayByTransfer = false,
}: SubscriptionPaymentPanelProps) {
  const billingIncomplete = missingFields.length > 0
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<SubscriptionPaymentMethod>(
    billingIncomplete && canPayByTransfer ? 'transfer' : 'card',
  )

  // «Cambiar de plan» crea la solicitud de transferencia y vuelve acá con
  // #pay-transfer para mostrar los datos bancarios y subir el comprobante.
  useEffect(() => {
    if (window.location.hash !== '#pay-transfer' || !canPayByTransfer) return
    queueMicrotask(() => {
      setPaymentMethod('transfer')
      document.getElementById('pay')?.scrollIntoView({ block: 'start' })
    })
  }, [canPayByTransfer])

  // En el plan gratuito no hay mes que pagar: tarjeta y QR se eligen junto con
  // el plan nuevo en «Cambiar de plan»; la transferencia deja elegir el plan acá.
  if (!isPaidPlan) {
    if (!canPayByTransfer) return null
    return (
      <section id="pay" aria-label="Pagar por transferencia" className="scroll-mt-24 space-y-3">
        <p className="text-sm text-muted-foreground">
          Para pagar con tarjeta o QR elegí el plan en «Cambiar de plan». También podés contratarlo por transferencia bancaria:
        </p>
        <BankTransferPayment canPay />
      </section>
    )
  }

  const providerName = paymentMethod === 'stripe' ? 'Stripe' : 'Pagopar'
  const isCheckout = paymentMethod !== 'transfer'
  const checkoutBlocked = isCheckout && billingIncomplete

  function selectMethod(method: SubscriptionPaymentMethod) {
    setPaymentMethod(method)
    setStatus('idle')
    setMessage(null)
  }

  async function startPayment() {
    if (checkoutBlocked) return

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
      const payload = await response.json().catch(() => null) as ({ checkoutUrl?: string } & CheckoutErrorPayload) | null

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
    <section
      id="pay"
      aria-labelledby="subscription-pay-title"
      className="scroll-mt-24 rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-card to-card p-5 shadow-sm sm:p-6 dark:border-emerald-500/30 dark:from-emerald-500/[0.12]"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h2 id="subscription-pay-title" className="text-base font-extrabold tracking-tight text-foreground sm:text-lg">
              Pagar la suscripción
            </h2>
            <p className="text-xs text-muted-foreground">Elegí cómo querés pagar el próximo mes.</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {planName} · <strong className="font-semibold text-foreground">{planAmount}</strong>/mes
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <PagoparPaymentMethodSelector
          value={paymentMethod}
          onChange={selectMethod}
          disabled={status === 'loading'}
          disabledMethods={billingIncomplete ? CHECKOUT_METHODS : []}
          includeStripe={stripeEnabled}
          includeTransfer={canPayByTransfer}
        />

        {billingIncomplete && (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="font-semibold">Para pagar con tarjeta o QR completá tus datos de facturación</p>
                <p className="mt-1 text-xs opacity-80">Falta: {missingFields.join(', ')}.</p>
                <a
                  href="#billing-form"
                  className="mt-2 inline-block text-xs font-semibold underline underline-offset-2"
                >
                  Completar datos de facturación →
                </a>
              </div>
            </div>
          </div>
        )}

        {isCheckout ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={startPayment}
              disabled={status === 'loading' || checkoutBlocked}
              className="h-11 w-full gap-2 rounded-xl font-semibold sm:w-auto sm:min-w-56"
            >
              <PaymentIcon className="h-4 w-4" />
              {status === 'loading'
                ? `Conectando con ${providerName}…`
                : paymentMethod === 'qr'
                  ? 'Pagar con QR'
                  : paymentMethod === 'stripe'
                    ? 'Pagar con Stripe'
                    : 'Pagar con tarjeta'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Te llevamos a {providerName} para completar el pago. El plan se renueva cuando el cobro se confirma.
            </p>
          </div>
        ) : (
          <BankTransferPayment canPay={canPayByTransfer} embedded />
        )}

        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      </div>
    </section>
  )
}
