'use client'

import { useMemo, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { formatPrice, cn } from '@/lib/utils'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'
import type { InstallmentPlanOption } from '@/types/public'

interface InstallmentSelectorProps {
  /** Precio efectivo sobre el que se calculan las cuotas (respeta oferta/mayorista). */
  price: number
  plans: InstallmentPlanOption[]
  /** Variante reducida para espacios chicos (quick-view). */
  compact?: boolean
  className?: string
}

/**
 * Selector interactivo de cuotas para la tienda pública.
 * Muestra las cantidades disponibles como chips y un único precio destacado
 * que cambia según la opción elegida — escala bien aunque haya muchas cuotas.
 */
export function InstallmentSelector({ price, plans, compact = false, className }: InstallmentSelectorProps) {
  const options = useMemo(() => {
    if (!price || price <= 0 || !Array.isArray(plans)) return []
    return plans
      .filter((plan) => plan && plan.count >= 1)
      .sort((a, b) => a.count - b.count)
      .map((plan) => {
        const built = buildCreditInstallmentPlan({
          principalAmount: price,
          interestRate: plan.rate ?? 0,
          installmentCount: plan.count,
          frequency: 'monthly',
        })
        return {
          count: plan.count,
          perInstallment: built.installments[0]?.amount ?? 0,
          financedTotal: built.financedTotal,
          hasInterest: built.interestAmount > 0,
        }
      })
  }, [price, plans])

  // Por defecto seleccionamos la opción con más cuotas (la cuota más baja).
  const [selectedCount, setSelectedCount] = useState<number | null>(null)

  if (options.length === 0) return null

  const active =
    options.find((opt) => opt.count === selectedCount) ?? options[options.length - 1]

  return (
    <div
      className={cn(
        'rounded-2xl border border-indigo-200/70 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/20',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
        <CreditCard className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        <span className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>
          Pagá en cuotas
        </span>
      </div>

      {/* Chips de cantidades — envuelven cuando hay muchas */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isActive = opt.count === active.count
          return (
            <button
              key={opt.count}
              type="button"
              onClick={() => setSelectedCount(opt.count)}
              aria-pressed={isActive}
              className={cn(
                'rounded-full font-semibold transition-all',
                compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600'
                  : 'bg-white text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 dark:bg-slate-800/80 dark:text-indigo-300 dark:ring-indigo-800 dark:hover:bg-slate-700',
              )}
            >
              {opt.count}x
            </button>
          )
        })}
      </div>

      {/* Precio destacado de la opción elegida */}
      <div className={compact ? 'mt-2.5' : 'mt-3'}>
        <p
          className={cn(
            'font-bold leading-tight text-indigo-700 dark:text-indigo-200',
            compact ? 'text-lg' : 'text-2xl',
          )}
        >
          {active.count}{' '}
          <span className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
            cuotas de
          </span>{' '}
          {formatPrice(active.perInstallment)}
        </p>
        <p
          className={cn(
            'mt-0.5 text-indigo-600/80 dark:text-indigo-400/80',
            compact ? 'text-[11px]' : 'text-xs',
          )}
        >
          {active.hasInterest
            ? `Total financiado ${formatPrice(active.financedTotal)}`
            : 'Sin interés'}
        </p>
      </div>
    </div>
  )
}
