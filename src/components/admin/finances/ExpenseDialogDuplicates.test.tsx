import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ExpenseDialog } from './ExpenseDialog'

const uuid = '11111111-1111-4111-8111-111111111111'

function fillAndGetForm() {
  render(<ExpenseDialog open onOpenChange={vi.fn()} organizationId={uuid} branchId={uuid} categories={[{ id: uuid, name: 'Alquiler' }]} onSaved={vi.fn()} />)
  fireEvent.change(screen.getByLabelText(/Concepto/), { target: { value: 'Alquiler del local' } })
  fireEvent.change(screen.getByLabelText(/Importe/), { target: { value: '1400000' } })
  fireEvent.change(screen.getByLabelText(/Categoría/), { target: { value: uuid } })
  return screen.getByLabelText(/Concepto/).closest('form') as HTMLFormElement
}

afterEach(() => { vi.unstubAllGlobals() })

describe('formulario de gasto: envíos repetidos', () => {
  it('dos envíos seguidos (doble clic o Enter repetido) mandan el gasto una sola vez', async () => {
    let answer!: (response: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { answer = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    const form = fillAndGetForm()

    fireEvent.submit(form)
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => { answer(new Response(JSON.stringify({ obligation: { id: 'o1' } }), { status: 201 })) })
  })

  it('sin conexión avisa, libera el botón y el reintento usa la misma clave', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ obligation: { id: 'o1' } }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const form = fillAndGetForm()

    await act(async () => { fireEvent.submit(form) })
    expect(await screen.findByText(/Sin conexión con el servidor/)).toBeInTheDocument()

    await act(async () => { fireEvent.submit(form) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const key = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>)['x-idempotency-key']
    expect(key(fetchMock.mock.calls[1])).toBe(key(fetchMock.mock.calls[0]))
  })
})
