import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RepairHelpCenter } from './RepairHelpCenter'

describe('RepairHelpCenter', () => {
  it('finds a frequent task and starts its contextual tour', () => {
    const onStartTour = vi.fn()
    render(
      <RepairHelpCenter
        open
        onOpenChange={vi.fn()}
        audience="admin"
        onStartTour={onStartTour}
      />,
    )

    const search = screen.getByRole('searchbox', { name: /qué querés hacer/i })
    fireEvent.change(search, { target: { value: 'saldo pendiente' } })
    expect(screen.getByText('Cobrar adelanto o saldo')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /ver guía cobrar adelanto o saldo/i }))
    fireEvent.click(screen.getByRole('button', { name: /iniciar recorrido/i }))
    expect(onStartTour).toHaveBeenCalledWith(expect.objectContaining({ id: 'collect-balance' }))
  })

  it('does not expose administrative audit tasks to technicians', () => {
    render(
      <RepairHelpCenter
        open
        onOpenChange={vi.fn()}
        audience="technician"
        onStartTour={vi.fn()}
      />,
    )

    expect(screen.queryByText('Auditar pagos y movimientos')).not.toBeInTheDocument()
    expect(screen.getByText('Trabajo diario')).toBeVisible()
  })

  it('offers a useful empty search state', () => {
    render(
      <RepairHelpCenter open onOpenChange={vi.fn()} audience="operator" onStartTour={vi.fn()} />,
    )
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'consulta inexistente' } })
    expect(screen.getByText(/no encontramos una guía/i)).toBeVisible()
  })

  it('links the downloadable manual generated for the current guide', () => {
    render(
      <RepairHelpCenter open onOpenChange={vi.fn()} audience="admin" onStartTour={vi.fn()} />,
    )

    expect(screen.getByRole('link', { name: /descargar manual pdf/i })).toHaveAttribute(
      'href',
      '/guides/guia-reparaciones-v1.pdf',
    )
  })
})
