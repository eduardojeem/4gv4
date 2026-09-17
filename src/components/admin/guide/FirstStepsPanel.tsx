'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, RefreshCw, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { assessFirstSteps, filterFirstSteps, summarizeFirstSteps, type FirstStepsInput } from '@/lib/guide/first-steps'
import { cn } from '@/lib/utils'

/**
 * El primer paso de una organización nueva, medido con sus propios datos.
 *
 * El onboarding decía «completado» y la empresa seguía sin productos, sin caja
 * y sin ventas: esa era justamente la pantalla que faltaba.
 */
type LoadResult =
  | { kind: 'ready'; input: FirstStepsInput }
  | { kind: 'empty' }
  | { kind: 'error' }

/** Fuera del componente: así no toca el estado y el efecto queda limpio. */
async function loadFirstSteps(): Promise<LoadResult> {
  try {
    const response = await fetch('/api/admin/guide/first-steps', { cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) return { kind: 'error' }
    if (!payload.data) return { kind: 'empty' }
    return { kind: 'ready', input: payload.data as FirstStepsInput }
  } catch {
    return { kind: 'error' }
  }
}

export function FirstStepsPanel() {
  const [input, setInput] = useState<FirstStepsInput | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading')
  const [reloads, setReloads] = useState(0)
  const { hasPermission } = useAuth()
  const { effectiveModules } = useSubscriptionStatus()

  useEffect(() => {
    let vigente = true
    void (async () => {
      const result = await loadFirstSteps()
      if (!vigente) return
      if (result.kind === 'ready') setInput(result.input)
      setStatus(result.kind === 'ready' ? 'ready' : result.kind)
    })()
    return () => {
      vigente = false
    }
  }, [reloads])

  const refresh = useCallback(() => {
    setStatus('loading')
    setReloads((count) => count + 1)
  }, [])

  const assessment = useMemo(() => {
    if (!input) return null
    const all = assessFirstSteps(input).steps
    return summarizeFirstSteps(filterFirstSteps(all, { hasPermission, modules: effectiveModules }))
  }, [input, hasPermission, effectiveModules])

  if (status === 'empty') return null

  return (
    <Card className="border-l-4 border-l-primary shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Rocket className="h-[18px] w-[18px] text-primary" aria-hidden />
              Primeros pasos
            </CardTitle>
            <CardDescription>
              Lo que falta para que el negocio esté operativo, según lo que hay cargado hoy.
            </CardDescription>
          </div>
          {status === 'ready' && assessment && (
            <div className="flex items-center gap-3">
              {assessment.readyToSell ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Listo para vender</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300">
                  Falta lo esencial
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={refresh} aria-label="Actualizar el avance">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status === 'loading' && (
          <div className="space-y-3">
            <Skeleton className="h-2 w-full" />
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-14 w-full" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              No se pudo calcular el avance.
            </p>
            <Button variant="outline" size="sm" onClick={refresh}>
              Reintentar
            </Button>
          </div>
        )}

        {status === 'ready' && assessment && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {assessment.done} de {assessment.total} pasos
                </span>
                <span className="tabular-nums text-muted-foreground">{assessment.percent}%</span>
              </div>
              <Progress value={assessment.percent} className="h-2" />
            </div>

            <ul className="space-y-2">
              {assessment.steps.map((step) => {
                const isNext = assessment.next?.key === step.key
                return (
                  <li
                    key={step.key}
                    className={cn(
                      'rounded-xl border p-3 transition-colors',
                      step.done
                        ? 'border-border bg-card'
                        : isNext
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border bg-card',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {step.done ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : (
                        <Circle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn('text-sm font-medium', step.done ? 'text-muted-foreground' : 'text-foreground')}>
                            {step.label}
                          </p>
                          {isNext && <Badge variant="secondary" className="text-[10px]">Seguí por acá</Badge>}
                          {!step.done && step.essential && (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              Imprescindible
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p>
                        {!step.done && (
                          <>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.why}</p>
                            <Link
                              href={step.action.href}
                              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                            >
                              {step.action.label}
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
