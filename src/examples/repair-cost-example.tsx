/**
 * Ejemplo de uso de la nueva funcionalidad de costos en reparaciones
 * 
 * Este archivo muestra cómo usar la calculadora de costos y los nuevos campos
 * en el formulario de edición de reparaciones.
 */

import React from 'react'
import { RepairCostCalculator } from '@/components/dashboard/repairs/RepairCostCalculator'

// Ejemplo de datos de reparación con costos
const exampleRepairData = {
  // Datos básicos de la reparación
  customerName: 'Juan Pérez',
  device: 'iPhone 15 Pro',
  issue: 'Pantalla rota',
  
  // Costos
  laborCost: 150.00,
  finalCost: null, // Se calculará automáticamente
  
  // Repuestos
  parts: [
    {
      name: 'Pantalla OLED iPhone 15 Pro',
      cost: 280.00,
      quantity: 1,
      supplier: 'TechParts Inc'
    },
    {
      name: 'Protector de pantalla',
      cost: 15.00,
      quantity: 1,
      supplier: 'Accessories Plus'
    }
  ]
}

// Ejemplo de cálculo automático
const calculateExampleCosts = () => {
  const { laborCost, parts } = exampleRepairData
  
  // Costo total de repuestos
  const partsCost = parts.reduce((total, part) => total + (part.cost * part.quantity), 0)
  
  // Subtotal sin IVA
  const subtotal = laborCost + partsCost
  
  // IVA (10%)
  const taxAmount = subtotal * 0.10
  
  // Total final
  const total = subtotal + taxAmount
  
  return {
    laborCost,
    partsCost,
    subtotal,
    taxAmount,
    total
  }
}

// Ejemplo de componente usando la calculadora
export function RepairCostExample() {
  const [laborCost, setLaborCost] = React.useState(150.00)
  const [finalCost, setFinalCost] = React.useState<number | null>(null)
  
  const parts = [
    {
      name: 'Pantalla OLED iPhone 15 Pro',
      cost: 280.00,
      quantity: 1
    },
    {
      name: 'Protector de pantalla',
      cost: 15.00,
      quantity: 1
    }
  ]
  
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Ejemplo: Calculadora de Costos de Reparación</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="font-semibold text-blue-900 mb-2">Datos de la Reparación</h2>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Cliente:</strong> {exampleRepairData.customerName}</li>
          <li><strong>Dispositivo:</strong> {exampleRepairData.device}</li>
          <li><strong>Problema:</strong> {exampleRepairData.issue}</li>
        </ul>
      </div>
      
      <RepairCostCalculator
        laborCost={laborCost}
        onLaborCostChange={setLaborCost}
        finalCost={finalCost}
        onFinalCostChange={setFinalCost}
        parts={parts}
        showBreakdown={true}
      />
      
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h2 className="font-semibold text-green-900 mb-2">Cálculo Automático</h2>
        <div className="text-sm text-green-800 space-y-1">
          {(() => {
            const calc = calculateExampleCosts()
            return (
              <>
                <div className="flex justify-between">
                  <span>Mano de obra:</span>
                  <span>${calc.laborCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Repuestos:</span>
                  <span>${calc.partsCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${calc.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (10%):</span>
                  <span>${calc.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Total:</span>
                  <span>${calc.total.toFixed(2)}</span>
                </div>
              </>
            )
          })()}
        </div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h2 className="font-semibold text-yellow-900 mb-2">Casos de Uso</h2>
        <ul className="text-sm text-yellow-800 space-y-2">
          <li>
            <strong>Costo Estimado:</strong> Dejar "Costo Final" vacío para usar el cálculo automático
          </li>
          <li>
            <strong>Descuento:</strong> Ingresar un costo final menor al estimado (aparecerá en verde)
          </li>
          <li>
            <strong>Costo Adicional:</strong> Ingresar un costo final mayor al estimado (aparecerá en naranja)
          </li>
          <li>
            <strong>Repuestos Dinámicos:</strong> Los costos se actualizan automáticamente al agregar/quitar repuestos
          </li>
        </ul>
      </div>
    </div>
  )
}

// Ejemplo de datos para testing
export const testCases = {
  // Caso 1: Reparación simple sin repuestos
  simpleRepair: {
    laborCost: 50.00,
    parts: [],
    expectedTotal: 55.00 // 50 + 10% IVA
  },
  
  // Caso 2: Reparación con múltiples repuestos
  complexRepair: {
    laborCost: 100.00,
    parts: [
      { name: 'Batería', cost: 80.00, quantity: 1 },
      { name: 'Tornillos', cost: 5.00, quantity: 4 }
    ],
    expectedTotal: 220.00 // (100 + 80 + 20) * 1.10
  },
  
  // Caso 3: Reparación con descuento
  discountedRepair: {
    laborCost: 150.00,
    parts: [
      { name: 'Pantalla', cost: 200.00, quantity: 1 }
    ],
    estimatedTotal: 385.00, // (150 + 200) * 1.10
    finalCost: 300.00, // Descuento aplicado
    discount: 85.00
  }
}

export default RepairCostExample