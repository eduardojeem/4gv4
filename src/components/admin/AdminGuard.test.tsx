import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminGuard } from './AdminGuard'

vi.mock('../../contexts/auth-context', () => {
  return {
    useAuth: () => ({ user: { id: 'u1' }, loading: false, isAdmin: true })
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

describe('AdminGuard', () => {
  it('renders children for admin users', () => {
    render(
      <AdminGuard>
        <div>Contenido Admin</div>
      </AdminGuard>
    )
    expect(screen.getByText('Contenido Admin')).toBeInTheDocument()
  })
})
