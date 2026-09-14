import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useSWR from 'swr'
import { OrganizationReviews } from './OrganizationReviews'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dabasica/inicio',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('swr', () => ({ default: vi.fn() }))

vi.mock('@/components/security/TurnstileChallenge', () => ({
  TurnstileChallenge: () => <div data-testid="turnstile" />,
}))

const response = {
  success: true,
  data: {
    reviews: [{
      id: 'review-1',
      reviewer_name: 'Ana',
      rating: 5,
      comment: 'Excelente atención',
      created_at: '2026-09-01T00:00:00.000Z',
      verification_type: 'purchase',
      business_response: 'Gracias por confiar en nosotros.',
      responded_at: '2026-09-02T00:00:00.000Z',
    }],
    stats: {
      average: 4.8,
      count: 8,
      verifiedAverage: 5,
      verifiedCount: 6,
      respondedCount: 4,
      satisfactionRate: 88,
      breakdown: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 5 },
    },
    pagination: { total: 8, limit: 6, offset: 0 },
  },
}

describe('OrganizationReviews', () => {
  beforeEach(() => {
    vi.mocked(useSWR).mockReturnValue({ data: response, error: undefined, isLoading: false, mutate: vi.fn() } as never)
  })

  it('shows verification evidence and the official business response', () => {
    render(<OrganizationReviews />)

    expect(screen.getByText('Compra verificada')).toBeInTheDocument()
    expect(screen.getByText('Respuesta del negocio')).toBeInTheDocument()
    expect(screen.getByText('Gracias por confiar en nosotros.')).toBeInTheDocument()
    expect(screen.getByText('6 verificadas')).toBeInTheDocument()
  })

  it('requests the next real page instead of only expanding the first six rows', () => {
    render(<OrganizationReviews />)
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    expect(vi.mocked(useSWR).mock.calls.at(-1)?.[0]).toContain('offset=6')
  })

  /** Una tienda sin taller no puede tener reparaciones verificadas. */
  it('does not mention repairs when the business has no repairs module', () => {
    render(<OrganizationReviews hasRepairs={false} />)

    expect(screen.queryByRole('button', { name: 'Reparaciones' })).not.toBeInTheDocument()
    expect(screen.queryByText(/reparaciones comprobadas/i)).not.toBeInTheDocument()
    expect(screen.getByText(/compras comprobadas por el sistema/i)).toBeInTheDocument()
  })

  it('offers the repairs filter when the business repairs devices', () => {
    render(<OrganizationReviews hasRepairs />)
    fireEvent.click(screen.getByRole('button', { name: 'Reparaciones' }))

    expect(vi.mocked(useSWR).mock.calls.at(-1)?.[0]).toContain('verification=repair')
    expect(screen.getByText(/compras y reparaciones comprobadas/i)).toBeInTheDocument()
  })

  it('offers a verified-only filter', () => {
    render(<OrganizationReviews />)
    fireEvent.click(screen.getByRole('button', { name: 'Verificadas' }))

    expect(vi.mocked(useSWR).mock.calls.at(-1)?.[0]).toContain('verification=verified')
  })
})
