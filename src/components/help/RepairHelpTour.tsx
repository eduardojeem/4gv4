'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { RepairGuideTask } from './repairs-guide'
import { useRepairHelpActions } from './repair-help-actions'

type RepairHelpTourProps = {
  task: RepairGuideTask
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (taskId: string) => void
}

type AnchorRect = { top: number; left: number; width: number; height: number }

export function RepairHelpTour({ task, open, onOpenChange, onComplete }: RepairHelpTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const [anchorRefreshKey, setAnchorRefreshKey] = useState(0)
  const [isExecuting, setIsExecuting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const executingRef = useRef(false)
  const actionButtonRef = useRef<HTMLButtonElement>(null)
  const executeAction = useRepairHelpActions()
  const step = task.steps[stepIndex]
  const isLastStep = stepIndex === task.steps.length - 1

  useEffect(() => {
    setActionError(null)
  }, [stepIndex])

  useEffect(() => {
    if (!open || !step) return
    const anchor = document.querySelector<HTMLElement>(`[data-help-id="${step.anchorId}"]`)
    if (!anchor) {
      queueMicrotask(() => setAnchorRect(null))
      const observer = new MutationObserver(() => {
        if (document.querySelector(`[data-help-id="${step.anchorId}"]`)) {
          observer.disconnect()
          setAnchorRefreshKey(key => key + 1)
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
      return () => observer.disconnect()
    }

    anchor.setAttribute('data-help-active', 'true')
    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect()
      setAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    }
    const animationFrame = window.requestAnimationFrame(updatePosition)
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    anchor.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      anchor.removeAttribute('data-help-active')
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRefreshKey, open, step])

  const progress = useMemo(() => ((stepIndex + 1) / Math.max(task.steps.length, 1)) * 100, [stepIndex, task.steps.length])
  if (!open || !step) return null

  const finish = () => {
    onComplete?.(task.id)
    onOpenChange(false)
  }

  const waitForAnchor = (anchorId: string) => new Promise<boolean>((resolve) => {
    const startedAt = performance.now()
    const check = () => {
      if (document.querySelector(`[data-help-id="${anchorId}"]`)) {
        resolve(true)
        return
      }
      if (performance.now() - startedAt >= 2000) {
        resolve(false)
        return
      }
      window.requestAnimationFrame(check)
    }
    check()
  })

  const handleAction = async () => {
    const navigationAction = step.navigationAction
    if (!navigationAction || !executeAction || executingRef.current) return
    executingRef.current = true
    setIsExecuting(true)
    setActionError(null)
    try {
      const result = await executeAction(navigationAction.id)
      if (result.status === 'unavailable') {
        setActionError(result.message)
        queueMicrotask(() => actionButtonRef.current?.focus())
        return
      }
      if (navigationAction.successAnchorId) {
        const found = await waitForAnchor(navigationAction.successAnchorId)
        if (!found) {
          setActionError('No pudimos abrir esta vista. Intentá nuevamente o continuá de forma manual.')
          queueMicrotask(() => actionButtonRef.current?.focus())
          return
        }
        setStepIndex(index => Math.min(task.steps.length - 1, index + 1))
      }
    } finally {
      executingRef.current = false
      setIsExecuting(false)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" role="presentation">
      <div className="absolute inset-0 bg-slate-950/55" aria-hidden="true" />
      {anchorRect && (
        <div
          className="pointer-events-none fixed z-[81] rounded-xl ring-4 ring-emerald-400 ring-offset-4 ring-offset-background transition-all"
          style={{ top: anchorRect.top, left: anchorRect.left, width: anchorRect.width, height: anchorRect.height }}
          aria-hidden="true"
        />
      )}

      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Recorrido ${task.title}`}
        className="pointer-events-auto fixed inset-x-3 bottom-3 z-[82] rounded-xl border bg-background p-4 shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Paso {stepIndex + 1} de {task.steps.length}
            </p>
            <h2 className="mt-1 text-base font-semibold">{step.title}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)} aria-label="Cerrar recorrido">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <Progress value={progress} className="mt-3 h-1.5" aria-label="Progreso del recorrido" />
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        {!anchorRect && (
          <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100" role="status">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div><strong>Elemento no disponible en esta vista.</strong><p className="mt-0.5">{step.fallback}</p></div>
          </div>
        )}

        {actionError && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            {actionError}
          </div>
        )}

        {step.navigationAction && executeAction && (
          <Button
            ref={actionButtonRef}
            type="button"
            className="mt-3 w-full"
            onClick={handleAction}
            disabled={isExecuting}
          >
            {isExecuting ? 'Abriendo…' : step.navigationAction.label}
          </Button>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Omitir</Button>
          <div className="flex gap-2">
            <Button variant="outline" disabled={stepIndex === 0} onClick={() => setStepIndex(index => Math.max(0, index - 1))}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Anterior
            </Button>
            {isLastStep ? (
              <Button onClick={finish} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
                <Check className="h-4 w-4" aria-hidden="true" />
                Finalizar
              </Button>
            ) : (
              <Button onClick={() => setStepIndex(index => Math.min(task.steps.length - 1, index + 1))} className="gap-1.5">
                Siguiente
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
