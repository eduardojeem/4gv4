import { describe, expect, it } from 'vitest'

import { buildMobileDashboardSummary, mergeDashboardActivity } from './dashboard-summary'
import type { DashboardHomeSummary } from '@/lib/dashboard/home-summary'

const homeSummary: DashboardHomeSummary = {
  version: 1,
  timeZone: 'America/Asuncion',
  today: '2026-10-25',
  generatedAt: '2026-10-25T12:00:00Z',
  sales: { todayAmount: 1000, todayCount: 2, daily: [0, 0, 0, 0, 0, 0, 1000] },
  customers: { newCount: 3, daily: [0, 0, 0, 0, 0, 0, 3] },
  catalog: { physicalCount: 5, servicesCount: 1, lowStockCount: 2 },
  orders: { activeCount: 4 },
  repairs: { activeCount: 6, todayCount: 1, todayAmount: 500, deliveredCount: 1, deliveredAmount: 300, readyCount: 2, readyAmount: 700 },
}

describe('mobile dashboard summary', () => {
  it('redacts metrics for sections the active role cannot access', () => {
    const summary = buildMobileDashboardSummary(homeSummary, new Set(['customers']))

    expect(summary.salesToday).toEqual({ count: 0, amount: 0, trend: [0, 0, 0, 0, 0, 0, 0] })
    expect(summary.activeOrders).toBe(0)
    expect(summary.repairs).toEqual({ active: 0, ready: { count: 0 } })
    expect(summary.catalog).toEqual({ total: 0, lowStock: 0 })
    expect(summary.customersNew).toEqual({ count: 3 })
  })

  it('keeps the metrics for visible sections and carries the organization date scope', () => {
    const summary = buildMobileDashboardSummary(homeSummary, new Set(['pos', 'orders', 'repairs', 'products', 'customers']))

    expect(summary.salesToday.amount).toBe(1000)
    expect(summary.activeOrders).toBe(4)
    expect(summary.repairs.active).toBe(6)
    expect(summary.catalog).toEqual({ total: 6, lowStock: 2 })
    expect(summary.today).toBe('2026-10-25')
    expect(summary.timeZone).toBe('America/Asuncion')
  })

  it('marks cancelled and pending sales without presenting them as collected revenue', () => {
    const activity = mergeDashboardActivity({
      sales: [
        { id: 'cancelled', status: 'cancelada', total_amount: 900, created_at: '2026-10-25T11:00:00Z' },
        { id: 'pending', status: 'pending', total_amount: 600, created_at: '2026-10-25T10:00:00Z' },
        { id: 'paid', status: 'completed', total_amount: 300, created_at: '2026-10-25T09:00:00Z' },
      ],
      repairs: [],
      customers: [],
    })

    expect(activity).toEqual([
      expect.objectContaining({ description: 'Venta anulada' }),
      expect.objectContaining({ description: 'Venta pendiente' }),
      expect.objectContaining({ description: 'Venta cobrada', amount: 300 }),
    ])
    expect(activity[0]).not.toHaveProperty('amount')
    expect(activity[1]).not.toHaveProperty('amount')
  })

  it('limits activity to the ten newest entries and does not return customer or device details', () => {
    const activity = mergeDashboardActivity({
      sales: [],
      repairs: Array.from({ length: 11 }, (_, index) => ({ id: `repair-${index}`, status: 'listo', created_at: `2026-10-25T${String(index).padStart(2, '0')}:00:00Z` })),
      customers: [{ id: 'customer-1', created_at: '2026-10-25T11:00:00Z' }],
    })

    expect(activity).toHaveLength(10)
    expect(activity[0]).toMatchObject({ description: 'Nuevo cliente' })
    expect(activity.some((item) => item.description.includes('repair-'))).toBe(false)
  })
})
