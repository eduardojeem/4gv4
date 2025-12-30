import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminShell } from '@/components/admin/layout/admin-shell'

describe('AdminShell contextual menu', () => {
  it('renders refresh action and invokes callback', async () => {
    const onContextAction = vi.fn()
    render(
      <AdminShell
        active="users"
        onNavigate={() => {}}
        onContextAction={onContextAction}
      >
        <div>Contenido</div>
      </AdminShell>
    )

    // Open menu
    const trigger = screen.getByLabelText('Acciones de sección')
    await userEvent.click(trigger)

    // Refresh item should be visible
    const refreshItem = await screen.findByText('Refrescar sección')
    expect(refreshItem).toBeInTheDocument()

    // Click refresh
    await userEvent.click(refreshItem)
    expect(onContextAction).toHaveBeenCalledWith('refresh')
  })
})