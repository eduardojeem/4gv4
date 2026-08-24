'use client'

import { Check, CircleDashed, PartyPopper } from 'lucide-react'
import type { ProductModalTab, ProductRequirement } from '@/components/dashboard/product-modal-behavior'
import { cn } from '@/lib/utils'

type NewProductChecklistProps = {
  requirements: ProductRequirement[]
  completed: number
  total: number
  isComplete: boolean
  /** Lleva a la pestaña donde vive el campo que falta. */
  onNavigate: (tab: ProductModalTab) => void
}

const TAB_LABELS: Record<ProductModalTab, string> = {
  basic: 'Básica',
  pricing: 'Precios',
  inventory: 'Inventario',
  'post-sale': 'Postventa',
  images: 'Imágenes',
}

/**
 * Progreso de los campos obligatorios al crear un producto.
 *
 * Ocupa el espacio de la barra lateral que solo se usaba al editar. Resuelve
 * el problema de que los 4 obligatorios estan en dos pestañas distintas y
 * antes solo te enterabas al ser rebotado en el guardado.
 */
export function NewProductChecklist({
  requirements,
  completed,
  total,
  isComplete,
  onNavigate,
}: NewProductChecklistProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div
      className="hidden md:block mt-6 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-slate-800"
      data-testid="new-product-checklist"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
          Para poder guardar
        </h4>
        <span
          className={cn(
            'text-xs font-bold tabular-nums',
            isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400',
          )}
        >
          {completed}/{total}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isComplete ? 'bg-emerald-500' : 'bg-blue-500',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1">
        {requirements.map((requirement) => (
          <li key={requirement.key}>
            <button
              type="button"
              onClick={() => onNavigate(requirement.tab)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors',
                'hover:bg-gray-50 dark:hover:bg-slate-700/60',
                requirement.done ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200',
              )}
            >
              {requirement.done ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
              ) : (
                <CircleDashed className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
              )}
              <span className={cn('truncate', requirement.done && 'line-through')}>
                {requirement.label}
              </span>
              {!requirement.done && (
                <span className="ml-auto shrink-0 rounded bg-gray-100 px-1.5 text-[10px] font-medium text-gray-500 dark:bg-slate-700 dark:text-gray-300">
                  {TAB_LABELS[requirement.tab]}
                </span>
              )}
              <span className="sr-only">
                {requirement.done ? 'completado' : `falta, está en la pestaña ${TAB_LABELS[requirement.tab]}`}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {isComplete && (
        <p className="mt-3 flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <PartyPopper className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Listo para guardar. El resto es opcional.
        </p>
      )}
    </div>
  )
}
