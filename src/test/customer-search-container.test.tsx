import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { CustomerFilters } from '@/components/dashboard/customers/CustomerFilters'

afterEach(cleanup)

it('keeps the customer suggestion popup outside the filter panel unclipped', () => {
  render(<CustomerFilters filters={{
    search: '', status: 'all', customer_type: 'all', segment: 'all', city: 'all', assigned_salesperson: 'all',
    date_range: { from: null, to: null }, credit_score_range: [0, 10], lifetime_value_range: [0, Number.MAX_SAFE_INTEGER],
    tags: [], purchases_min: 0, spent_min: 0, loyalty_points_min: 0,
  }} onFiltersChange={() => {}} viewMode="table" onViewModeChange={() => {}} customers={[]} />)
  const container = screen.getByText('Filtros Inteligentes').closest('[data-slot="card"]')
  expect(container).toHaveClass('overflow-visible')
  expect(container).not.toHaveClass('overflow-hidden')
})
