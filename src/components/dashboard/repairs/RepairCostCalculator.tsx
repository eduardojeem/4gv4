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
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5 text-primary" />
          Calculadora de Costos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Costos Base */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Costo de Mano de Obra */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-600" />
              Costo de Mano de Obra
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={laborCost || ''}
                onChange={(e) => onLaborCostChange(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="pl-10 h-12 text-base"
                disabled={disabled}
              />
            </div>
          </div>
          
          {/* Costo de Repuestos (Solo lectura) */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-green-600" />
              Costo de Repuestos
              <Badge variant="secondary" className="text-xs">
                {parts.length} {parts.length === 1 ? 'item' : 'items'}
              </Badge>
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={formatCurrency(partsCost)}
                className="pl-10 h-12 text-base bg-muted/50"
                disabled
                readOnly
              />
            </div>
            {parts.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                {parts.map((part, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{part.name} (x{part.quantity})</span>
                    <span>{formatCurrency(part.cost * part.quantity)}</span>
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
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Desglose Automático
            </h4>
            
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal (sin IVA):</span>
                  <span className="font-medium">{formatCurrency(calculation.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA ({taxRate}%):</span>
                  <span className="font-medium">{formatCurrency(calculation.taxAmount)}</span>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex justify-between font-semibold">
                <span>Total Estimado:</span>
                <span className="text-lg">{formatCurrency(estimatedCost)}</span>
              </div>
            </div>
          </div>
        )}
        
        <Separator />
        
        {/* Costo Final */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Costo Final de la Reparación
            </Label>
            {finalCost !== null && (
              <button
                type="button"
                onClick={() => onFinalCostChange(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
                disabled={disabled}
              >
                Usar costo estimado
              </button>
            )}
          </div>
          
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
              className={`pl-10 h-12 text-base font-semibold ${
                hasCostDifference 
                  ? costDifference > 0 
                    ? 'border-orange-300 bg-orange-50' 
                    : 'border-green-300 bg-green-50'
                  : ''
              } ${error ? 'border-red-500' : ''}`}
              disabled={disabled}
            />
          </div>
          
          {/* Diferencia de Costo */}
          {hasCostDifference && finalCost !== null && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
              costDifference > 0 
                ? 'bg-orange-50 text-orange-700 border border-orange-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              <AlertTriangle className="h-4 w-4" />
              <span>
                {costDifference > 0 ? 'Incremento' : 'Descuento'} de{' '}
                <strong>{formatCurrency(Math.abs(costDifference))}</strong>
                {' '}respecto al costo estimado
              </span>
            </div>
          )}
          
          {/* Error de validación */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
          
          {/* Información adicional */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Si no especificas un costo final, se usará el costo estimado automáticamente</p>
            <p>• El costo final es lo que se cobrará al cliente</p>
            {pricesIncludeTax && <p>• Los precios incluyen IVA del {taxRate}%</p>}
          </div>
        </div>
        
      </CardContent>
    </Card>
  )
}