import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicBooking } from '@/components/public/agenda/PublicBooking'

const info = {
  storeName: 'Don Pepe',
  currency: 'PYG',
  today: '2026-10-02',
  maxDaysAhead: 30,
  requireConfirmation: true,
  message: null,
  openDays: [1, 2, 3, 4, 5, 6],
  services: [
    { id: 'corte', name: 'Corte', duration: 30, price: 50000, professionalIds: ['pepe', 'ana'] },
    { id: 'color', name: 'Color', duration: 90, price: 150000, professionalIds: ['ana'] },
  ],
  professionals: [
    { id: 'pepe', name: 'Pepe', color: '#0f766e' },
    { id: 'ana', name: 'Ana', color: '#7c3aed' },
  ],
}

afterEach(() => vi.unstubAllGlobals())

describe('la reserva online ofrece solo a quien hace el servicio', () => {
  it('Corte lo hacen los dos; Color solo Ana, así que no se pregunta con quién', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => info }))
    render(<PublicBooking slug="don-pepe" />)

    fireEvent.click(await screen.findByRole('button', { name: /Corte/ }))
    expect(screen.getByRole('button', { name: /Pepe/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ana/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Color/ }))
    expect(screen.queryByText('¿Con quién?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pepe/ })).not.toBeInTheDocument()
  })
})
