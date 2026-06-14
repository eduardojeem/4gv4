'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock3, Loader2, TicketPercent, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type FeedbackState = {
  tone: 'success' | 'error' | 'warning'
  title: string
  message: string
} | null

export function PromoCodeRedeemer({ canRedeem }: { canRedeem: boolean }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  async function redeem() {
    if (!code.trim()) return
    setLoading(true)
    setFeedback(null)

    try {
      const response = await fetch('/api/admin/subscriptions/promo-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await response.json()

      if (!response.ok) {
        setFeedback({
          tone: response.status === 429 ? 'warning' : 'error',
          title: response.status === 429 ? 'Demasiados intentos' : 'Código no válido',
          message: data.error || 'Revisa el código e intenta nuevamente.',
        })
        return
      }

      setFeedback({
        tone: 'success',
        title: 'Promoción aplicada correctamente',
        message: data.requiresBillingAction
          ? 'El descuento quedó registrado para facturación.'
          : 'Tu suscripción fue actualizada con el beneficio del código.',
      })
      setCode('')
      router.refresh()
    } catch (error) {
      setFeedback({
        tone: 'error',
        title: 'No se pudo validar el código',
        message: error instanceof Error ? error.message : 'Ocurrió un problema de conexión. Intenta nuevamente.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-background">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/60 dark:text-indigo-300 dark:ring-indigo-800">
          <TicketPercent className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">¿Tienes un código promocional?</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {canRedeem ? 'Aplícalo a la suscripción de tu organización.' : 'No tienes permiso para aplicar códigos promocionales.'}
          </p>
          {canRedeem && <p className="mt-1 text-xs text-muted-foreground">Máximo 5 intentos por usuario y 10 por organización cada 30 minutos.</p>}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={code}
              onChange={event => {
                setCode(event.target.value.toUpperCase())
                if (feedback?.tone !== 'success') setFeedback(null)
              }}
              onKeyDown={event => { if (event.key === 'Enter') void redeem() }}
              disabled={!canRedeem || loading}
              placeholder="Ej. BIENVENIDA-2026"
              aria-invalid={feedback?.tone === 'error'}
              className={cn(
                'bg-background font-mono uppercase tracking-wide',
                feedback?.tone === 'error' && 'border-red-400 focus-visible:ring-red-400'
              )}
            />
            <Button onClick={() => void redeem()} disabled={!canRedeem || loading || !code.trim()} className="shrink-0">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-2 h-4 w-4" />}
              {loading ? 'Validando...' : 'Aplicar código'}
            </Button>
          </div>

          {feedback && (
            <div
              role={feedback.tone === 'success' ? 'status' : 'alert'}
              className={cn(
                'relative mt-3 overflow-hidden rounded-lg border p-3.5 pr-10',
                feedback.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100',
                feedback.tone === 'error' && 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100',
                feedback.tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100'
              )}
            >
              <div className="flex items-start gap-2.5">
                {feedback.tone === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                {feedback.tone === 'error' && <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />}
                {feedback.tone === 'warning' && <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />}
                <div>
                  <p className="text-sm font-semibold">{feedback.title}</p>
                  <p className="mt-0.5 text-sm opacity-80">{feedback.message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Cerrar mensaje"
                className="absolute right-2 top-2 rounded-md p-1 opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
