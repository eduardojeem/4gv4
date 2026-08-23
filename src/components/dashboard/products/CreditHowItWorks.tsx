'use client'

import { ExternalLink, HelpCircle, Settings2 } from 'lucide-react'

const CREDIT_DEFAULTS_HREF = '/dashboard/products/credit-defaults'

/**
 * Enlace a la configuración de datos predeterminados de cuotas.
 *
 * Abre en una pestaña nueva a propósito: el formulario de producto es un
 * diálogo con datos sin guardar, y navegar en la misma pestaña los perdería.
 */
export function CreditDefaultsLink({ className = '' }: { className?: string }) {
  return (
    <a
      href={CREDIT_DEFAULTS_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400 ${className}`}
    >
      <Settings2 className="h-3 w-3" />
      Configurar predeterminados
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  )
}

type CreditHowItWorksProps = {
  /** De dónde sale el precio base, ya resuelto para este producto. */
  baseLabel: string
  /** Cuántos planes hay configurados como predeterminados. */
  planCount: number
  /** Si los predeterminados están activos para ofrecerse. */
  defaultsEnabled: boolean
}

/** Explicación breve del funcionamiento de las cuotas, dentro del formulario. */
export function CreditHowItWorks({ baseLabel, planCount, defaultsEnabled }: CreditHowItWorksProps) {
  return (
    <details className="group rounded-lg border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
          ¿Cómo funcionan las cuotas?
        </span>
        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
          <span className="group-open:hidden">Ver ↓</span>
          <span className="hidden group-open:inline">Ocultar ↑</span>
        </span>
      </summary>

      <div className="space-y-2 border-t border-slate-200 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">
        <p>
          <strong className="text-slate-800 dark:text-slate-200">1. Activás la financiación.</strong>{' '}
          {defaultsEnabled && planCount > 0
            ? `Vas a poder usar los ${planCount} planes ya configurados o cargar unos nuevos solo para este producto.`
            : 'Vas a armar los planes a mano para este producto.'}
        </p>
        <p>
          <strong className="text-slate-800 dark:text-slate-200">2. Cada plan es cantidad + recargo.</strong>{' '}
          El recargo es un porcentaje que se suma antes de dividir en cuotas. Con 0% el cliente paga
          el mismo total, solo que repartido.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-slate-200">3. La cuota se calcula sobre {baseLabel.toLowerCase()}.</strong>{' '}
          Es la base definida en la configuración: si la cambiás, cambian todas las cuotas de todos
          los productos.
        </p>
        <p>
          <strong className="text-slate-800 dark:text-slate-200">4. Los planes se guardan igual.</strong>{' '}
          Si después desactivás la financiación, quedan guardados y vuelven al reactivarla.
        </p>

        <div className="pt-1">
          <CreditDefaultsLink />
        </div>
      </div>
    </details>
  )
}
