import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { UsersHelpDialog } from './users-help-dialog'

describe('UsersHelpDialog', () => {
  it('opens an accessible guide with role and workflow examples', async () => {
    const user = userEvent.setup()
    render(<UsersHelpDialog />)

    await user.click(screen.getByRole('button', { name: 'Cómo funciona' }))

    expect(screen.getByRole('dialog', { name: 'Cómo funciona la gestión de usuarios' })).toBeInTheDocument()
    expect(screen.getByText(/María es propietaria/i)).toBeInTheDocument()
    expect(screen.getByText(/Pedro es administrador/i)).toBeInTheDocument()
    expect(screen.getByText(/Laura trabaja como vendedora/i)).toBeInTheDocument()
    expect(screen.getByText(/Carlos es técnico/i)).toBeInTheDocument()
  })

  it('explains the owner protection and how plan seats are released', async () => {
    const user = userEvent.setup()
    render(<UsersHelpDialog />)

    await user.click(screen.getByRole('button', { name: 'Cómo funciona' }))

    expect(screen.getByText(/no puede editarse ni desactivarse desde esta sección/i)).toBeInTheDocument()
    expect(screen.getByText(/suspender a un integrante libera su cupo/i)).toBeInTheDocument()
  })
})
