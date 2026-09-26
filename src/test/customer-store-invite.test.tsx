/**
 * Opción de invitar al cliente a la tienda pública al darlo de alta.
 *
 * El backend ya existía, pero solo se podía usar desde el detalle del cliente:
 * había que crearlo, buscarlo y abrirlo. Esto lo ofrece en el alta, junto al
 * correo, que es donde el usuario ya está pensando en eso.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { CustomerFormSimple, type SimpleCustomerFormData } from '@/components/dashboard/customer-form-simple'

const INVITE_LABEL = /Invitar a la tienda online/i

function renderForm(props: Partial<React.ComponentProps<typeof CustomerFormSimple>> = {}) {
  const onSubmit = vi.fn()
  render(
    <CustomerFormSimple
      showStoreInvite
      onSubmit={onSubmit}
      {...props}
    />
  )
  return { onSubmit }
}

function typeEmail(value: string) {
  fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), { target: { value } })
}

describe('Alta de cliente — invitación a la tienda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('se ve desde el arranque, aunque todavia no haya correo', () => {
    // Si solo apareciera al escribir un correo, nadie que no sepa que existe
    // la encontraria: es exactamente como se reporto que "no estaba".
    renderForm()

    expect(screen.getByText(INVITE_LABEL)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByText(/Cargá un correo arriba/i)).toBeInTheDocument()
  })

  it('se habilita al cargar un correo válido', async () => {
    renderForm()
    typeEmail('cliente@ejemplo.com')

    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
  })

  it('sigue deshabilitada con un correo a medio escribir', () => {
    renderForm()
    typeEmail('cliente@')

    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('vuelve a deshabilitarse si se borra el correo', async () => {
    renderForm()
    typeEmail('cliente@ejemplo.com')
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())

    typeEmail('')

    await waitFor(() => expect(screen.getByRole('checkbox')).toBeDisabled())
  })

  it('muestra a qué correo se va a enviar', async () => {
    renderForm()
    typeEmail('cliente@ejemplo.com')

    expect(await screen.findByText(/cliente@ejemplo\.com/)).toBeInTheDocument()
  })

  it('no se ofrece al editar un cliente existente', () => {
    renderForm({ showStoreInvite: false, initialData: { email: 'cliente@ejemplo.com' } })

    expect(screen.queryByText(INVITE_LABEL)).not.toBeInTheDocument()
  })

  it('arranca desmarcada: invitar es una decisión explícita', async () => {
    renderForm()
    typeEmail('cliente@ejemplo.com')

    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('lleva la elección al submit', async () => {
    const { onSubmit } = renderForm()

    // Hay dos campos de telefono (principal y alternativo): se usa el id.
    fireEvent.change(document.getElementById('firstName')!, { target: { value: 'Ana' } })
    fireEvent.change(document.getElementById('phone')!, { target: { value: '0981123456' } })
    typeEmail('cliente@ejemplo.com')

    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox')).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /Guardar|Crear/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const submitted = onSubmit.mock.calls[0][0] as SimpleCustomerFormData
    expect(submitted.inviteToStore).toBe(true)
    expect(submitted.email).toBe('cliente@ejemplo.com')
  })
})
