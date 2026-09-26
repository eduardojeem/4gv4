import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProfileForm } from '@/components/profile/profile-form'

describe('ProfileForm', () => {
  it('asocia los campos y muestra el error contextual del teléfono', () => {
    render(<ProfileForm
      name="Ana"
      phone="123"
      email="ana@example.com"
      location="Encarnación"
      errors={{ phone: 'Ingresá un teléfono válido' }}
      isDirty
      loading={false}
      onNameChange={vi.fn()}
      onPhoneChange={vi.fn()}
      onLocationChange={vi.fn()}
      onSubmit={vi.fn()}
    />)

    expect(screen.getByRole('heading', { name: 'Información personal' })).toBeInTheDocument()
    expect(screen.getByLabelText('Teléfono / WhatsApp')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled()
    expect(screen.getByText('Ingresá un teléfono válido')).toBeInTheDocument()
  })
})
