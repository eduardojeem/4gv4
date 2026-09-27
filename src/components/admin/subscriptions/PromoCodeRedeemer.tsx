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
    <div className="rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/40 p-5 sm:p-6 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-violet-950/20">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
          <TicketPercent className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">¿Tienes un código de descuento o activación?</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
              Cupón
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {canRedeem ? 'Ingresa tu código promocional o voucher para extender tu plan, desbloquear funciones o aplicar descuentos.' : 'No tienes permiso para aplicar códigos promocionales.'}
          </p>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Input
              value={code}
              onChange={event => {
                setCode(event.target.value.toUpperCase())
                if (feedback?.tone !== 'success') setFeedback(null)
              }}
              onKeyDown={event => { if (event.key === 'Enter') void redeem() }}
              disabled={!canRedeem || loading}
              placeholder="EJ: PROMO-2026-VIP"
              aria-invalid={feedback?.tone === 'error'}
              className={cn(
                'rounded-2xl border-slate-200 dark:border-slate-800 h-11 text-sm bg-white dark:bg-slate-900 shadow-2xs focus-visible:ring-indigo-500 font-mono uppercase tracking-wider',
                feedback?.tone === 'error' && 'border-rose-400 focus-visible:ring-rose-400'
              )}
            />
            <Button
              onClick={() => void redeem()}
              disabled={!canRedeem || loading || !code.trim()}
              className="shrink-0 rounded-2xl h-11 px-6 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-2 h-4 w-4" />}
              {loading ? 'Validando...' : 'Aplicar código'}
            </Button>
          </div>

          {feedback && (
            <div
              role={feedback.tone === 'success' ? 'status' : 'alert'}
              className={cn(
                'relative mt-3.5 overflow-hidden rounded-2xl border p-4 pr-10 shadow-xs',
                feedback.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100',
                feedback.tone === 'error' && 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100',
                feedback.tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100'
              )}
            >
              <div className="flex items-start gap-3">
                {feedback.tone === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                {feedback.tone === 'error' && <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />}
                {feedback.tone === 'warning' && <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />}
                <div>
                  <p className="text-sm font-bold">{feedback.title}</p>
                  <p className="mt-0.5 text-xs opacity-90 leading-relaxed">{feedback.message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Cerrar mensaje"
                className="absolute right-3 top-3 rounded-lg p-1 opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
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
