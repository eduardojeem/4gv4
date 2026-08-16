import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RepairHelpTour } from './RepairHelpTour'
import type { RepairGuideTask } from './repairs-guide'

const task: RepairGuideTask = {
  id: 'create-repair', title: 'Crear una reparación', summary: 'Ingreso guiado',
  keywords: [], audiences: ['admin'], icon: 'plus',
  steps: [
    { title: 'Iniciá la orden', body: 'Abrí el formulario.', action: 'Abrir', anchorId: 'repair-new', fallback: 'Buscá el botón en el encabezado.' },
    { title: 'Completá el equipo', body: 'Cargá los datos.', action: 'Completar', anchorId: 'missing-anchor', fallback: 'Completá cliente, equipo y falla.' },
  ],
}

describe('RepairHelpTour', () => {
  afterEach(() => document.querySelector('[data-help-id="repair-new"]')?.remove())

  it('highlights a live anchor and cleans it when closed', () => {
    const anchor = document.createElement('button')
    anchor.dataset.helpId = 'repair-new'
    anchor.textContent = 'Nueva reparación'
    document.body.appendChild(anchor)

    const { rerender } = render(<RepairHelpTour task={task} open onOpenChange={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: /recorrido crear una reparación/i })).toHaveTextContent('Iniciá la orden')
    expect(anchor).toHaveAttribute('data-help-active', 'true')

    rerender(<RepairHelpTour task={task} open={false} onOpenChange={vi.fn()} />)
    expect(anchor).not.toHaveAttribute('data-help-active')
  })

  it('shows the textual fallback when the next anchor is absent', () => {
    render(<RepairHelpTour task={task} open onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(screen.getByText('Completá cliente, equipo y falla.')).toBeVisible()
    expect(screen.getByText(/elemento no disponible/i)).toBeVisible()
  })

  it('finishes the tour without trapping the user', () => {
    const onComplete = vi.fn()
    const onOpenChange = vi.fn()
    render(<RepairHelpTour task={{ ...task, steps: [task.steps[0]] }} open onOpenChange={onOpenChange} onComplete={onComplete} />)
    fireEvent.click(screen.getByRole('button', { name: /finalizar/i }))
    expect(onComplete).toHaveBeenCalledWith('create-repair')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
