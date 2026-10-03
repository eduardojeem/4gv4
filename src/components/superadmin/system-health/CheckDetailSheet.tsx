'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { HealthCheckResult } from '@/lib/health/types'
import { CATEGORY_LABEL, SEVERITY_META, STATUS_META, formatDateTime } from './health-meta'

export function StatusBadge({ status, className }: { status: HealthCheckResult['status']; className?: string }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <Badge variant="outline" className={cn('gap-1 rounded-full font-semibold', meta.badge, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {meta.label}
    </Badge>
  )
}

export function SeverityBadge({ severity }: { severity: HealthCheckResult['severity'] }) {
  const meta = SEVERITY_META[severity]
  return (
    <Badge variant="outline" className={cn('rounded-full px-2 text-[10px] font-bold tracking-wide', meta.badge)}>
      {meta.label}
    </Badge>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <div className="text-sm text-slate-800 dark:text-slate-200">{children}</div>
    </div>
  )
}

export function CheckDetailSheet({
  check,
  onOpenChange,
}: {
  check: HealthCheckResult | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={check !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {check && (
          <>
            <SheetHeader className="space-y-2 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={check.status} />
                {check.status !== 'healthy' && <SeverityBadge severity={check.severity} />}
                <Badge variant="outline" className="rounded-full text-xs">{CATEGORY_LABEL[check.category]}</Badge>
              </div>
              <SheetTitle className="text-lg">{check.name}</SheetTitle>
              <SheetDescription>{check.description}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <Field label="Resultado">{check.summary}</Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Impacto potencial">{SEVERITY_META[check.severity].label}</Field>
                <Field label="Módulo">{CATEGORY_LABEL[check.category]}</Field>
              </div>
              <Field label="Qué se comprobó">
                <span className="text-slate-600 dark:text-slate-300">{check.method}</span>
              </Field>
              {check.findings.length > 0 && (
                <Field label={check.status === 'healthy' ? 'Detalle' : 'Problemas detectados'}>
                  <ul className="space-y-1.5">
                    {check.findings.map((finding, index) => (
                      <li
                        key={`${index}-${finding}`}
                        className="break-words rounded-lg border bg-slate-50 px-3 py-2 text-[13px] leading-snug dark:border-slate-800 dark:bg-slate-900"
                      >
                        {finding}
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
              {check.recommendation && (
                <Field label="Recomendación">
                  <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                    {check.recommendation}
                  </p>
                </Field>
              )}
              {check.guidedActions && check.guidedActions.length > 0 && (
                <Field label="Acciones guiadas">
                  <ul className="space-y-2">
                    {check.guidedActions.map((action) => (
                      <li key={`${action.type}-${action.target}`} className="rounded-lg border p-3">
                        <p className="text-sm font-semibold">{action.label}</p>
                        <code className="mt-1 block break-all text-xs text-slate-600 dark:text-slate-300">{action.target}</code>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => void navigator.clipboard?.writeText(action.target)}
                        >
                          Copiar
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fecha">{formatDateTime(check.checkedAt)}</Field>
                <Field label="Duración">{typeof check.durationMs === 'number' ? `${check.durationMs} ms` : '—'}</Field>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Este panel no aplica cambios. Las correcciones se hacen en el código o en el proveedor correspondiente.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
