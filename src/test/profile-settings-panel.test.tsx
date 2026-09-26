import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProfileSettingsPanel } from '@/components/profile/profile-settings-panel'

describe('ProfileSettingsPanel', () => {
  it('separa la configuración personal de la configuración de la tienda', () => {
    render(<ProfileSettingsPanel hasStore />)

    expect(screen.getByRole('heading', { name: 'Configuración de mi cuenta' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Datos y ubicación/i })).toHaveAttribute('href', '#datos-personales')
    expect(screen.getByText(/panel de la tienda/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cambiar contraseña/i })).toBeInTheDocument()
  })
})
