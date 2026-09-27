import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CustomerFormSimple } from '@/components/dashboard/customer-form-simple'

describe('alta rápida de clientes', () => {
  it('muestra el contacto esencial y deja los datos adicionales plegados', () => {
    render(<CustomerFormSimple progressiveDisclosure showStoreInvite onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/^Nombre/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Teléfono \/ WhatsApp/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Correo Electrónico/i)).toBeInTheDocument()
    expect(screen.getByText(/Invitar a la tienda online/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Datos adicionales/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText(/Otro teléfono para avisarle/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Ciudad$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Comercial y Crédito/i)).not.toBeInTheDocument()
  })

  it('permite desplegar y volver a plegar los campos opcionales sin borrar los valores', () => {
    render(<CustomerFormSimple progressiveDisclosure onSubmit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /Datos adicionales/i }))
    expect(screen.getByLabelText(/Otro teléfono para avisarle/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Ciudad$/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Ciudad$/i), { target: { value: 'Luque' } })
    fireEvent.click(screen.getByRole('button', { name: /Datos adicionales/i }))
    fireEvent.click(screen.getByRole('button', { name: /Datos adicionales/i }))
    expect(screen.getByLabelText(/^Ciudad$/i)).toHaveValue('Luque')
  })

  it('conserva el formulario completo en edición', () => {
    render(<CustomerFormSimple onSubmit={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Datos adicionales/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Otro teléfono para avisarle/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Ciudad$/i)).toBeInTheDocument()
  })

  it('permite crear con lo esencial sin asignar una ciudad no elegida', () => {
    const onSubmit = vi.fn()
    render(<CustomerFormSimple progressiveDisclosure onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/^Nombre/i), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText(/Teléfono \/ WhatsApp/i), { target: { value: '0981123456' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar Cliente/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Ana',
      phone: '0981123456',
      city: '',
    }))
  })

  it('no pisa lo escrito cuando el modal vuelve a renderizar', () => {
    const onSubmit = vi.fn()
    const { rerender } = render(
      <CustomerFormSimple progressiveDisclosure initialData={{ firstName: 'Ana' }} onSubmit={onSubmit} />
    )

    fireEvent.change(screen.getByLabelText(/^Nombre/i), { target: { value: 'Anabel' } })
    rerender(<CustomerFormSimple progressiveDisclosure initialData={{ firstName: 'Ana' }} onSubmit={onSubmit} />)

    expect(screen.getByLabelText(/^Nombre/i)).toHaveValue('Anabel')
  })
})
