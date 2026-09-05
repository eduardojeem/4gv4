/**
 * Alta y edicion rapida de cliente, ahora en un solo dialogo.
 *
 * Estas pruebas venian de `QuickCustomerModal`, el segundo dialogo que hacia lo
 * mismo dentro de reparaciones. Se portaron enteras al unificar: son las reglas
 * que no se pueden perder en la mudanza —telefono obligatorio, aclarar de quien
 * es el alternativo, y que la edicion cargue y guarde lo que se toco—.
 *
 * Lo unico que cambio es donde aparece el error: el dialogo viejo avisaba con un
 * toast, este lo muestra debajo del campo que hay que corregir.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CustomerQuickCreateDialog } from '../CustomerQuickCreateDialog'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

/**
 * La llamada que guarda, no la primera que hubo. El dialogo tambien consulta si
 * el telefono ya existe mientras se escribe, asi que mirar `calls[0]` dependia
 * de si ese aviso alcanzo a salir antes: una prueba que pasa o falla segun lo
 * rapido que escriba el runner.
 */
function llamadaDeGuardado(fetchMock: { mock: { calls: any[][] } }) {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST' || init?.method === 'PUT')
  expect(call, 'no se llamo a guardar').toBeDefined()
  return { method: call![1].method as string, body: JSON.parse(call![1].body as string) }
}

describe('CustomerQuickCreateDialog', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('no crea un cliente sin teléfono', async () => {
    // Sin telefono la mitad de las funciones no sirven: no hay forma de avisarle
    // que su equipo esta listo.
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<CustomerQuickCreateDialog open onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByLabelText(/Nombre o razón social/i), 'Ana Pérez')
    await user.click(screen.getByRole('button', { name: /Crear Cliente/i }))

    expect(await screen.findByText(/tel[eé]fono debe tener al menos/i)).toBeInTheDocument()
    // Puede haber salido la consulta de duplicados; lo que no puede haber es un guardado.
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('exige aclarar de quién es el teléfono alternativo', async () => {
    // Un numero suelto no le sirve a quien llama: no sabe con quien va a hablar.
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<CustomerQuickCreateDialog open onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByLabelText(/Nombre o razón social/i), 'Ana Pérez')
    await user.type(screen.getByLabelText(/^Teléfono/i), '0981123456')
    await user.type(screen.getByLabelText(/Otro tel[eé]fono/i), '0982999999')
    await user.click(screen.getByRole('button', { name: /Crear Cliente/i }))

    expect(await screen.findByText(/qui[eé]n es el tel[eé]fono/i)).toBeInTheDocument()
    // Puede haber salido la consulta de duplicados; lo que no puede haber es un guardado.
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('manda el contacto alternativo para poder avisarle al cliente', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { id: 'cust-1', name: 'Ana Pérez' } }, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<CustomerQuickCreateDialog open onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByLabelText(/Nombre o razón social/i), 'Ana Pérez')
    await user.type(screen.getByLabelText(/^Teléfono/i), '0981123456')
    await user.type(screen.getByLabelText(/Otro tel[eé]fono/i), '0982999999')
    await user.type(screen.getByLabelText(/qui[eé]n es ese tel[eé]fono/i), 'Hermana')
    await user.click(screen.getByRole('button', { name: /Crear Cliente/i }))

    await waitFor(() => expect(llamadaDeGuardado(fetchMock).method).toBe('POST'))
    expect(llamadaDeGuardado(fetchMock).body).toMatchObject({
      name: 'Ana Pérez',
      phone: '0981123456',
      alternate_phone: '0982999999',
      alternate_phone_label: 'Hermana',
    })
  })

  it('carga y guarda los cambios al editar', async () => {
    const user = userEvent.setup()
    const onUpdated = vi.fn()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: {
        id: 'cust-123',
        name: 'Carlos Benítez',
        phone: '0981777888',
        email: 'carlos@example.com',
        ruc: '80012345-6',
        customer_type: 'regular',
      },
    }, 200))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CustomerQuickCreateDialog
        open
        customerToEdit={{
          id: 'cust-123',
          name: 'Carlos Benítez',
          phone: '0981777888',
          email: 'carlos@example.com',
          ruc: '444555-1',
        }}
        onClose={vi.fn()}
        onUpdated={onUpdated}
      />
    )

    const rucInput = await screen.findByLabelText(/RUC \/ C\.I\./i) as HTMLInputElement
    await waitFor(() => expect(rucInput.value).toBe('444555-1'))

    await user.clear(rucInput)
    await user.type(rucInput, '80012345-6')
    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }))

    await waitFor(() => expect(llamadaDeGuardado(fetchMock).method).toBe('PUT'))
    expect(llamadaDeGuardado(fetchMock).body).toMatchObject({
      id: 'cust-123',
      name: 'Carlos Benítez',
      ruc: '80012345-6',
    })
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({
      id: 'cust-123',
      ruc: '80012345-6',
    }))
  })

  it('el nombre de una empresa no se parte en dos campos', async () => {
    // El dialogo pedia nombre y apellido por separado. Una razon social no tiene
    // apellido, y partirla para editarla y volver a unirla al guardar reordenaba
    // lo que la persona habia escrito.
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, data: { id: 'c-9' } }, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<CustomerQuickCreateDialog open onClose={vi.fn()} onCreated={vi.fn()} />)

    expect(screen.queryByLabelText(/^Apellido/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nombre o razón social/i), 'Comercial San Miguel S.A.')
    await user.type(screen.getByLabelText(/^Teléfono/i), '0981123456')
    await user.click(screen.getByRole('button', { name: /Crear Cliente/i }))

    await waitFor(() => expect(llamadaDeGuardado(fetchMock).method).toBe('POST'))
    expect(llamadaDeGuardado(fetchMock).body.name).toBe('Comercial San Miguel S.A.')
  })
})
