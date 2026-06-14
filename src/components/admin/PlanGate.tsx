'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock, Sparkles, Gift, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

/**
 * Envuelve contenido que requiere un módulo del plan. Si el plan activo no lo
 * incluye, muestra el contenido difuminado con una tarjeta de upgrade encima.
 */
export function PlanGate({
  module,
  requiredPlan = 'Pro',
  title,
  description,
  fallback,
  children,
}: {
  module: string
  requiredPlan?: string
  title?: string
  description?: string
  /** Fondo decorativo (liviano) que se difumina detrás del aviso cuando está bloqueado.
   *  Si no se pasa, los `children` NO se montan (útil para componentes pesados). */
  fallback?: React.ReactNode
  children: React.ReactNode
}) {
  const { modules, planName, trialedModules } = useSubscriptionStatus()
  const router = useRouter()
  const [starting, setStarting] = useState(false)

  if (modules.includes(module)) {
    return <>{children}</>
  }

  // El módulo es elegible para prueba si todavía no se usó la prueba gratis.
  const canTrial = !trialedModules.includes(module)

  const startTrial = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/admin/module-trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(payload?.error || 'No se pudo activar la prueba.')
        return
      }
      toast.success(`Prueba de 7 días activada. ¡Disfrutalo!`)
      router.refresh() // re-fetch del contexto del plan en el layout server
    } catch {
      toast.error('No se pudo activar la prueba.')
    } finally {
      setStarting(false)
    }
  }

  // Bloqueado: NO montamos children (evita fetches pesados). Difuminamos solo el fallback.
  return (
    <div className="relative min-h-[420px]">
      <div className="pointer-events-none absolute inset-0 select-none opacity-60 blur-sm" aria-hidden="true">
        {fallback ?? <div className="h-full w-full rounded-xl bg-gradient-to-br from-violet-100/50 to-blue-100/40 dark:from-violet-950/30 dark:to-blue-950/20" />}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-gray-200 bg-background p-6 text-center shadow-lg dark:border-slate-800">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-950/30">
            <Lock className="h-6 w-6 text-violet-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {title || 'Función no incluida en tu plan'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description || `Tu plan ${planName} no incluye esta sección. Subí a ${requiredPlan} para desbloquearla.`}
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            {canTrial && (
              <Button onClick={startTrial} disabled={starting} className="w-full gap-2">
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                Probar 7 días gratis
              </Button>
            )}
            <Button asChild variant={canTrial ? 'outline' : 'default'} className="w-full gap-2">
              <Link href="/admin/subscriptions">
                <Sparkles className="h-4 w-4" />
                Ver planes
              </Link>
            </Button>
            {!canTrial && (
              <p className="text-xs text-gray-400">Ya usaste la prueba gratis de este módulo.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Aviso inline (no overlay) para gatear una acción puntual, ej. subir fotos.
 */
export function UpgradeHint({
  message,
  requiredPlan = 'Pro',
}: {
  message?: string
  requiredPlan?: string
}) {
  const { planName } = useSubscriptionStatus()
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm dark:border-violet-900 dark:bg-violet-950/30">
      <span className="text-violet-700 dark:text-violet-300">
        {message || `Tu plan ${planName} no incluye esto. Disponible desde ${requiredPlan}.`}
      </span>
      <Button asChild size="sm" variant="outline" className="shrink-0">
        <Link href="/admin/subscriptions">
          <Sparkles className="h-4 w-4" />
          Subir plan
        </Link>
      </Button>
    </div>
  )
}
