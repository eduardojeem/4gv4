/**
 * Tests para RepairCostCalculator
 * 
 * Verifica que los cálculos de costos funcionen correctamente
 * y que la UI responda apropiadamente a los cambios.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { RepairCostCalculator } from '../RepairCostCalculator'

// Mock de las dependencias
jest.mock('@/lib/currency', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`
}))

jest.mock('@/lib/pos-calculator', () => ({
  calculateRepairTotal: (input: any) => ({
    laborCost: input.laborCost,
    partsCost: input.partsCost,
    subtotal: input.laborCost + input.partsCost,
    taxAmount: (input.laborCost + input.partsCost) * 0.10,
    total: (input.laborCost + input.partsCost) * 1.10,
    breakdown: {
      laborTax: input.laborCost * 0.10,
      partsTax: input.partsCost * 0.10,
      laborSubtotal: input.laborCost,
      partsSubtotal: input.partsCost
    }
  })
}))

describe('RepairCostCalculator', () => {
  const defaultProps = {
    laborCost: 100,
    onLaborCostChange: jest.fn(),
    finalCost: null,
    onFinalCostChange: jest.fn(),
    parts: [
      { name: 'Pantalla', cost: 200, quantity: 1 },
      { name: 'Batería', cost: 50, quantity: 2 }
    ]
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renderiza correctamente con props básicas', () => {
    render(<RepairCostCalculator {...defaultProps} />)
    
    expect(screen.getByText('Calculadora de Costos')).toBeInTheDocument()
    expect(screen.getByText('Costo de Mano de Obra')).toBeInTheDocument()
    expect(screen.getByText('Costo de Repuestos')).toBeInTheDocument()
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
    
    expect(screen.getByText('Desglose Automático')).toBeInTheDocument()
    expect(screen.getByText('Subtotal (sin IVA):')).toBeInTheDocument()
    expect(screen.getByText('IVA (10%):')).toBeInTheDocument()
    expect(screen.getByText('Total Estimado:')).toBeInTheDocument()
  })

  it('llama onLaborCostChange cuando se cambia el costo de mano de obra', () => {
    render(<RepairCostCalculator {...defaultProps} />)
    
    const laborInput = screen.getByDisplayValue('100')
    fireEvent.change(laborInput, { target: { value: '150' } })
    
    expect(defaultProps.onLaborCostChange).toHaveBeenCalledWith(150)
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

  it('muestra el botón "Usar costo estimado" cuando hay un costo final', () => {
    const props = {
      ...defaultProps,
      finalCost: 400
    }
    
    render(<RepairCostCalculator {...props} />)
    
    expect(screen.getByText('Usar costo estimado')).toBeInTheDocument()
  })

  it('resetea el costo final al hacer clic en "Usar costo estimado"', () => {
    const props = {
      ...defaultProps,
      finalCost: 400
    }
    
    render(<RepairCostCalculator {...props} />)
    
    const resetButton = screen.getByText('Usar costo estimado')
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
      onLaborCostChange: jest.fn(),
      finalCost: null,
      onFinalCostChange: jest.fn(),
      parts: [{ name: 'Test', cost: 100, quantity: 1 }],
      taxRate: 15, // IVA personalizado
      pricesIncludeTax: false
    }
    
    render(<RepairCostCalculator {...props} showBreakdown={true} />)
    
    // Debería mostrar IVA del 15%
    expect(screen.getByText('IVA (15%):')).toBeInTheDocument()
  })
})