
import React from 'react'
import { Clock, AlertCircle, Calendar } from 'lucide-react'
import { formatCurrency as defaultFormatCurrency } from '@/lib/currency'
import { buildPosCreditSummary, type PosCreditTerms } from '@/lib/credits/pos-credit-summary'
import { FirstInstallmentSelector } from './FirstInstallmentSelector'
import type { CreditPlanSuggestion } from '../../contexts/CheckoutContext'

export type CreditFrequency = 'weekly' | 'biweekly' | 'monthly'

export type CreditTerms = PosCreditTerms

interface CreditStatusPanelProps {
  cartTotal: number
  creditSummary: {
    availableCredit: number
    usedCredit: number
  }
  terms: CreditTerms
  onTermsChange: (terms: CreditTerms) => void
  formatCurrency?: (amount: number) => string
  suggestion?: CreditPlanSuggestion | null
}

export function CreditStatusPanel({
  cartTotal,
  creditSummary,
  terms,
  onTermsChange,
  formatCurrency = defaultFormatCurrency,
  suggestion = null,
}: CreditStatusPanelProps) {
  const installmentCount = Math.max(1, terms.count || 1)
  const creditPlan = React.useMemo(() => buildPosCreditSummary(cartTotal, terms), [cartTotal, terms])
  const estimatedInstallment = creditPlan.installments[0]?.amount ?? 0
  const frequencyLabel: Record<CreditFrequency, string> = { weekly: 'semanal', biweekly: 'quincenal', monthly: 'mensual' }
  const totalCredit = creditSummary.availableCredit + creditSummary.usedCredit
  const newBalance = creditSummary.usedCredit + creditPlan.financedTotal
  const remainingCredit = Math.max(0, creditSummary.availableCredit - creditPlan.financedTotal)
  const utilizationPercentage = totalCredit > 0 ? (newBalance / totalCredit) * 100 : 0
  const isNearLimit = utilizationPercentage > 80
  const suggestionWasAdjusted = Boolean(suggestion && (
    suggestion.count !== terms.count
    || suggestion.interestRate !== terms.interestRate
    || suggestion.frequency !== terms.frequency
  ))

  return (
    <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 text-blue-900 dark:text-blue-100 mb-3">
        <div className="h-8 w-8 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center">
          <Clock className="h-4 w-4 text-blue-700 dark:text-blue-300" />
        </div>
        <span className="font-semibold text-base">Venta a Crédito</span>
      </div>
      {suggestion && (
        <div className="mb-3 rounded-md border border-blue-300/60 bg-white/60 p-2 text-xs text-blue-900 dark:border-blue-700 dark:bg-slate-950/30 dark:text-blue-100">
          <p className="font-semibold">Plan sugerido por {suggestion.productName}</p>
          <p className="mt-0.5 text-[11px] text-blue-700 dark:text-blue-300">
            Estas condiciones se aplican al total financiado del ticket.
          </p>
          {suggestionWasAdjusted && (
            <p className="mt-1 font-medium text-amber-700 dark:text-amber-300">
              Condiciones ajustadas manualmente
            </p>
          )}
        </div>
      )}
      
      <div className="space-y-2.5">
        {/* Total de la venta */}
        <div className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-900/30 rounded-md">
          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Total de la venta:</span>
          <span className="text-base font-bold text-blue-900 dark:text-blue-100">{formatCurrency(cartTotal)}</span>
        </div>
        
        {/* Límite de crédito total */}
        <div className="flex items-center justify-between p-2 bg-white/40 dark:bg-gray-900/20 rounded-md">
          <span className="text-xs text-blue-600 dark:text-blue-400">Límite de crédito:</span>
          <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            {formatCurrency(totalCredit)}
          </span>
        </div>
        
        {/* Crédito usado actual */}
        <div className="flex items-center justify-between p-2 bg-white/40 dark:bg-gray-900/20 rounded-md">
          <span className="text-xs text-blue-600 dark:text-blue-400">Crédito usado:</span>
          <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
            {formatCurrency(creditSummary.usedCredit)}
          </span>
        </div>
        
        {/* Crédito disponible */}
        <div className="flex items-center justify-between p-2 bg-white/60 dark:bg-gray-900/30 rounded-md border border-blue-300/50 dark:border-blue-700/50">
          <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">Crédito disponible:</span>
          <span className="text-base font-bold text-green-600 dark:text-green-400">
            {formatCurrency(creditSummary.availableCredit)}
          </span>
        </div>
        
        {/* Separador */}
        <div className="border-t border-blue-300/30 dark:border-blue-700/30 my-2"></div>
        
        {/* Nuevo saldo después de la venta */}
        <div className="flex items-center justify-between p-2.5 bg-blue-200/40 dark:bg-blue-900/40 rounded-md border border-blue-300 dark:border-blue-700">
          <span className="text-sm text-blue-800 dark:text-blue-200 font-semibold">Nuevo saldo:</span>
          <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
            {formatCurrency(newBalance)}
          </span>
        </div>
        
        {/* Crédito restante después de la venta */}
        <div className="flex items-center justify-between p-2 bg-white/40 dark:bg-gray-900/20 rounded-md">
          <span className="text-xs text-blue-600 dark:text-blue-400">Crédito restante:</span>
          <span className={`text-sm font-semibold ${
            remainingCredit > 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(remainingCredit)}
          </span>
        </div>
        
        {/* Utilización del crédito */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-blue-600 dark:text-blue-400">Utilización del crédito:</span>
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">
              {utilizationPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-blue-200/30 dark:bg-blue-900/30 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                utilizationPercentage > 80
                  ? 'bg-gradient-to-r from-orange-500 to-red-500'
                  : utilizationPercentage > 50
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-r from-green-500 to-blue-500'
              }`}
              style={{ 
                width: `${Math.min(100, utilizationPercentage)}%` 
              }}
            />
          </div>
        </div>
        
        {/* Advertencia si está cerca del límite */}
        {isNearLimit && (
          <div className="mt-3 p-2 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-md flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-orange-800 dark:text-orange-200">
              El cliente estará cerca del límite de crédito después de esta venta.
            </p>
          </div>
        )}
        
        {/* Condiciones de pago configurables */}
        <div className="mt-3 p-2.5 bg-white/50 dark:bg-gray-900/30 rounded-md border border-blue-200/50 dark:border-blue-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Condiciones de pago</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-blue-600 dark:text-blue-400">Cuotas</span>
              <input
                type="number" min={1} max={60} value={terms.count}
                onChange={e => onTermsChange({ ...terms, count: Math.min(60, Math.max(1, Number(e.target.value) || 1)) })}
                className="h-8 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 px-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-blue-600 dark:text-blue-400">Frecuencia</span>
              <select
                value={terms.frequency}
                onChange={e => onTermsChange({ ...terms, frequency: e.target.value as CreditFrequency })}
                className="h-8 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 px-2 text-sm"
              >
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-blue-600 dark:text-blue-400">Interés %</span>
              <input
                type="number" min={0} step="0.1" value={terms.interestRate}
                onChange={e => onTermsChange({ ...terms, interestRate: Math.max(0, Number(e.target.value) || 0) })}
                className="h-8 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 px-2 text-sm"
              />
            </label>
          </div>
          <FirstInstallmentSelector value={terms.firstInstallmentTiming ?? 'at_start'} onChange={value => onTermsChange({ ...terms, firstInstallmentTiming: value, firstPayment: value === 'next_cycle' ? undefined : terms.firstPayment })} frequency={terms.frequency} />
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400">Interes</p>
                <p className="text-sm font-semibold">{formatCurrency(creditPlan.interestAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400">Total financiado</p>
                <p className="text-sm font-semibold">{formatCurrency(creditPlan.financedTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400">Monto por cuota</p>
                <p className="text-sm font-semibold">{formatCurrency(estimatedInstallment)}</p>
              </div>
            </div>
            <div className="mt-3 max-h-28 overflow-y-auto rounded-md border border-blue-200/80 bg-white/70 text-[11px] dark:border-blue-800/80 dark:bg-slate-950/30">
              {creditPlan.installments.slice(0, 6).map((installment) => (
                <div key={installment.number} className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-blue-100 px-2 py-1.5 last:border-b-0 dark:border-blue-900">
                  <span>Cuota {installment.number}</span>
                  <span>{installment.dueDate.split('-').reverse().join('/')}</span>
                  <span className="font-semibold">{formatCurrency(installment.amount)}</span>
                </div>
              ))}
              {creditPlan.installments.length > 6 && (
                <div className="px-2 py-1.5 text-center text-blue-700 dark:text-blue-300">
                  +{creditPlan.installments.length - 6} cuotas mas
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-blue-700 dark:text-blue-300">
            <span>{installmentCount} cuota{installmentCount === 1 ? '' : 's'} {frequencyLabel[terms.frequency]}</span>
            <span className="font-semibold">≈ {formatCurrency(estimatedInstallment)} c/u</span>
          </div>
        </div>
      </div>
    </div>
  )
}
