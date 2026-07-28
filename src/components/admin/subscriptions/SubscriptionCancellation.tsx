'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarX, Loader2, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'

type Conflict = { resource: string; current: number; limit: number }

interface Props {
  isFreePlan: boolean
  cancelAtPeriodEnd: boolean
  periodEndDate: string | null
  currentPlanName: string
}

function formatDate(value: string | null) {
  if (!value) return 'el fin del período'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'long' }).format(new Date(value))
}

export function SubscriptionCancellation({ isFreePlan, cancelAtPeriodEnd, periodEndDate, currentPlanName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  const hasFuturePeriod = periodEndDate ? new Date(periodEndDate).getTime() > Date.now() : false

  async function submitCancel() {
    setLoading(true)
    setConflicts([])
    try {
      const res = await fetch('/api/admin/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const payload = await res.json().catch(() => null)
      if (res.status === 409 && payload?.conflictingResources) {
        setConflicts(payload.conflictingResources)
        return
      }
      if (!res.ok || !payload?.success) {
        toast.error(payload?.error || 'No se pudo cancelar la suscripción.')
        return
      }
      toast.success(
        hasFuturePeriod
          ? 'Suscripción programada para cancelarse al fin del período.'
          : 'Suscripción cancelada. Tu cuenta pasó al plan Gratuito.'
      )
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function reactivate() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactivate: true }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.success) {
        toast.error(payload?.error || 'No se pudo reactivar la suscripción.')
        return
      }
      toast.success('Cancelación retirada. Podrás iniciar el próximo pago desde Suscripción.')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  // En el plan Gratuito no hay nada que cancelar.
  if (isFreePlan && !cancelAtPeriodEnd) return null

  // Cancelación ya programada → banner + reactivar.
  if (cancelAtPeriodEnd) {
    return (
      <Alert className="border-orange-200 bg-orange-50/80 dark:border-orange-900/60 dark:bg-orange-950/20">
        <CalendarX className="h-4 w-4" />
        <AlertTitle>Cancelación programada</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            Tu plan <strong>{currentPlanName}</strong> seguirá activo hasta el{' '}
            <strong>{formatDate(periodEndDate)}</strong>. Luego pasará automáticamente al plan Gratuito.
          </p>
          <Button size="sm" variant="outline" onClick={reactivate} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Reactivar suscripción
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Plan pago activo → botón de cancelar.
  return (
    <>
      <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4" />
        Cancelar suscripción
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!loading) { setOpen(v); if (!v) setConflicts([]) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar suscripción</DialogTitle>
            <DialogDescription>
              {hasFuturePeriod ? (
                <>
                  Tu plan <strong>{currentPlanName}</strong> seguirá activo hasta el{' '}
                  <strong>{formatDate(periodEndDate)}</strong>. Al finalizar ese período, tu cuenta pasará al plan
                  Gratuito. No se realizarán nuevos cobros.
                </>
              ) : (
                <>
                  Tu plan <strong>{currentPlanName}</strong> pasará al plan Gratuito de inmediato. No se realizarán
                  nuevos cobros.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {conflicts.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Reducí estos recursos antes de cancelar</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                  {conflicts.map((c) => (
                    <li key={c.resource}>
                      {c.resource}: tenés <strong>{c.current}</strong>, el plan Gratuito permite <strong>{c.limit}</strong>.
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Volver
            </Button>
            <Button variant="destructive" onClick={submitCancel} disabled={loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
