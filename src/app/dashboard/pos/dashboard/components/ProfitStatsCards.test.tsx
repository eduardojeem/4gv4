/**
 * Sección de Ganancias del dashboard del POS.
 *
 * Verifica que el interruptor Con IVA / Sin IVA aparezca y cambie las cifras,
 * y que el estado "costo no disponible" reemplace las tarjetas en vez de
 * mostrar ceros que parecen datos.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfitStatsCards } from './ProfitStatsCards'
import { calculateProfit } from '../lib/pos-profit'
import type { PosStats } from '../hooks/usePosStats'

function statsWith(overrides: Partial<Parameters<typeof calculateProfit>[0]> = {}): PosStats {
  const profit = calculateProfit({
    totalSales: 1_100_000,
    netSales: 1_000_000,
    totalCost: 600_000,
    repairDeliveredAmount: 200_000,
    ...overrides,
  })

  return {
    totalSales: 1_100_000,
    netSales: 1_000_000,
    totalTransactions: 5,
    averageTicket: 220_000,
    topProduct: { name: 'N/A', sales: 0 },
    dailySales: [],
    paymentMethods: [],
    topProducts: [],
    recentSales: [],
    creditStats: { totalAmount: 0, count: 0, averageTicket: 0, pendingAmount: 0 },
    repairStats: {
      totalAmount: 0, deliveredAmount: 200_000, deliveredCount: 1,
      readyAmount: 0, readyCount: 0, activeCount: 0,
    },
    profitStats: { ...profit, itemsWithoutCost: 0 },
    warnings: [],
  } as PosStats
}

describe('ProfitStatsCards', () => {
  it('renderiza la sección con el interruptor de IVA', () => {
    render(<ProfitStatsCards stats={statsWith()} />)

    expect(screen.getByText(/Ganancias/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Con IVA' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sin IVA' })).toBeInTheDocument()
  })

  it('arranca en "Con IVA", que es el criterio del negocio', () => {
    render(<ProfitStatsCards stats={statsWith()} />)

    expect(screen.getByRole('button', { name: 'Con IVA' })).toHaveAttribute('aria-pressed', 'true')
    // 1.100.000 − 600.000
    expect(screen.getByText(/500\.000/)).toBeInTheDocument()
  })

  it('al cambiar a "Sin IVA" recalcula sobre la base neta', () => {
    render(<ProfitStatsCards stats={statsWith()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sin IVA' }))

    // 1.000.000 − 600.000
    expect(screen.getByText(/400\.000/)).toBeInTheDocument()
    expect(screen.getByText(/Ventas sin IVA/)).toBeInTheDocument()
  })

  it('muestra el IVA del período junto al interruptor', () => {
    render(<ProfitStatsCards stats={statsWith()} />)

    expect(screen.getByText(/IVA del período/)).toBeInTheDocument()
  })

  it('sin costo disponible avisa en vez de mostrar cifras', () => {
    render(<ProfitStatsCards stats={statsWith({ totalCost: 0, costUnavailable: true })} />)

    expect(screen.getByText(/No se pudo calcular el costo/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sin IVA' })).not.toBeInTheDocument()
  })

  it('marca la pérdida en vez de recortarla a cero', () => {
    render(<ProfitStatsCards stats={statsWith({ totalCost: 2_000_000 })} />)

    // 1.100.000 − 2.000.000 = -900.000
    expect(screen.getByText(/-900\.000|−900\.000/)).toBeInTheDocument()
  })
})
