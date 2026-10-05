'use client'

import { BookOpen, ChevronRight, ClipboardCheck, Info, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { InventoryCountGuidance } from '@/lib/inventory/inventory-count'

const STEPS = [
  ['1', 'Abrí la toma', 'Elegí la sucursal y si vas a contar todo o una categoría.'],
  ['2', 'Contá físicamente', 'Escaneá el código o ingresá la cantidad que realmente encontraste.'],
  ['3', 'Revisá diferencias', 'Compará faltantes y sobrantes antes de modificar el stock.'],
  ['4', 'Aplicá y cerrá', 'Se ajusta solamente lo contado y cada cambio queda registrado.'],
] as const

export function InventoryCountAssistant({
  guidance,
  onAction,
}: {
  guidance: InventoryCountGuidance
  onAction?: () => void
}) {
  return (
    <section aria-labelledby="inventory-count-assistant-title" className="overflow-hidden rounded-xl border bg-card">
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)] lg:items-start">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary" aria-hidden="true">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Asistente de inventario</p>
              <h2 id="inventory-count-assistant-title" className="font-semibold">{guidance.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{guidance.description}</p>
            </div>
          </div>

          {guidance.actionLabel && onAction && (
            <Button size="sm" onClick={onAction} className="gap-1.5">
              {guidance.actionLabel}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        <details className="group rounded-lg border bg-muted/30">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
            ¿Cómo funciona una toma?
            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
          </summary>
          <div className="space-y-3 border-t px-3 py-3">
            <ol className="space-y-3">
              {STEPS.map(([number, title, description]) => (
                <li key={number} className="flex gap-2.5 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{number}</span>
                  <span><strong className="font-medium">{title}.</strong> <span className="text-muted-foreground">{description}</span></span>
                </li>
              ))}
            </ol>
            <p className="flex gap-2 border-t pt-3 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              Podés seguir vendiendo mientras contás. Los productos sin contar no se ajustan y el asistente nunca modifica stock por sí solo.
            </p>
            <p className="flex gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
              Para reducir errores, usá “Conteo a ciegas” y revisá las diferencias antes de aplicar.
            </p>
          </div>
        </details>
      </div>
    </section>
  )
}
