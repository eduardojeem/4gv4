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
import { Calculator, DollarSign, Wrench, Package, Receipt, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/currency'
import { calculateRepairTotal, type RepairCalculationInput } from '@/lib/pos-calculator'

interface RepairPart {
  name: string
  cost: number
  quantity: number
}

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
        
        {/* Costos Base */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Costo de Mano de Obra */}
          <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/30 border-2 border-blue-200 dark:border-blue-900/50">
            <Label className="text-sm font-semibold flex items-center gap-2 text-blue-900 dark:text-blue-300">
              <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Costo de Mano de Obra
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
                className="pl-11 h-14 text-lg font-semibold border-blue-300 dark:border-blue-800 focus:border-blue-500 dark:focus:border-blue-600 bg-white dark:bg-slate-900"
                disabled={disabled}
              />
            </div>
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
            </Label>
            {finalCost !== null && (
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
              className={`pl-14 h-16 text-xl font-bold border-2 ${
                hasCostDifference 
                  ? costDifference > 0 
                    ? 'border-orange-400 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/30 text-orange-900 dark:text-orange-200' 
                    : 'border-green-400 dark:border-green-700 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/40 dark:to-green-900/30 text-green-900 dark:text-green-200'
                  : 'border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900'
              } ${error ? 'border-red-500 dark:border-red-700' : ''}`}
              disabled={disabled}
            />
          </div>
          
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