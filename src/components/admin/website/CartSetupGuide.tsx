'use client'

import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CART_SETUP_STEPS, type CartSetupIssue, type CartSetupStep } from '@/lib/checkout/cart-setup'

function scrollToAnchor(anchor: string) {
  document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Los pasos para recibir pedidos por carrito, con lo que falta en cada uno.
 * Los errores no dejan guardar; los avisos son recomendaciones.
 */
export function CartSetupGuide({
  issues,
  activeSteps,
  onFillTexts,
  onFixInCompany,
}: {
  issues: CartSetupIssue[]
  /** Pasos que aplican (sin el módulo de entregas el delivery no cuenta). */
  activeSteps: Record<CartSetupStep, boolean>
  onFillTexts: () => void
  onFixInCompany?: () => void
}) {
  const errors = issues.filter((issue) => issue.level === 'error')
  const ready = errors.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-foreground sm:text-base">
            {ready ? 'Tu carrito está listo para recibir pedidos' : 'Configurá tu carrito para recibir pedidos'}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ready
              ? issues.length > 0
                ? 'Funciona. Revisá las recomendaciones para que tus clientes no tengan dudas.'
                : 'Pago, entrega y confirmación completos.'
              : `Te ${errors.length === 1 ? 'falta 1 dato' : `faltan ${errors.length} datos`} para poder guardar. Seguí los pasos.`}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs" onClick={onFillTexts}>
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Completar textos con mis datos
        </Button>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {CART_SETUP_STEPS.map(({ step, label, anchor }, index) => {
          const stepIssues = issues.filter((issue) => issue.step === step)
          const hasError = stepIssues.some((issue) => issue.level === 'error')
          const off = !activeSteps[step]
          const status = hasError ? 'Falta completar' : off ? 'Desactivado' : stepIssues.length > 0 ? 'Para revisar' : 'Listo'
          return (
            <li key={step}>
              <button
                type="button"
                onClick={() => scrollToAnchor(anchor)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl border p-3 text-left text-xs transition-colors hover:bg-muted/40',
                  hasError ? 'border-amber-300 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20' : 'bg-background'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    hasError ? 'bg-amber-500 text-white' : off ? 'bg-muted text-muted-foreground' : stepIssues.length > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200' : 'bg-emerald-500 text-white'
                  )}
                  aria-hidden="true"
                >
                  {hasError || off || stepIssues.length > 0 ? index + 1 : <CheckCircle2 className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">{label}</span>
                  <span className={cn('block', hasError ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>{status}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {issues.length > 0 && (
        <ul className="space-y-1.5 border-t border-border/60 pt-3">
          {issues.map((issue) => {
            const anchor = CART_SETUP_STEPS.find((item) => item.step === issue.step)?.anchor ?? ''
            const Icon = issue.level === 'error' ? CircleAlert : AlertTriangle
            return (
              <li key={issue.id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <span className="flex items-start gap-2 text-xs text-foreground">
                  <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', issue.level === 'error' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')} aria-hidden="true" />
                  {issue.message}
                </span>
                {issue.fixIn === 'company' && onFixInCompany ? (
                  <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 gap-1 self-start px-2 text-xs" onClick={onFixInCompany}>
                    Cargar en Empresa <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 gap-1 self-start px-2 text-xs" onClick={() => scrollToAnchor(anchor)}>
                    Ir <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
