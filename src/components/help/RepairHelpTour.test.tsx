import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RepairHelpTour } from './RepairHelpTour'
import type { RepairGuideTask } from './repairs-guide'
import { RepairHelpActionsProvider } from './repair-help-actions'

const task: RepairGuideTask = {
  id: 'create-repair', title: 'Crear una reparación', summary: 'Ingreso guiado',
  keywords: [], audiences: ['admin'], icon: 'plus',
  steps: [
    { title: 'Iniciá la orden', body: 'Abrí el formulario.', action: 'Abrir', anchorId: 'repair-new', fallback: 'Buscá el botón en el encabezado.' },
    { title: 'Completá el equipo', body: 'Cargá los datos.', action: 'Completar', anchorId: 'missing-anchor', fallback: 'Completá cliente, equipo y falla.' },
  ],
}

describe('RepairHelpTour', () => {
  afterEach(() => document.querySelectorAll('[data-help-id]').forEach(element => element.remove()))

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

  it('opens a required surface, waits for its anchor and advances', async () => {
    const actionableTask: RepairGuideTask = {
      ...task,
      steps: [
        {
          ...task.steps[0],
          navigationAction: {
            id: 'open-new-repair',
            label: 'Abrir nueva reparación',
            successAnchorId: 'repair-form-device',
          },
        },
        { ...task.steps[1], anchorId: 'repair-form-device' },
      ],
    }
    let calls = 0
    const execute = vi.fn(async () => {
      calls += 1
      const anchor = document.createElement('div')
      anchor.dataset.helpId = 'repair-form-device'
      document.body.append(anchor)
      return { status: 'completed' as const }
    })

    render(
      <RepairHelpActionsProvider execute={execute}>
        <RepairHelpTour task={actionableTask} open onOpenChange={vi.fn()} />
      </RepairHelpActionsProvider>,
    )
    const action = screen.getByRole('button', { name: 'Abrir nueva reparación' })
    fireEvent.click(action)
    fireEvent.click(action)

    await waitFor(() => expect(screen.getByText('Completá el equipo')).toBeVisible())
    expect(calls).toBe(1)
  })

  it('keeps the current step and announces why an action is unavailable', async () => {
    const actionableTask: RepairGuideTask = {
      ...task,
      steps: [{
        ...task.steps[0],
        navigationAction: { id: 'open-repair-payment', label: 'Abrir pago' },
      }],
    }

    render(
      <RepairHelpActionsProvider execute={() => ({
        status: 'unavailable',
        message: 'Elegí una reparación primero.',
      })}>
        <RepairHelpTour task={actionableTask} open onOpenChange={vi.fn()} />
      </RepairHelpActionsProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir pago' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Elegí una reparación primero.')
    expect(screen.getByText('Iniciá la orden')).toBeVisible()
  })
})
