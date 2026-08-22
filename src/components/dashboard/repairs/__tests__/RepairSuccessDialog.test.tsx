import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { RepairPrintPayload } from '@/lib/repair-receipt'
import { RepairSuccessDialog } from '../RepairSuccessDialog'

vi.mock('@/lib/repair-receipt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/repair-receipt')>()
  return { ...actual, printRepairReceipt: vi.fn(), openRepairWhatsApp: vi.fn() }
})

const payload = {
  company: { name: 'Taller 4G' },
  customer: { id: 'c-1', name: 'Ana Pérez', phone: '0981123456' },
  date: new Date('2026-08-20T12:00:00.000Z'),
  ticketNumber: 'R-501',
  devices: [
    {
      typeLabel: 'Celular',
      brand: 'Marca',
      model: 'Modelo',
      issue: 'Pantalla rota',
      technician: 'Sin asignar',
      estimatedCost: 300_000,
      ticketNumber: 'R-501',
    },
  ],
} as unknown as RepairPrintPayload

describe('RepairSuccessDialog', () => {
  /**
   * El dialogo vive montado en la pagina con `data` en null y recien recibe el
   * payload cuando la reparacion se creo. Ese paso de null a payload es
   * exactamente el flujo real de "guardar y ofrecer imprimir".
   */
  it('offers printing after the repair is created', () => {
    const { rerender } = render(
      <RepairSuccessDialog open={false} onClose={vi.fn()} data={null} />
    )

    rerender(<RepairSuccessDialog open onClose={vi.fn()} data={payload} />)

    expect(screen.getByText(/Reparación Ingresada con Éxito/i)).toBeInTheDocument()
    expect(screen.getByText(/Imprimir Ambos/i)).toBeInTheDocument()
  })
})
