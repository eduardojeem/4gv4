'use client'

/**
 * RepairCostCalculator
 * 
 * Componente para calcular y mostrar el desglose de costos de una reparación
 * Incluye:
 * - Costo de mano de obra
 * - Costo de repuestos (calculado automáticamente)
 * - Costo final editable
 * - Desglose de IVA y descuentos
 * - Vista previa en tiempo real
 */

import React, { useMemo } from 'react'
import { Calculator, DollarSign, Wrench, Package, Receipt, AlertTriangle, Percent, Sparkles, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { calculateRepairTotal, type RepairCalculationInput } from '@/lib/pos-calculator'
import { useTechnicianCompensation } from '@/hooks/use-technician-compensation'
import { commissionableAmount } from '@/lib/technician/earnings'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

interface RepairPart {
  name: string
  cost: number
  quantity: number
}

/**
 * Qué campo se deja fijo y cuál se deriva. Tres modos, no dos booleans
 * independientes: con dos interruptores por separado se podían activar los
 * dos a la vez y quedaba ambiguo cuál manda.
 *
 * - manual:       los tres campos son independientes (comportamiento original).
 * - labor-from-final: se carga el costo final -> mano de obra = final - repuestos.
 * - final-from-labor: se carga la mano de obra -> costo final = mano de obra + repuestos.
 */
export type CostCalculationMode = 'manual' | 'labor-from-final' | 'final-from-labor'

interface RepairCostCalculatorProps {
  // Costos base
  laborCost: number
  onLaborCostChange: (cost: number) => void

  // Costo final (editable)
  finalCost: number | null
  onFinalCostChange: (cost: number | null) => void

  // Repuestos (calculado automáticamente)
  parts: RepairPart[]

  // Configuración
  taxRate?: number
  pricesIncludeTax?: boolean

  // Estado
  disabled?: boolean
  showBreakdown?: boolean

  // Validación
  error?: string

  // Qué campo se deriva automáticamente. El cálculo en sí vive en el
  // formulario padre (es quien controla laborCost/finalCost); acá solo se
  // muestra el modo activo y se deshabilita el campo que se deriva.
  calculationMode?: CostCalculationMode
  onCalculationModeChange?: (mode: CostCalculationMode) => void

  // Previsualización de comisión del técnico asignado. Requiere permiso
  // (compensación es dato sensible): si `canViewCommission` es false no se
  // pide nada al servidor, para no gastar una llamada que va a rebotar 403.
  technicianId?: string | null
  technicianName?: string | null
  canViewCommission?: boolean
}

export function RepairCostCalculator({
  laborCost,
  onLaborCostChange,
  finalCost,
  onFinalCostChange,
  parts = [],
  taxRate = 10,
  pricesIncludeTax = true,
  disabled = false,
  calculationMode = 'manual',
  onCalculationModeChange,
  technicianId,
  technicianName,
  canViewCommission = false,
  showBreakdown = true,
  error
}: RepairCostCalculatorProps) {
  
  // Calcular costo total de repuestos
  const partsCost = useMemo(() => {
    return parts.reduce((total, part) => total + (part.cost * part.quantity), 0)
  }, [parts])
  
  // Calcular totales usando la calculadora existente
  const calculation = useMemo(() => {
    const input: RepairCalculationInput = {
      laborCost: laborCost || 0,
      partsCost,
      taxRate,
      pricesIncludeTax
    }
    return calculateRepairTotal(input)
  }, [laborCost, partsCost, taxRate, pricesIncludeTax])
  
  // Costo estimado (calculado automáticamente)
  const estimatedCost = calculation.total
  
  // Diferencia entre costo final y estimado
  const costDifference = finalCost !== null ? finalCost - estimatedCost : 0
  const hasCostDifference = Math.abs(costDifference) > 0.01

  const isLaborDerived = calculationMode === 'labor-from-final'
  const isFinalDerived = calculationMode === 'final-from-labor'

  // Si lo que se cobra no alcanza a cubrir los repuestos, la mano de obra
  // derivada daría negativa: se avisa en vez de guardarlo así.
  const autoLaborWouldBeNegative =
    isLaborDerived && finalCost !== null && finalCost - partsCost < 0

  const compensationEnabled = canViewCommission && Boolean(technicianId)
  const { compensation, isLoading: isLoadingCompensation } = useTechnicianCompensation(
    technicianId || '',
    compensationEnabled
  )

  // Reusa la misma fórmula que liquida los sueldos (`computeEarnings` en
  // `lib/technician/earnings.ts`) para que esta previsualización nunca se
  // desalinee de lo que el técnico realmente va a cobrar.
  const commissionPreview = useMemo(() => {
    if (!compensationEnabled || !compensation || compensation.commission_rate <= 0) return null
    const base = commissionableAmount(compensation, {
      labor_cost: laborCost || 0,
      final_cost: finalCost ?? estimatedCost,
    })
    return round2(base * (compensation.commission_rate / 100))
  }, [compensationEnabled, compensation, laborCost, finalCost, estimatedCost])

  return (
    <Card className="shadow-lg border-2 hover:border-primary/30 transition-colors bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20 dark:border-slate-800 dark:hover:border-primary/50">
      <CardHeader className="pb-5 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/30 dark:to-transparent">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 flex items-center justify-center shadow-md">
            <Calculator className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-emerald-700 to-emerald-600 dark:from-emerald-400 dark:to-emerald-500 bg-clip-text text-transparent font-bold">
            Calculadora de Costos
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">

        {/* Selector de modo: qué campo se deriva y cuál se carga a mano.
            Uno solo de los tres botones puede estar activo a la vez, así no
            hay ambigüedad sobre quién manda cuando dos valores podrían
            derivarse entre sí. */}
        {onCalculationModeChange && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Cálculo automático
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  { mode: 'manual' as const, label: 'Manual', hint: 'Cargás los tres a mano' },
                  { mode: 'labor-from-final' as const, label: 'Mano de obra = Total − Repuestos', hint: 'Cargás repuestos + total' },
                  { mode: 'final-from-labor' as const, label: 'Total = Mano de obra + Repuestos', hint: 'Cargás repuestos + mano de obra' },
                ]
              ).map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => onCalculationModeChange(option.mode)}
                  disabled={disabled}
                  className={cn(
                    'rounded-lg border-2 p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    calculationMode === option.mode
                      ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                      : 'border-transparent bg-muted/40 hover:bg-muted/70'
                  )}
                >
                  <p className={cn(
                    'text-xs font-semibold',
                    calculationMode === option.mode ? 'text-emerald-800 dark:text-emerald-300' : 'text-foreground'
                  )}>
                    {option.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{option.hint}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Costos Base */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Costo de Mano de Obra */}
          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/30 border-2 border-blue-200 dark:border-blue-900/50">
            <Label className="text-sm font-semibold flex items-center gap-2 text-blue-900 dark:text-blue-300">
              <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Costo de Mano de Obra
              {isLaborDerived && <Lock className="h-3 w-3 text-blue-500 dark:text-blue-400" />}
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={laborCost || ''}
                onChange={(e) => onLaborCostChange(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="pl-11 h-14 text-lg font-semibold border-blue-300 dark:border-blue-800 focus:border-blue-500 dark:focus:border-blue-600 bg-white dark:bg-slate-900 disabled:opacity-80"
                disabled={disabled || isLaborDerived}
              />
            </div>
            {isLaborDerived && (
              <p className="text-[11px] text-blue-700 dark:text-blue-400">
                = Costo final − Repuestos. Se recalcula solo al cambiar cualquiera de los dos.
              </p>
            )}
            {autoLaborWouldBeNegative && (
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                El costo final no cubre los repuestos: la mano de obra quedaría en negativo.
              </p>
            )}
          </div>

          {/* Costo de Repuestos (Solo lectura) */}
          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/30 border-2 border-green-200 dark:border-green-900/50">
            <Label className="text-sm font-semibold flex items-center gap-2 text-green-900 dark:text-green-300">
              <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
              Costo de Repuestos
              <Badge variant="secondary" className="text-xs bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-300">
                {parts.length} {parts.length === 1 ? 'item' : 'items'}
              </Badge>
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3.5 h-5 w-5 text-green-600 dark:text-green-400" />
              <Input
                type="text"
                value={formatCurrency(partsCost)}
                className="pl-11 h-14 text-lg font-semibold bg-white dark:bg-slate-900 border-green-300 dark:border-green-800"
                disabled
                readOnly
              />
            </div>
            {parts.length > 0 && (
              <div className="text-xs text-green-800 dark:text-green-300 space-y-1 bg-white/60 dark:bg-slate-900/60 rounded-lg p-2 border border-green-200 dark:border-green-900">
                {parts.map((part, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="font-medium">{part.name} (x{part.quantity})</span>
                    <span className="font-semibold">{formatCurrency(part.cost * part.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <Separator />
        
        {/* Desglose de Cálculo */}
        {showBreakdown && (
          <div className="space-y-4">
            <h4 className="font-semibold text-base flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
              <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Desglose Automático
            </h4>
            
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-xl p-5 space-y-4 border-2 border-emerald-200 dark:border-emerald-900/50 shadow-inner">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-900">
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium">Subtotal (sin IVA):</span>
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">{formatCurrency(calculation.subtotal)}</span>
                </div>
                <div className="flex justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-900">
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium">IVA ({taxRate}%):</span>
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">{formatCurrency(calculation.taxAmount)}</span>
                </div>
              </div>
              
              <Separator className="bg-emerald-300 dark:bg-emerald-800" />
              
              <div className="flex justify-between font-bold p-4 bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 rounded-lg text-white shadow-md">
                <span className="text-lg">Total Estimado:</span>
                <span className="text-2xl">{formatCurrency(estimatedCost)}</span>
              </div>
            </div>
          </div>
        )}
        
        <Separator />
        
        {/* Costo Final */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Costo Final de la Reparación
              {isFinalDerived && <Lock className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />}
            </Label>
            {finalCost !== null && !isFinalDerived && (
              <button
                type="button"
                onClick={() => onFinalCostChange(null)}
                className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-medium hover:underline"
                disabled={disabled}
              >
                Usar costo estimado
              </button>
            )}
          </div>

          <div className="relative">
            <DollarSign className="absolute left-4 top-4 h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <Input
              type="number"
              step="0.01"
              min="0"
              value={finalCost ?? ''}
              onChange={(e) => {
                const value = e.target.value
                onFinalCostChange(value === '' ? null : parseFloat(value) || 0)
              }}
              placeholder={`${formatCurrency(estimatedCost)} (estimado)`}
              className={`pl-14 h-16 text-xl font-bold border-2 disabled:opacity-80 ${
                hasCostDifference
                  ? costDifference > 0
                    ? 'border-orange-400 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/30 text-orange-900 dark:text-orange-200'
                    : 'border-green-400 dark:border-green-700 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/30 text-green-900 dark:text-green-200'
                  : 'border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900'
              } ${error ? 'border-red-500 dark:border-red-700' : ''}`}
              disabled={disabled || isFinalDerived}
            />
          </div>
          {isFinalDerived && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
              = Mano de obra + Repuestos. Se recalcula solo al cambiar cualquiera de los dos.
            </p>
          )}

          {/* Diferencia de Costo */}
          {hasCostDifference && finalCost !== null && (
            <div className={`flex items-center gap-3 text-sm p-4 rounded-xl border-2 shadow-md ${
              costDifference > 0 
                ? 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-800' 
                : 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-800'
            }`}>
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">
                {costDifference > 0 ? '📈 Incremento' : '📉 Descuento'} de{' '}
                <strong className="text-lg">{formatCurrency(Math.abs(costDifference))}</strong>
                {' '}respecto al costo estimado
              </span>
            </div>
          )}
          
          {/* Error de validación */}
          {error && (
            <div className="flex items-center gap-3 text-sm text-red-700 dark:text-red-300 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/40 dark:to-red-900/30 p-4 rounded-xl border-2 border-red-300 dark:border-red-800 shadow-md">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Comisión del técnico: solo visible para quien puede ver compensación
              (dato sensible) y solo si el técnico asignado tiene % configurado. */}
          {compensationEnabled && isLoadingCompensation && (
            <div className="text-xs text-muted-foreground p-3 rounded-lg border border-dashed">
              Calculando comisión del técnico...
            </div>
          )}
          {commissionPreview !== null && (
            <div className="p-4 rounded-xl border-2 border-violet-200 dark:border-violet-900/50 bg-gradient-to-r from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/30 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-600 dark:bg-violet-700 flex items-center justify-center shrink-0">
                    <Percent className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-violet-900 dark:text-violet-300">
                      Comisión estimada{technicianName ? ` — ${technicianName}` : ''}
                    </p>
                    <p className="text-xs text-violet-700 dark:text-violet-400">
                      {compensation.commission_rate}% sobre{' '}
                      {compensation.commission_base === 'labor' ? 'mano de obra' : 'costo final'}
                    </p>
                  </div>
                </div>
                <span className="text-xl font-bold text-violet-900 dark:text-violet-200">
                  {formatCurrency(commissionPreview)}
                </span>
              </div>
              {/* La comisión recién se liquida cuando la reparación llega al
                  estado configurado (`accrual_status`): mostrarla sin esta
                  aclaración se podía leer como "ya ganado", incluso en una
                  reparación que todavía ni se diagnosticó. */}
              <p className="mt-2.5 pt-2.5 border-t border-violet-200/60 dark:border-violet-800/40 text-[11px] text-violet-700/80 dark:text-violet-400/80">
                Se liquida recién cuando la reparación llegue a{' '}
                <strong>{compensation.accrual_status === 'entregado' ? 'entregado' : 'lista o entregada'}</strong>
                . Por ahora es solo una proyección.
              </p>
            </div>
          )}

          {/* Información adicional */}
          <div className="text-xs text-emerald-700 dark:text-emerald-300 space-y-2 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-lg p-4 border border-emerald-200 dark:border-emerald-900">
            <p className="flex items-start gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">•</span>
              <span>Si no especificas un costo final, se usará el costo estimado automáticamente</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">•</span>
              <span>El costo final es lo que se cobrará al cliente</span>
            </p>
            {pricesIncludeTax && (
              <p className="flex items-start gap-2">
                <span className="text-emerald-600 dark:text-emerald-400">•</span>
                <span>Los precios incluyen IVA del {taxRate}%</span>
              </p>
            )}
          </div>
        </div>
        
      </CardContent>
    </Card>
  )
}