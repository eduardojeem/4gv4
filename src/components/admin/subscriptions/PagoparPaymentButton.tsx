'use client'

import { useState } from 'react'
import { AlertTriangle, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PagoparPaymentButtonProps = {
  missingFields?: string[]
  isPaidPlan: boolean
  planName: string
  planAmount: string
}

export function PagoparPaymentButton({ missingFields = [], isPaidPlan, planName, planAmount }: PagoparPaymentButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (!isPaidPlan) return null

  async function startPayment() {
    if (missingFields.length > 0) {
      setStatus('error')
      setMessage('Completa los datos de facturacion antes de pagar con Pagopar.')
      return
    }

    setStatus('loading')
    setMessage(null)

    const response = await fetch('/api/admin/subscriptions/payments/pagopar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const payload = await response.json().catch(() => null) as { checkoutUrl?: string; error?: string } | null

    if (!response.ok || !payload?.checkoutUrl) {
      setStatus('error')
      setMessage(payload?.error || 'No se pudo iniciar el pago con Pagopar.')
      return
    }

    window.location.href = payload.checkoutUrl
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={startPayment} disabled={status === 'loading'} className="gap-2">
        <CreditCard className="h-4 w-4" />
        {status === 'loading' ? 'Conectando con Pagopar...' : 'Pagar con Pagopar'}
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
