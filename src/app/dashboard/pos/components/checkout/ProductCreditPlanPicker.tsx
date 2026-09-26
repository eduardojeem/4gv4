import { CheckCircle2, ChevronDown, CreditCard, Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'
import { cn } from '@/lib/utils'

import type { CreditPlanSuggestion } from '../../contexts/CheckoutContext'
import { getProductCreditAllocation, type CartProductCreditPlan } from '../../lib/cart-credit-plans'

interface ProductCreditPlanPickerProps {
  cartTotal: number
  plans: CartProductCreditPlan[]
  selectedPlan: CreditPlanSuggestion | null
  onSelect: (plan: CartProductCreditPlan) => void
  formatCurrency: (amount: number) => string
}

function CreditGuideContent() {
  return (
    <ul className="space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
      <li><strong className="font-medium text-foreground">Monto financiado:</strong> Solo se financia el producto asociado al plan seleccionado.</li>
      <li><strong className="font-medium text-foreground">Pago inmediato:</strong> Los demás productos se pagan en el momento, por efectivo, tarjeta o transferencia.</li>
      <li><strong className="font-medium text-foreground">Cuotas e interés:</strong> Se calculan sobre el monto financiado y se muestra el total antes de confirmar.</li>
      <li><strong className="font-medium text-foreground">Cliente:</strong> Debe tener una línea de crédito suficiente para cubrir el total financiado.</li>
      <li><strong className="font-medium text-foreground">Cambios manuales:</strong> Si modificás las condiciones, el sistema señalará que el plan original fue ajustado.</li>
    </ul>
  )
}

export function ProductCreditPlanPicker({
  cartTotal,
  plans,
  selectedPlan,
  onSelect,
  formatCurrency,
}: ProductCreditPlanPickerProps) {
  if (plans.length === 0) return null

  return (
    <section className="mt-3 rounded-lg border border-sky-500/25 bg-sky-500/5 p-2.5" aria-labelledby="cart-credit-plans-title">
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-sky-700 dark:text-sky-300">
          <CreditCard className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h4 id="cart-credit-plans-title" className="text-xs font-semibold">Planes disponibles en el carrito</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{plans.length} planes · Financiá el producto elegido; el resto se paga ahora.</p>
        </div>
      </div>

      <div role="region" aria-label="Lista de planes de crédito" tabIndex={0} className="grid max-h-56 gap-1.5 overflow-y-auto overscroll-contain p-1 sm:grid-cols-2 [scrollbar-gutter:stable] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {plans.map(plan => {
          const allocation = getProductCreditAllocation(plan, cartTotal)
          const calculation = buildCreditInstallmentPlan({
            principalAmount: allocation.financedPrincipal,
            interestRate: plan.interestRate,
            installmentCount: plan.count,
            frequency: plan.frequency,
          })
          const isSelected = Boolean(selectedPlan
            && selectedPlan.productId === plan.productId
            && selectedPlan.count === plan.count
            && selectedPlan.interestRate === plan.interestRate)

          return (
            <Button
              key={`${plan.productId}:${plan.count}:${plan.interestRate}`}
              type="button"
              variant="outline"
              aria-label={`Elegir ${plan.count} cuotas de ${plan.productName}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(plan)}
              className={cn(
                'h-auto min-h-11 min-w-0 items-start justify-start gap-1.5 whitespace-normal px-2 py-2 text-left',
                isSelected && 'border-sky-600 bg-sky-500/10 ring-1 ring-sky-600/30',
              )}
            >
              <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', isSelected ? 'text-sky-600' : 'text-muted-foreground/50')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-muted-foreground" title={plan.productName}>{plan.productName}</span>
                <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-xs font-semibold">{plan.count} cuotas</span>
                  <span className="text-xs font-medium text-sky-700 dark:text-sky-300">
                    {formatCurrency(calculation.installments[0]?.amount ?? 0)}/mes
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {plan.interestRate === 0 ? 'Sin interés' : `Interés ${plan.interestRate}%`} · Total {formatCurrency(calculation.financedTotal)}
                </span>
                {allocation.dueNow > 0 && (
                  <span className="mt-0.5 block text-xs font-medium text-amber-700 dark:text-amber-300">
                    Financia {formatCurrency(allocation.financedPrincipal)} · Pagar ahora {formatCurrency(allocation.dueNow)}
                  </span>
                )}
              </span>
            </Button>
          )
        })}
      </div>

      <details className="group mt-2 rounded-md border bg-background/70">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-2 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-sky-700 dark:text-sky-300" aria-hidden="true" />
            ¿Cómo funcionan los créditos?
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t px-3 py-2.5">
          <CreditGuideContent />
        </div>
      </details>

    </section>
  )
}
