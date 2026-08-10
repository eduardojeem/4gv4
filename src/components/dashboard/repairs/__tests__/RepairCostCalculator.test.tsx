/**
 * Tests para RepairCostCalculator
 * 
 * Verifica que los cálculos de costos funcionen correctamente
 * y que la UI responda apropiadamente a los cambios.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RepairCostCalculator } from '../RepairCostCalculator'

// Mock de las dependencias
vi.mock('@/lib/currency', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  getCurrencyFractionDigits: () => 2,
}))

vi.mock('@/lib/pos-calculator', () => ({
  calculateRepairTotal: (input: { laborCost: number; partsCost: number; taxRate: number }) => ({
    laborCost: input.laborCost,
    partsCost: input.partsCost,
    subtotal: input.laborCost + input.partsCost,
    taxAmount: (input.laborCost + input.partsCost) * (input.taxRate / 100),
    total: (input.laborCost + input.partsCost) * (1 + input.taxRate / 100),
    breakdown: {
      laborTax: input.laborCost * 0.10,
      partsTax: input.partsCost * 0.10,
      laborSubtotal: input.laborCost,
      partsSubtotal: input.partsCost
    }
  })
}))

vi.mock('@/hooks/use-technician-compensation', () => ({
  useTechnicianCompensation: () => ({ compensation: null, isLoading: false })
}))

describe('RepairCostCalculator', () => {
  const defaultProps = {
    laborCost: 100,
    onLaborCostChange: vi.fn(),
    finalCost: null,
    onFinalCostChange: vi.fn(),
    calculationMode: 'manual' as const,
    canUseManual: true,
    parts: [
      { name: 'Pantalla', cost: 200, quantity: 1 },
      { name: 'Batería', cost: 50, quantity: 2 }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza correctamente con props básicas', () => {
    render(<RepairCostCalculator {...defaultProps} />)
    
    expect(screen.getByText('Calculadora de costos')).toBeInTheDocument()
    expect(screen.getByText('Mano de obra')).toBeInTheDocument()
    expect(screen.getByText('Precio de repuestos')).toBeInTheDocument()
  })

  it('calcula correctamente el costo de repuestos', () => {
    render(<RepairCostCalculator {...defaultProps} />)
    
    // Pantalla: 200 * 1 = 200
    // Batería: 50 * 2 = 100
    // Total repuestos: 300
    expect(screen.getByDisplayValue('$300.00')).toBeInTheDocument()
  })

  it('muestra el desglose de costos cuando showBreakdown es true', () => {
    render(<RepairCostCalculator {...defaultProps} showBreakdown={true} />)
    
    expect(screen.getByText('Desglose automático')).toBeInTheDocument()
    expect(screen.getByText('Subtotal (sin IVA):')).toBeInTheDocument()
    expect(screen.getByText('IVA (10%):')).toBeInTheDocument()
    expect(screen.getByText('Total estimado:')).toBeInTheDocument()
  })

  it('llama onLaborCostChange cuando se cambia el costo de mano de obra', () => {
    render(<RepairCostCalculator {...defaultProps} />)
    
    const laborInput = screen.getByDisplayValue('100')
    fireEvent.change(laborInput, { target: { value: '150' } })
    
    expect(defaultProps.onLaborCostChange).toHaveBeenCalledWith(150)
  })

  it('recalcula el total al borrar la mano de obra en modo automático', () => {
    const props = {
      ...defaultProps,
      calculationMode: 'automatic' as const,
      finalCost: 400,
    }
    render(<RepairCostCalculator {...props} />)

    fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '' } })

    expect(props.onLaborCostChange).toHaveBeenCalledWith(0)
    expect(props.onFinalCostChange).toHaveBeenCalledWith(300)
  })

  it('limpia los importes derivados al iniciar un presupuesto', () => {
    const onCalculationModeChange = vi.fn()
    const props = {
      ...defaultProps,
      calculationMode: 'automatic' as const,
      finalCost: 400,
      onCalculationModeChange,
    }
    render(<RepairCostCalculator {...props} />)

    fireEvent.click(screen.getByRole('button', { name: /Usar presupuesto/ }))

    expect(onCalculationModeChange).toHaveBeenCalledWith('budget')
    expect(props.onFinalCostChange).toHaveBeenCalledWith(null)
    expect(props.onLaborCostChange).toHaveBeenCalledWith(0)
  })

  it('deriva la mano de obra desde el presupuesto ingresado', () => {
    const props = {
      ...defaultProps,
      calculationMode: 'budget' as const,
      laborCost: 0,
      finalCost: null,
    }
    render(<RepairCostCalculator {...props} />)

    fireEvent.change(screen.getByPlaceholderText(/estimado/), { target: { value: '500' } })

    expect(props.onFinalCostChange).toHaveBeenCalledWith(500)
    expect(props.onLaborCostChange).toHaveBeenCalledWith(200)
  })

  it('llama onFinalCostChange cuando se cambia el costo final', () => {
    render(<RepairCostCalculator {...defaultProps} />)
    
    const finalCostInput = screen.getByPlaceholderText(/estimado/)
    fireEvent.change(finalCostInput, { target: { value: '400' } })
    
    expect(defaultProps.onFinalCostChange).toHaveBeenCalledWith(400)
  })

  it('muestra indicador de incremento cuando el costo final es mayor al estimado', () => {
    const props = {
      ...defaultProps,
      finalCost: 500 // Mayor que el estimado (440)
    }
    
    render(<RepairCostCalculator {...props} />)
    
    expect(screen.getByText(/Incremento de/)).toBeInTheDocument()
  })

  it('muestra indicador de descuento cuando el costo final es menor al estimado', () => {
    const props = {
      ...defaultProps,
      finalCost: 350 // Menor que el estimado (440)
    }
    
    render(<RepairCostCalculator {...props} />)
    
    expect(screen.getByText(/Descuento de/)).toBeInTheDocument()
  })

  it('muestra el botón para restablecer el estimado cuando hay un costo final', () => {
    const props = {
      ...defaultProps,
      finalCost: 400
    }
    
    render(<RepairCostCalculator {...props} />)
    
    expect(screen.getByText('Restablecer al estimado')).toBeInTheDocument()
  })

  it('resetea el costo final al hacer clic en "Restablecer al estimado"', () => {
    const props = {
      ...defaultProps,
      finalCost: 400
    }
    
    render(<RepairCostCalculator {...props} />)
    
    const resetButton = screen.getByText('Restablecer al estimado')
    fireEvent.click(resetButton)
    
    expect(defaultProps.onFinalCostChange).toHaveBeenCalledWith(null)
  })

  it('muestra error de validación cuando se proporciona', () => {
    const props = {
      ...defaultProps,
      error: 'El costo final no puede ser negativo'
    }
    
    render(<RepairCostCalculator {...props} />)
    
    expect(screen.getByText('El costo final no puede ser negativo')).toBeInTheDocument()
  })

  it('deshabilita los inputs cuando disabled es true', () => {
    const props = {
      ...defaultProps,
      disabled: true
    }
    
    render(<RepairCostCalculator {...props} />)
    
    const laborInput = screen.getByDisplayValue('100')
    const finalCostInput = screen.getByPlaceholderText(/estimado/)
    
    expect(laborInput).toBeDisabled()
    expect(finalCostInput).toBeDisabled()
  })

  it('muestra información de repuestos individuales', () => {
    render(<RepairCostCalculator {...defaultProps} />)
    
    expect(screen.getByText('Pantalla (x1)')).toBeInTheDocument()
    expect(screen.getByText('Batería (x2)')).toBeInTheDocument()
    expect(screen.getByText('$200.00')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('maneja correctamente repuestos vacíos', () => {
    const props = {
      ...defaultProps,
      parts: []
    }
    
    render(<RepairCostCalculator {...props} />)
    
    expect(screen.getByDisplayValue('$0.00')).toBeInTheDocument()
  })
})

// Tests de integración con pos-calculator
describe('RepairCostCalculator - Integración con pos-calculator', () => {
  it('usa correctamente la configuración de IVA', () => {
    const props = {
      laborCost: 100,
      onLaborCostChange: vi.fn(),
      finalCost: null,
      onFinalCostChange: vi.fn(),
      parts: [{ name: 'Test', cost: 100, quantity: 1 }],
      taxRate: 15, // IVA personalizado
      pricesIncludeTax: false
    }
    
    render(<RepairCostCalculator {...props} showBreakdown={true} />)
    
    // Debería mostrar IVA del 15%
    expect(screen.getByText('IVA (15%):')).toBeInTheDocument()
  })
})
