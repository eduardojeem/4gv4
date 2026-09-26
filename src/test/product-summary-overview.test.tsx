import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProductSummaryOverview } from '@/components/dashboard/products-modern/ProductSummaryOverview'
import type { DashboardMetrics } from '@/types/products-dashboard'

describe('ProductSummaryOverview', () => {
  const mockMetrics: DashboardMetrics = {
    total_products: 34,
    physical_products_count: 18,
    services_count: 16,
    active_products: 25,
    low_stock_count: 2,
    out_of_stock_count: 7,
    inventory_value: 1250000,
  }

  it('se muestra contraído por defecto con sus micro-indicadores visibles', () => {
    const onToggle = vi.fn()
    render(
      <ProductSummaryOverview
        metrics={mockMetrics}
        isExpanded={false}
        onToggleExpanded={onToggle}
      />
    )

    // Título de la barra
    expect(screen.getByText('Resumen de Inventario')).toBeDefined()

    // Micro-indicadores
    expect(screen.getByText('34')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('7')).toBeDefined()
    expect(screen.getByText('25')).toBeDefined()

    // Botón de expansión
    const toggleBtn = screen.getByRole('button', { name: /ver resumen completo/i })
    expect(toggleBtn).toBeDefined()

    // No debe mostrar los subtítulos extendidos de las tarjetas grandes
    expect(screen.queryByText('Sin existencias físicas')).toBeNull()

    // Click en botón para expandir
    fireEvent.click(toggleBtn)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('al expandirse muestra las tarjetas de métricas completas y el botón para plegar', () => {
    const onToggle = vi.fn()
    render(
      <ProductSummaryOverview
        metrics={mockMetrics}
        isExpanded={true}
        onToggleExpanded={onToggle}
      />
    )

    // Botón para contraer
    const foldBtn = screen.getByRole('button', { name: /plegar resumen/i })
    expect(foldBtn).toBeDefined()

    // Se muestran las tarjetas completas
    expect(screen.getByText('Catálogo Total')).toBeDefined()
    expect(screen.getByText('Sin existencias físicas')).toBeDefined()

    fireEvent.click(foldBtn)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('los micro-indicadores interactivos activan el callback de métrica al hacer clic', () => {
    const onMetricClick = vi.fn()
    render(
      <ProductSummaryOverview
        metrics={mockMetrics}
        isExpanded={false}
        onToggleExpanded={vi.fn()}
        onMetricClick={onMetricClick}
      />
    )

    // Clic en Bajo stock
    const lowStockBtn = screen.getByTitle('Filtrar productos con stock bajo')
    fireEvent.click(lowStockBtn)
    expect(onMetricClick).toHaveBeenCalledWith('low_stock')

    // Clic en Agotados
    const outOfStockBtn = screen.getByTitle('Filtrar productos agotados')
    fireEvent.click(outOfStockBtn)
    expect(onMetricClick).toHaveBeenCalledWith('out_of_stock')

    // Clic en Activos
    const activeBtn = screen.getByTitle('Filtrar productos activos en venta')
    fireEvent.click(activeBtn)
    expect(onMetricClick).toHaveBeenCalledWith('active')
  })
})
