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
function llamadaDeGuardado(fetchMock: { mock: { calls: unknown[][] } }) {
  const call = fetchMock.mock.calls.find(([, rawInit]) => {
    const init = rawInit as RequestInit | undefined
    return init?.method === 'POST' || init?.method === 'PUT'
  })
  expect(call, 'no se llamo a guardar').toBeDefined()
  const init = call![1] as RequestInit
  return { method: init.method as string, body: JSON.parse(init.body as string) }
}

describe('CustomerQuickCreateDialog', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('separa nombre y apellido, capitaliza al escribir y guarda el nombre completo', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: {
        id: 'cust-persona-1',
        name: 'Juan Pérez-De La Cruz',
        first_name: 'Juan',
        last_name: 'Pérez-De La Cruz',
        phone: '0981123456',
      },
    }, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<CustomerQuickCreateDialog open onClose={vi.fn()} onCreated={vi.fn()} />)

    const nombre = screen.getByLabelText(/^Nombre/i)
    const apellido = screen.getByLabelText(/^Apellido/i)
    await user.type(nombre, 'juan')
    await user.type(apellido, 'pérez-de la cruz')
    await user.type(screen.getByLabelText(/^Teléfono/i), '0981123456')

    expect(nombre).toHaveValue('Juan')
    expect(apellido).toHaveValue('Pérez-De La Cruz')

    await user.click(screen.getByRole('button', { name: /Crear Cliente/i }))

    await waitFor(() => expect(llamadaDeGuardado(fetchMock).method).toBe('POST'))
    expect(llamadaDeGuardado(fetchMock).body).toMatchObject({
      first_name: 'Juan',
      last_name: 'Pérez-De La Cruz',
      name: 'Juan Pérez-De La Cruz',
    })
  })

  it('permite agregar la empresa solamente cuando el cliente es mayorista', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      data: {
        id: 'cust-mayorista-1',
        name: 'Ana Gómez',
        first_name: 'Ana',
        last_name: 'Gómez',
        company_name: 'Deportes Central S.A.',
        phone: '0981123456',
        customer_type: 'wholesale',
      },
    }, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<CustomerQuickCreateDialog open onClose={vi.fn()} onCreated={vi.fn()} />)

    expect(screen.queryByLabelText(/Empresa \/ razón social/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Tarifa Mayorista/i }))

    await user.type(screen.getByLabelText(/^Nombre/i), 'ana')
    await user.type(screen.getByLabelText(/^Apellido/i), 'gómez')
    await user.type(screen.getByLabelText(/Empresa \/ razón social/i), 'deportes central s.a.')
    await user.type(screen.getByLabelText(/^Teléfono/i), '0981123456')
    await user.click(screen.getByRole('button', { name: /Crear Cliente/i }))

    await waitFor(() => expect(llamadaDeGuardado(fetchMock).method).toBe('POST'))
    expect(llamadaDeGuardado(fetchMock).body).toMatchObject({
      company_name: 'Deportes Central S.A.',
      customer_type: 'wholesale',
      is_wholesale: true,
    })
  })

  it('no crea un cliente sin teléfono', async () => {
    // Sin telefono la mitad de las funciones no sirven: no hay forma de avisarle
    // que su equipo esta listo.
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<CustomerQuickCreateDialog open onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByLabelText(/^Nombre/i), 'Ana')
    await user.type(screen.getByLabelText(/^Apellido/i), 'Pérez')
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

    await user.type(screen.getByLabelText(/^Nombre/i), 'Ana')
    await user.type(screen.getByLabelText(/^Apellido/i), 'Pérez')
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

    await user.type(screen.getByLabelText(/^Nombre/i), 'Ana')
    await user.type(screen.getByLabelText(/^Apellido/i), 'Pérez')
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

  it('normaliza el nombre y cierra el modal después de crear el cliente', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onCreated = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({
        success: true,
        data: { id: 'cust-2', name: 'Juan Pérez-De La Cruz', phone: '0981123456' },
      }, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<CustomerQuickCreateDialog open onClose={onClose} onCreated={onCreated} />)

    await user.type(screen.getByLabelText(/^Nombre/i), 'juan pérez-de la cruz')
    await user.type(screen.getByLabelText(/^Teléfono/i), '0981123456')
    await user.click(screen.getByRole('button', { name: /Crear Cliente/i }))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(llamadaDeGuardado(fetchMock).body.name).toBe('Juan Pérez-De La Cruz')
    expect(onClose).toHaveBeenCalledTimes(1)
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

  it('separa el nombre completo de clientes anteriores al editarlos', async () => {
    render(
      <CustomerQuickCreateDialog
        open
        onClose={vi.fn()}
        customerToEdit={{ id: 'c-9', name: 'Carlos Benítez López', phone: '0981123456' }}
      />
    )

    await waitFor(() => expect(screen.getByLabelText(/^Nombre/i)).toHaveValue('Carlos'))
    expect(screen.getByLabelText(/^Apellido/i)).toHaveValue('Benítez López')
  })

  it('detecta cliente existente por teléfono o RUC y permite seleccionarlo para la reparación', async () => {
    const user = userEvent.setup()
    const onSelectExisting = vi.fn()
    const onClose = vi.fn()

    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/customers/check-duplicate')) {
        return jsonResponse({
          success: true,
          duplicates: [
            {
              field: 'phone',
              value: '0981123456',
              customerId: 'cust-existente-1',
              customerName: 'María Gómez',
              phone: '0981123456',
              ruc: '4567890',
              customerCode: 'CLI-00456',
              customerType: 'wholesale',
              isWholesale: true,
            },
          ],
        })
      }
      return jsonResponse({ success: true, data: {} })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CustomerQuickCreateDialog
        open
        onClose={onClose}
        onCreated={vi.fn()}
        onSelectExisting={onSelectExisting}
      />
    )

    await user.type(screen.getByLabelText(/^Teléfono/i), '0981123456')

    // Debe mostrar la tarjeta de cliente registrado encontrado con su nombre y RUC
    expect(await screen.findByText(/Cliente Registrado Encontrado/i)).toBeInTheDocument()
    expect(screen.getAllByText('María Gómez').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/CLI-00456/i)).toBeInTheDocument()
    expect(screen.getByText(/4567890/i)).toBeInTheDocument()

    // El botón para usar este cliente en la reparación
    const btnUsar = screen.getByRole('button', { name: /Usar este cliente en la reparación/i })
    expect(btnUsar).toBeInTheDocument()

    await user.click(btnUsar)

    expect(onSelectExisting).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cust-existente-1',
        name: 'María Gómez',
        phone: '0981123456',
        ruc: '4567890',
        customerCode: 'CLI-00456',
        is_wholesale: true,
      })
    )
    expect(onClose).toHaveBeenCalled()
  })
})
