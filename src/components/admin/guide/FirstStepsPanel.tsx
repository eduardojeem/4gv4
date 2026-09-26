'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Filter,
  ImageIcon,
  PartyPopper,
  RefreshCw,
  Rocket,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { assessFirstSteps, filterFirstSteps, summarizeFirstSteps, type FirstStepsInput, type FirstStepKey } from '@/lib/guide/first-steps'
import type { BusinessVertical } from '@/lib/organization/business-profile'
import type { GuideUIPreviewType } from '@/lib/guide/types'
import { GuideVisualPreview } from './GuideVisualPreview'
import { cn } from '@/lib/utils'

const STEP_PREVIEWS: Record<FirstStepKey, GuideUIPreviewType> = {
  negocio: 'business',
  productos: 'inventory',
  caja: 'caja',
  venta: 'sale',
  tienda: 'website',
  equipo: 'users',
}

type LoadResult =
  | { kind: 'ready'; input: FirstStepsInput }
  | { kind: 'empty' }
  | { kind: 'error' }

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

export type StepFilter = 'all' | 'pending' | 'completed'

export function FirstStepsPanel({ vertical }: { vertical?: BusinessVertical }) {
  const [input, setInput] = useState<FirstStepsInput | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading')
  const [reloads, setReloads] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [stepFilter, setStepFilter] = useState<StepFilter>('all')
  const [expandedPreviews, setExpandedPreviews] = useState<Record<string, boolean>>({})
  const { hasPermission, isAdmin } = useAuth()
  const { effectiveModules, businessVertical } = useSubscriptionStatus()
  const currentVertical = vertical || (businessVertical as BusinessVertical) || 'electronics'

  const togglePreview = useCallback((key: string) => {
    setExpandedPreviews((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  useEffect(() => {
    let vigente = true
    void (async () => {
      const result = await loadFirstSteps()
      if (!vigente) return
      if (result.kind === 'ready') setInput(result.input)
      setStatus(result.kind === 'ready' ? 'ready' : result.kind)
      setIsRefreshing(false)
    })()
    return () => {
      vigente = false
    }
  }, [reloads])

  const refresh = useCallback(() => {
    setIsRefreshing(true)
    setReloads((count) => count + 1)
  }, [])

  const assessment = useMemo(() => {
    if (!input) return null
    const all = assessFirstSteps(input).steps
    return summarizeFirstSteps(filterFirstSteps(all, { hasPermission, isAdmin, modules: effectiveModules }))
  }, [input, hasPermission, isAdmin, effectiveModules])

  const visibleSteps = useMemo(() => {
    if (!assessment) return []
    if (stepFilter === 'pending') return assessment.steps.filter((s) => !s.done)
    if (stepFilter === 'completed') return assessment.steps.filter((s) => s.done)
    return assessment.steps
  }, [assessment, stepFilter])

  if (status === 'empty') return null

  const pendingCount = assessment ? assessment.total - assessment.done : 0
  const isAllDone = assessment ? assessment.done === assessment.total && assessment.total > 0 : false

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
            <div className="flex flex-wrap items-center gap-2">
              {assessment.readyToSell ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Listo para vender</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300">
                  Falta lo esencial
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={refresh}
                disabled={isRefreshing}
                aria-label="Actualizar el avance"
                title="Actualizar estado en tiempo real"
              >
                <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin text-primary')} />
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
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {assessment.done} de {assessment.total} pasos
                </span>
                <span className="font-semibold tabular-nums text-primary">{assessment.percent}%</span>
              </div>
              <Progress value={assessment.percent} className="h-2" />
            </div>

            {isAllDone && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                <PartyPopper className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">¡Completaste todos los primeros pasos iniciales!</p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    Tu organización cuenta con catálogo, caja, equipo y tienda listos para operar a toda velocidad.
                  </p>
                </div>
              </div>
            )}

            {/* Filtros de pasos y toggle de ejemplos */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                <span>Mostrar:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setStepFilter('all')}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                      stepFilter === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    Todos ({assessment.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStepFilter('pending')}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                      stepFilter === 'pending'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    Pendientes ({pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStepFilter('completed')}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                      stepFilter === 'completed'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    Listos ({assessment.done})
                  </button>
                </div>

                <div className="hidden h-4 w-px bg-border/60 sm:block" />

                <button
                  type="button"
                  onClick={() => {
                    const allOpen = visibleSteps.every((s) => expandedPreviews[s.key])
                    const next: Record<string, boolean> = {}
                    visibleSteps.forEach((s) => {
                      next[s.key] = !allOpen
                    })
                    setExpandedPreviews(next)
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-muted/50 transition-all shadow-2xs"
                  title="Abrir o cerrar todos los ejemplos visuales"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {visibleSteps.length > 0 && visibleSteps.every((s) => expandedPreviews[s.key])
                      ? 'Ocultar ejemplos'
                      : 'Ver ejemplos visuales'}
                  </span>
                </button>
              </div>
            </div>

            <ul className="space-y-2">
              {visibleSteps.length === 0 ? (
                <li className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No hay pasos en esta vista.
                </li>
              ) : (
                visibleSteps.map((step) => {
                  const isNext = assessment.next?.key === step.key
                  return (
                    <li
                      key={step.key}
                      className={cn(
                        'rounded-xl border p-3.5 transition-all duration-200',
                        step.done
                          ? 'border-border/70 bg-card/60'
                          : isNext
                            ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
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
                            {isNext && (
                              <Badge variant="secondary" className="flex items-center gap-1 bg-primary/10 text-[10px] text-primary">
                                <Sparkles className="h-3 w-3" />
                                Seguí por acá
                              </Badge>
                            )}
                            {!step.done && step.essential && (
                              <Badge variant="outline" className="border-amber-400 text-[10px] text-amber-700 uppercase tracking-wide dark:border-amber-700 dark:text-amber-400">
                                Imprescindible
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p>
                          {!step.done && (
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.why}</p>
                          )}
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            {!step.done && (
                              <Link
                                href={step.action.href}
                                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 hover:underline"
                              >
                                {step.action.label}
                                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => togglePreview(step.key)}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/60 hover:text-foreground hover:bg-muted/60 transition-all shadow-2xs"
                            >
                              {expandedPreviews[step.key] ? (
                                <>
                                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>Ocultar ejemplo</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3.5 w-3.5 text-primary" />
                                  <span>Ver ejemplo visual</span>
                                </>
                              )}
                            </button>
                          </div>

                          {expandedPreviews[step.key] && (
                            <div className="mt-3">
                              <GuideVisualPreview
                                preview={STEP_PREVIEWS[step.key]}
                                title={step.label}
                                vertical={currentVertical}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
