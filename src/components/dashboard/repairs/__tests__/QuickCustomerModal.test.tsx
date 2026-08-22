import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QuickCustomerModal } from '../QuickCustomerModal'

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (message: string) => toastError(message),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

describe('QuickCustomerModal', () => {
  beforeEach(() => {
    toastError.mockClear()
  })

  // Es el alta que vive dentro del modal de nueva reparacion. Se quedo afuera
  // cuando se unificaron las reglas de contacto: pedia solo el nombre, asi que
  // seguia dejando entrar clientes sin telefono.
  it('refuses to create a customer without a phone', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<QuickCustomerModal open onClose={vi.fn()} onCustomerCreated={vi.fn()} />)

    await user.type(screen.getByLabelText(/Nombre/i), 'Ana Pérez')
    await user.click(screen.getByRole('button', { name: /Crear|Guardar/i }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastError.mock.calls[0][0]).toMatch(/tel[eé]fono/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('demands saying whose the alternate phone is', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<QuickCustomerModal open onClose={vi.fn()} onCustomerCreated={vi.fn()} />)

    await user.type(screen.getByLabelText(/Nombre/i), 'Ana Pérez')
    await user.type(screen.getByLabelText(/Tel[eé]fono \/ WhatsApp/i), '0981123456')
    await user.type(screen.getByLabelText(/Otro tel[eé]fono/i), '0982999999')
    await user.click(screen.getByRole('button', { name: /Crear|Guardar/i }))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastError.mock.calls[0][0]).toMatch(/qui[eé]n/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the alternate contact so the shop can reach the customer', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { id: 'cust-1', name: 'Ana Pérez' } }, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<QuickCustomerModal open onClose={vi.fn()} onCustomerCreated={vi.fn()} />)

    await user.type(screen.getByLabelText(/Nombre/i), 'Ana Pérez')
    await user.type(screen.getByLabelText(/Tel[eé]fono \/ WhatsApp/i), '0981123456')
    await user.type(screen.getByLabelText(/Otro tel[eé]fono/i), '0982999999')
    await user.type(screen.getByLabelText(/qui[eé]n es ese tel[eé]fono/i), 'Hermana')
    await user.click(screen.getByRole('button', { name: /Crear|Guardar/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      phone: '0981123456',
      alternate_phone: '0982999999',
      alternate_phone_label: 'Hermana',
    })
  })

  it('populates and saves updated RUC when editing a customer', async () => {
    const user = userEvent.setup()
    const onCustomerUpdated = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({
        success: true,
        data: {
          id: 'cust-123',
          name: 'Carlos Benítez',
          phone: '0981777888',
          email: 'carlos@example.com',
          ruc: '80012345-6',
          customer_type: 'regular'
        }
      }, 200))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <QuickCustomerModal
        open
        customerToEdit={{
          id: 'cust-123',
          name: 'Carlos Benítez',
          phone: '0981777888',
          email: 'carlos@example.com',
          ruc: '444555-1',
        }}
        onClose={vi.fn()}
        onCustomerUpdated={onCustomerUpdated}
      />
    )

    const rucInput = screen.getByLabelText(/RUC \/ C\.I\./i) as HTMLInputElement
    expect(rucInput.value).toBe('444555-1')

    await user.clear(rucInput)
    await user.type(rucInput, '80012345-6')
    await user.click(screen.getByRole('button', { name: /Guardar Cambios|Actualizar/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      id: 'cust-123',
      name: 'Carlos Benítez',
      ruc: '80012345-6',
    })
    expect(onCustomerUpdated).toHaveBeenCalledWith(expect.objectContaining({
      id: 'cust-123',
      ruc: '80012345-6',
    }))
  })
})
