
import React from 'react'
import { Clock, AlertCircle, Calendar } from 'lucide-react'
import { formatCurrency as defaultFormatCurrency } from '@/lib/currency'

interface CreditStatusPanelProps {
  cartTotal: number
  creditSummary: {
    availableCredit: number
    usedCredit: number
  }
  formatCurrency?: (amount: number) => string
}

export function CreditStatusPanel({
  cartTotal,
  creditSummary,
  formatCurrency = defaultFormatCurrency
}: CreditStatusPanelProps) {
  const totalCredit = creditSummary.availableCredit + creditSummary.usedCredit
  const newBalance = creditSummary.usedCredit + cartTotal
  const remainingCredit = Math.max(0, creditSummary.availableCredit - cartTotal)
  const utilizationPercentage = totalCredit > 0 ? (newBalance / totalCredit) * 100 : 0
  const isNearLimit = utilizationPercentage > 80

  return (
    <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 text-blue-900 dark:text-blue-100 mb-3">
        <div className="h-8 w-8 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center">
          <Clock className="h-4 w-4 text-blue-700 dark:text-blue-300" />
        </div>
        <span className="font-semibold text-base">Venta a Crédito</span>
      </div>
      
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
        
        {/* Información de cuotas */}
        <div className="mt-3 p-2.5 bg-white/50 dark:bg-gray-900/30 rounded-md border border-blue-200/50 dark:border-blue-800/50">
          <div className="flex items-center gap-2 mb-1.5">
            <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Condiciones:</span>
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-0.5">
            <div className="flex justify-between">
              <span>• Registro en cuenta corriente</span>
              <span className="font-semibold">{formatCurrency(cartTotal)}</span>
            </div>
            <div className="text-[10px] text-blue-500 dark:text-blue-500 mt-1">
              Sin intereses • Vencimiento a 30 días
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
