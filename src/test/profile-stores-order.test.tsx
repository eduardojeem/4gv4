import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProfileStores } from '@/components/profile/profile-stores'

const baseSummary = {
  equipment: { total: 0, active: 0, ready: 0, delivered: 0 },
  repairs: { pendingCount: 0, paidCount: 0, pendingAmount: 0 },
  orders: { pendingCount: 0, paidCount: 0, pendingAmount: 0 },
  financing: { pendingAmount: 0, overdueAmount: 0, overdueCount: 0 },
  storeCredit: 0,
  totalDue: 0,
  netBalance: 0,
}

describe('ProfileStores ordering', () => {
  it('muestra primero la tienda con cuotas vencidas y luego las que requieren atención', () => {
    render(<ProfileStores stores={[
      { organizationId: 'ok', organization: { id: 'ok', name: 'Tienda al día', slug: 'ok' }, summary: baseSummary, needsAttention: false },
      { organizationId: 'due', organization: { id: 'due', name: 'Saldo pendiente', slug: 'due' }, summary: { ...baseSummary, totalDue: 50000, netBalance: -50000 }, needsAttention: true },
      { organizationId: 'late', organization: { id: 'late', name: 'Cuota vencida', slug: 'late' }, summary: { ...baseSummary, financing: { pendingAmount: 90000, overdueAmount: 30000, overdueCount: 1 }, totalDue: 90000, netBalance: -90000 }, needsAttention: true },
    ]} />)

    const links = screen.getAllByRole('link').map((link) => link.textContent?.trim()).filter(Boolean)
    expect(links.indexOf('Cuota vencida')).toBeLessThan(links.indexOf('Saldo pendiente'))
    expect(links.indexOf('Saldo pendiente')).toBeLessThan(links.indexOf('Tienda al día'))
  })
})
