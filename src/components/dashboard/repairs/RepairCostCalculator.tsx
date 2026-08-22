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
import { formatCurrency, formatThousands, parseThousands } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { calculateRepairTotal, type RepairCalculationInput } from '@/lib/pos-calculator'
import { calculateRepairPricing, type RepairPricingMode } from '@/lib/repairs/pricing'
import { getCurrencyFractionDigits } from '@/lib/currency'
import { useTechnicianCompensation } from '@/hooks/use-technician-compensation'
import { commissionableAmount } from '@/lib/technician/earnings'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

interface RepairPart {
  name: string
  cost: number
  internalCost?: number
  quantity: number
}

/**
 * Qué campo se deja fijo y cuál se deriva. Tres modos, no dos booleans
 * independientes: con dos interruptores por separado se podían activar los
 * dos a la vez y quedaba ambiguo cuál manda.
 *
 * - automatic: el total se deriva de mano de obra, repuestos y descuento.
 * - budget: el presupuesto fija el total y deriva la mano de obra.
 * - manual: permite ajustar ambos importes con permisos y motivo de auditoria.
 */
export type CostCalculationMode = RepairPricingMode

interface RepairCostCalculatorProps {
  // Costos base
  laborCost: number
  onLaborCostChange: (cost: number) => void

  // Costo final (editable)
  finalCost: number | null
  onFinalCostChange: (cost: number | null) => void
  discountAmount?: number
  onDiscountAmountChange?: (amount: number) => void
  paidAmount?: number
  currency?: string
  canUseManual?: boolean
  overrideReason?: string
  onOverrideReasonChange?: (reason: string) => void

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
  discountAmount = 0,
  onDiscountAmountChange,
  paidAmount = 0,
  currency = 'PYG',
  canUseManual = false,
  overrideReason = '',
  onOverrideReasonChange,
  parts = [],
  taxRate = 10,
  pricesIncludeTax = true,
  disabled = false,
  calculationMode = 'automatic',
  onCalculationModeChange,
  technicianId,
  technicianName,
  canViewCommission = false,
  showBreakdown = true,
  error
}: RepairCostCalculatorProps) {
  
  const pricing = useMemo(() => calculateRepairPricing({
    mode: calculationMode,
    currency,
    laborCost,
    finalCost,
    discountAmount,
    paidAmount,
    parts,
  }), [calculationMode, currency, laborCost, finalCost, discountAmount, paidAmount, parts])
  const partsCost = pricing.partsPrice
  
  // Calcular totales usando la calculadora existente
  const calculation = useMemo(() => {
    const input: RepairCalculationInput = {
      laborCost: laborCost || 0,
      partsCost,
      taxRate,
      pricesIncludeTax,
      discountAmount,
    }
    return calculateRepairTotal(input)
  }, [laborCost, partsCost, taxRate, pricesIncludeTax, discountAmount])
  
  // Costo estimado (calculado automáticamente)
  const estimatedCost = pricing.estimatedTotal
  
  // Diferencia entre costo final y estimado
  const costDifference = finalCost !== null ? finalCost - estimatedCost : 0
  const hasCostDifference = Math.abs(costDifference) > 0.01

  const isLaborDerived = calculationMode === 'budget'
  const isFinalDerived = calculationMode === 'automatic'

  // Si lo que se cobra no alcanza a cubrir los repuestos, la mano de obra
  // derivada daría negativa: se avisa en vez de guardarlo así.
  const autoLaborWouldBeNegative =
    isLaborDerived && finalCost !== null && finalCost + discountAmount - partsCost < 0

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

  const handleLaborInputChange = (rawValue: string) => {
    const nextLaborCost = rawValue === '' ? 0 : Number(rawValue) || 0
    onLaborCostChange(nextLaborCost)

    if (calculationMode === 'automatic') {
      const nextPricing = calculateRepairPricing({
        mode: 'automatic',
        currency,
        laborCost: nextLaborCost,
        discountAmount,
        paidAmount,
        parts,
      })
      onFinalCostChange(nextPricing.customerTotal)
    }
  }

  const handleFinalCostInputChange = (rawValue: string) => {
    const nextFinalCost = rawValue === '' ? null : Number(rawValue) || 0
    onFinalCostChange(nextFinalCost)

    if (calculationMode === 'budget') {
      const nextPricing = calculateRepairPricing({
        mode: 'budget',
        currency,
        laborCost,
        finalCost: nextFinalCost,
        discountAmount,
        paidAmount,
        parts,
      })
      onLaborCostChange(nextPricing.laborCost)
    }
  }

  const handleCalculationModeChange = (nextMode: CostCalculationMode) => {
    if (!onCalculationModeChange || nextMode === calculationMode) return

    onCalculationModeChange(nextMode)

    if (nextMode === 'budget') {
      // Un presupuesto debe ser ingresado expresamente. Reutilizar el total
      // automatico anterior lo registraba como acordado sin intervencion.
      onFinalCostChange(null)
      onLaborCostChange(0)
      return
    }

    if (nextMode === 'automatic') {
      const nextPricing = calculateRepairPricing({
        mode: 'automatic',
        currency,
        laborCost,
        discountAmount,
        paidAmount,
        parts,
      })
      onFinalCostChange(nextPricing.customerTotal)
    }
  }

  return (
    <Card className="border shadow-sm" data-help-id="repair-pricing">
      <CardHeader className="border-b bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold">Calculadora de costos</span>
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">Define lo que se cobra y revisa el desglose antes de guardar.</p>
          </div>
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
            <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', canUseManual && 'lg:grid-cols-3')}>
              {(
                [
                  { mode: 'automatic' as const, label: 'Calcular total', hint: 'Mano de obra + repuestos - descuento' },
                  { mode: 'budget' as const, label: 'Usar presupuesto', hint: 'El total acordado define la mano de obra' },
                  ...(canUseManual
                    ? [{ mode: 'manual' as const, label: 'Manual avanzado', hint: 'Administrador define ambos valores' }]
                    : []),
                ]
              ).map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => handleCalculationModeChange(option.mode)}
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

        {onDiscountAmountChange && (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="repair-discount" className="text-xs font-bold text-foreground">
                Descuento Comercial
              </Label>
              <div className="flex items-center gap-1">
                {[5, 10, 15, 20].map((pct) => {
                  const base = isLaborDerived && finalCost ? finalCost : (laborCost + partsCost)
                  const calculatedDiscount = Math.round(base * (pct / 100))
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => onDiscountAmountChange(calculatedDiscount)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition-colors"
                      title={`Aplicar ${pct}% de descuento`}
                    >
                      {pct}%
                    </button>
                  )
                })}
                {discountAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => onDiscountAmountChange(0)}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₲</span>
                  <Input
                    id="repair-discount"
                    type="text"
                    inputMode="numeric"
                    value={formatThousands(discountAmount)}
                    onChange={(event) => onDiscountAmountChange(parseThousands(event.target.value))}
                    disabled={disabled}
                    placeholder="0"
                    className="pl-7 font-bold font-mono"
                  />
                </div>
                {discountAmount > 0 && (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Descuento: {formatCurrency(discountAmount)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border bg-background p-2.5">
                  <p className="text-[10px] text-muted-foreground font-semibold">Seña / Pagado</p>
                  <p className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">{formatCurrency(pricing.paidAmount)}</p>
                </div>
                <div className="rounded-lg border bg-background p-2.5">
                  <p className="text-[10px] text-muted-foreground font-semibold">Saldo a Cobrar</p>
                  <p className={cn("mt-0.5 font-bold tabular-nums", pricing.balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                    {formatCurrency(pricing.balance)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Costos Base */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* Costo de Mano de Obra */}
          <div className="space-y-3 rounded-xl border bg-background p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-bold">
                <Wrench className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                Mano de obra
                {isLaborDerived && <Lock className="h-3 w-3 text-cyan-500 dark:text-cyan-400" />}
              </Label>
              <Badge variant={isLaborDerived ? "outline" : "secondary"} className="text-[10px] py-0 font-semibold">
                {isLaborDerived ? 'Derivada de presupuesto' : 'Fijada manualmente'}
              </Badge>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-base font-bold text-cyan-600 dark:text-cyan-400">₲</span>
              <Input
                type="text"
                inputMode="numeric"
                value={formatThousands(laborCost)}
                onChange={(e) => handleLaborInputChange(parseThousands(e.target.value).toString())}
                placeholder="0"
                className="h-12 pl-9 text-lg font-bold font-mono disabled:opacity-80 rounded-xl"
                disabled={disabled || isLaborDerived}
              />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Mano de obra técnica:</span>
              <strong className="text-cyan-700 dark:text-cyan-300 font-bold tabular-nums">
                {laborCost > 0 ? `Gs. ${formatCurrency(laborCost)}` : 'Sin asignar'}
              </strong>
            </div>
            {isLaborDerived && (
              <div className="p-2 rounded-lg bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 text-[11px] text-cyan-800 dark:text-cyan-300">
                <span>Total ({formatCurrency(finalCost || 0)}) - Repuestos ({formatCurrency(partsCost)}) = <strong>{formatCurrency(laborCost)}</strong></span>
              </div>
            )}
            {autoLaborWouldBeNegative && (
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                El costo final no cubre los repuestos: la mano de obra quedaría en negativo.
              </p>
            )}
          </div>

          {/* Precio de repuestos (solo lectura) */}
          <div className="space-y-3 rounded-xl border bg-background p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-bold">
                <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Precio de repuestos
              </Label>
              <Badge variant="secondary" className="text-[10px] py-0 font-semibold">
                {parts.length} {parts.length === 1 ? 'ítem' : 'ítems'}
              </Badge>
            </div>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <Input
                type="text"
                value={formatCurrency(partsCost)}
                className="h-12 pl-11 text-lg font-bold rounded-xl"
                disabled
                readOnly
              />
            </div>
            {parts.length > 0 ? (
              <div className="space-y-1 rounded-lg border bg-muted/20 p-2 text-xs max-h-[90px] overflow-y-auto">
                {parts.map((part, index) => (
                  <div key={index} className="flex justify-between text-[11px]">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{part.name} (x{part.quantity})</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(part.cost * part.quantity)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">Sin repuestos agregados a la orden.</p>
            )}
          </div>
        </div>
        
        <Separator />
        
        {/* Desglose de Cálculo */}
        {showBreakdown && (
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="h-5 w-5 text-primary" />
              Desglose automático
            </h4>
            
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between rounded-md border bg-background p-3">
                  <span className="font-medium text-muted-foreground">Subtotal (sin IVA):</span>
                  <span className="font-bold">{formatCurrency(calculation.subtotal)}</span>
                </div>
                <div className="flex justify-between rounded-md border bg-background p-3">
                  <span className="font-medium text-muted-foreground">IVA ({taxRate}%):</span>
                  <span className="font-bold">{formatCurrency(calculation.taxAmount)}</span>
                </div>
              </div>
              
              <Separator className="bg-emerald-300 dark:bg-emerald-800" />
              
              <div className="flex items-center justify-between rounded-md bg-primary p-4 font-bold text-primary-foreground">
                <span className="text-base sm:text-lg">Total estimado:</span>
                <span className="text-xl sm:text-2xl">{formatCurrency(estimatedCost)}</span>
              </div>
            </div>
          </div>
        )}
        
        <Separator />
        
        {/* Total de la Reparación */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold flex items-center gap-2 text-emerald-900 dark:text-emerald-300">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Total de la Reparación
              {isFinalDerived && <Lock className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />}
            </Label>
            {finalCost !== null && calculationMode === 'manual' && (
              <button
                type="button"
                onClick={() => onFinalCostChange(null)}
                className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-medium hover:underline"
                disabled={disabled}
              >
                Restablecer al estimado
              </button>
            )}
          </div>

          <div className="relative">
            <span className="absolute left-4 top-4 text-xl font-bold text-emerald-600 dark:text-emerald-400">₲</span>
            <Input
              type="text"
              inputMode="numeric"
              value={formatThousands(finalCost)}
              onChange={(e) => handleFinalCostInputChange(parseThousands(e.target.value).toString())}
              placeholder={`${formatCurrency(estimatedCost)} (estimado)`}
              className={`pl-12 h-16 text-xl font-bold font-mono border-2 disabled:opacity-80 rounded-2xl ${
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
              = Mano de obra + repuestos - descuento.
            </p>
          )}
          {isLaborDerived && finalCost === null && (
            <p className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
              Ingresá el total acordado para calcular la mano de obra.
            </p>
          )}

          {(discountAmount > 0 || (calculationMode === 'manual' && pricing.customerTotal < pricing.partsPrice)) && onOverrideReasonChange && (
            <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="repair-price-override" className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Motivo del ajuste o descuento
                </Label>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  'Descuento cliente frecuente',
                  'Ajuste acordado con cliente',
                  'Garantía previa / Reingreso',
                  'Promoción especial vigente',
                ].map((reasonChip) => (
                  <button
                    key={reasonChip}
                    type="button"
                    onClick={() => onOverrideReasonChange(reasonChip)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 transition-colors border border-amber-200 dark:border-amber-700/60"
                  >
                    {reasonChip}
                  </button>
                ))}
              </div>
              <Input
                id="repair-price-override"
                value={overrideReason}
                onChange={(event) => onOverrideReasonChange(event.target.value)}
                placeholder="O escribe el motivo de la excepción..."
                maxLength={300}
                disabled={disabled}
                className="text-xs bg-white dark:bg-slate-900"
              />
              <p className="text-[11px] text-amber-800 dark:text-amber-300">Obligatorio para auditar descuentos y excepciones de precio.</p>
            </div>
          )}

          {canViewCommission && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3 text-sm">
              <div><p className="text-xs text-muted-foreground font-medium">Costo base compra repuestos</p><p className="font-bold">{formatCurrency(pricing.partsInternalCost)}</p></div>
              <div><p className="text-xs text-muted-foreground font-medium">Margen bruto proyectado</p><p className={cn('font-bold', pricing.margin < 0 ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400')}>{formatCurrency(pricing.margin)}</p></div>
            </div>
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
            <div className="p-4 rounded-xl border-2 border-violet-200 dark:border-violet-900/50 bg-gradient-to-r from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/30 shadow-md space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-600 dark:bg-violet-700 flex items-center justify-center shrink-0">
                    <Percent className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-violet-900 dark:text-violet-300">
                      Comisión del técnico{technicianName ? ` — ${technicianName}` : ''}
                    </p>
                    <p className="text-xs text-violet-700 dark:text-violet-400">
                      {compensation.commission_rate}% sobre{' '}
                      <strong>{compensation.commission_base === 'labor' ? `Mano de Obra (${formatCurrency(laborCost || 0)})` : `Total (${formatCurrency(finalCost ?? estimatedCost)})`}</strong>
                    </p>
                  </div>
                </div>
                <span className="text-xl font-bold text-violet-900 dark:text-violet-200">
                  {formatCurrency(commissionPreview)}
                </span>
              </div>

              {/* Desglose de Ganancia Neta Empresa vs Retención de Repuestos */}
              <div className="pt-2.5 border-t border-violet-200/60 dark:border-violet-800/40 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-violet-100 dark:border-violet-900/40">
                  <span className="text-muted-foreground block text-[10px]">Ganancia Neta Empresa:</span>
                  <strong className="text-emerald-700 dark:text-emerald-300 text-xs">
                    {formatCurrency(Math.max(0, (laborCost || 0) - (commissionPreview || 0)))}
                  </strong>
                </div>
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-violet-100 dark:border-violet-900/40">
                  <span className="text-muted-foreground block text-[10px]">Recuperación Repuestos:</span>
                  <strong className="text-slate-800 dark:text-slate-200 text-xs">
                    {formatCurrency(pricing.partsPrice)}
                  </strong>
                </div>
              </div>

              {/* Nota de liquidación */}
              <p className="text-[11px] text-violet-700/80 dark:text-violet-400/80">
                Se liquida recién cuando la reparación llegue a{' '}
                <strong>{compensation.accrual_status === 'entregado' ? 'entregado' : 'lista o entregada'}</strong>
                . El costo de repuestos no se comparte, queda 100% para la empresa.
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
