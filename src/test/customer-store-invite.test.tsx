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

  it('no ofrece la invitación mientras no haya correo', () => {
    renderForm()

    expect(screen.queryByText(INVITE_LABEL)).not.toBeInTheDocument()
  })

  it('aparece al cargar un correo válido', async () => {
    renderForm()
    typeEmail('cliente@ejemplo.com')

    expect(await screen.findByText(INVITE_LABEL)).toBeInTheDocument()
  })

  it('no aparece con un correo a medio escribir', () => {
    renderForm()
    typeEmail('cliente@')

    expect(screen.queryByText(INVITE_LABEL)).not.toBeInTheDocument()
  })

  it('desaparece si se borra el correo', async () => {
    renderForm()
    typeEmail('cliente@ejemplo.com')
    await screen.findByText(INVITE_LABEL)

    typeEmail('')

    await waitFor(() => expect(screen.queryByText(INVITE_LABEL)).not.toBeInTheDocument())
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

    await screen.findByText(INVITE_LABEL)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('lleva la elección al submit', async () => {
    const { onSubmit } = renderForm()

    // Hay dos campos de telefono (principal y alternativo): se usa el id.
    fireEvent.change(document.getElementById('firstName')!, { target: { value: 'Ana' } })
    fireEvent.change(document.getElementById('phone')!, { target: { value: '0981123456' } })
    typeEmail('cliente@ejemplo.com')

    await screen.findByText(INVITE_LABEL)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('checkbox')).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: /Guardar|Crear/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const submitted = onSubmit.mock.calls[0][0] as SimpleCustomerFormData
    expect(submitted.inviteToStore).toBe(true)
    expect(submitted.email).toBe('cliente@ejemplo.com')
  })
})
