import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminBreadcrumbs from './AdminBreadcrumbs'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users'
}))

describe('AdminBreadcrumbs', () => {
  it('shows path trail segments', () => {
    render(<AdminBreadcrumbs />)
    expect(screen.getByText('users')).toBeInTheDocument()
  })
})