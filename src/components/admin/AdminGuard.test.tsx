import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
let AdminGuard: any

vi.mock('../../contexts/auth-context', () => {
  return {
    useAuth: () => ({ user: { id: 'u1' }, loading: false, isAdmin: true })
  }
})

describe('AdminGuard', () => {
  beforeEach(async () => {
    const mod = await import('../../modules/admin/components/AdminGuard')
    AdminGuard = mod.default
  })
  it('renders children for admin users', () => {
    const { container } = render(
      <AdminGuard>
        <div data-testid="admin-content">Contenido Admin</div>
      </AdminGuard>
    )
    expect(container.querySelector('[data-testid="admin-content"]')).toBeTruthy()
  })
})