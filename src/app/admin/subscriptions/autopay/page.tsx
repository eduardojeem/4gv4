'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, CreditCard, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { AutopayStatus } from '@/lib/saas/subscription-autopay'

type Notice = { tone: 'success' | 'error'; text: string } | null

function formatDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'long', timeZone: 'America/Asuncion' }).format(new Date(value))
}

async function request(method: 'GET' | 'POST' | 'DELETE', body?: Record<string, unknown>) {
  const response = await fetch('/api/admin/subscriptions/autopay', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || 'No se pudo completar la operación.')
  return payload
}

export default function SubscriptionAutopayPage() {
  const [status, setStatus] = useState<AutopayStatus | null>(null)
  const [formUrl, setFormUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>('load')
  const [notice, setNotice] = useState<Notice>(null)

  const run = useCallback(async (key: string, action: () => Promise<void>) => {
    setBusy(key)
    setNotice(null)
    try {
      await action()
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo completar la operación.' })
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => {
    const returned = new URLSearchParams(window.location.search).get('card')
    void run('load', async () => {
      if (returned) {
        // Vuelta del formulario de uPay: confirmar es obligatorio en Pagopar, haya salido bien o no.
        window.history.replaceState(null, '', window.location.pathname)
        const result = await request('POST', { action: 'confirm' }) as { saved: boolean; status: AutopayStatus }
        setStatus(result.status)
        setNotice(result.saved
          ? { tone: 'success', text: 'Tarjeta guardada. El débito automático quedó activado.' }
          : { tone: 'error', text: 'No se guardó la tarjeta. Revisá los datos e intentá de nuevo.' })
        return
      }
      setStatus(await request('GET'))
    })
  }, [run])

  const startCardForm = () => run('start', async () => {
    const result = await request('POST', { action: 'start' }) as { formUrl: string }
    setFormUrl(result.formUrl)
  })

  const toggleEnabled = (enabled: boolean) => run('toggle', async () => {
    setStatus(await request('POST', { action: enabled ? 'enable' : 'disable' }))
  })

  const removeCard = () => run('remove', async () => {
    setStatus(await request('DELETE'))
    setNotice({ tone: 'success', text: 'Tarjeta eliminada. El débito automático quedó desactivado.' })
  })

  const nextAttempt = formatDate(status?.nextAttemptAt ?? null)

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/subscriptions"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Débito automático</h1>
          <p className="text-sm text-muted-foreground">Cobramos tu plan cada mes con la tarjeta que guardes en uPay.</p>
        </div>
      </div>

      {notice && (
        <Alert variant={notice.tone === 'error' ? 'destructive' : 'default'} className={notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300' : undefined}>
          {notice.tone === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      {busy === 'load' && !status && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {status && !status.available && (
        <Alert>
          <CreditCard className="h-4 w-4" />
          <AlertDescription>
            El débito automático todavía no está habilitado. Mientras tanto podés pagar cada mes desde Suscripción.
          </AlertDescription>
        </Alert>
      )}

      {status?.available && (
        <>
          {status.suspended && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Suspendimos el débito después de {status.maxAttempts} cobros rechazados. Pagá desde Suscripción o guardá
                otra tarjeta y volvé a activarlo.
              </AlertDescription>
            </Alert>
          )}
          {!status.suspended && status.failedAttempts > 0 && (
            <Alert className="border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                El último cobro fue rechazado (intento {status.failedAttempts} de {status.maxAttempts})
                {status.lastError ? `: ${status.lastError}` : ''}.
                {nextAttempt ? ` Reintentamos el ${nextAttempt}.` : ''}
              </AlertDescription>
            </Alert>
          )}

          <section className="space-y-4 rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">
                    {status.card ? `${status.card.brand || 'Tarjeta'} ${status.card.masked || ''}` : 'Sin tarjeta guardada'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {status.card ? `${status.card.type || 'Tarjeta'} · uPay` : 'Visa o Mastercard, crédito o débito.'}
                  </p>
                </div>
              </div>
              {status.card && (
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{status.enabled ? 'Activo' : 'Pausado'}</span>
                  <Switch
                    checked={status.enabled}
                    disabled={busy !== null}
                    onCheckedChange={toggleEnabled}
                    aria-label="Activar débito automático"
                  />
                </label>
              )}
            </div>

            {status.card && status.enabled && !status.suspended && status.failedAttempts === 0 && (
              <p className="text-sm text-muted-foreground">
                Cobramos el día en que vence tu período. Si la tarjeta rechaza, reintentamos a los 2 y a los 5 días y te
                avisamos por correo en cada intento.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={startCardForm} disabled={busy !== null} className="gap-2">
                {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {status.card ? 'Cambiar tarjeta' : 'Guardar tarjeta'}
              </Button>
              {status.card && (
                <Button type="button" variant="outline" onClick={removeCard} disabled={busy !== null} className="gap-2">
                  {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Quitar tarjeta
                </Button>
              )}
            </div>
          </section>

          {formUrl && (
            <section className="space-y-2 rounded-2xl border bg-card p-3">
              <p className="px-2 text-sm text-muted-foreground">
                Completá los datos en el formulario seguro de uPay. Tu tarjeta no pasa por nuestros servidores.
              </p>
              <iframe
                src={formUrl}
                title="Formulario de tarjeta de uPay"
                className="h-[340px] w-full rounded-xl border-0"
              />
            </section>
          )}
        </>
      )}
    </div>
  )
}
