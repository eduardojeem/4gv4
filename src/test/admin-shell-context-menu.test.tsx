import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { AdminShell } from '@/components/admin/layout/admin-shell'
import { AdminLayoutProvider } from '@/contexts/AdminLayoutContext'
import { AppStateProvider } from '@/contexts/app-state-context'
import { BranchProvider } from '@/contexts/branch-context'
import { ThemeProvider } from '@/contexts/theme-context'
import { server } from '@/test/mocks/server'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: null,
    hasPermission: () => true,
    isAdmin: true,
  }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users',
  useRouter: () => ({ refresh: vi.fn() }),
}))

describe('AdminShell contextual menu', () => {
  it('renders refresh action and invokes callback', async () => {
    const onContextAction = vi.fn()
    const user = userEvent.setup()
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver
    server.use(
      http.get('/api/organizations', () => HttpResponse.json({
        organizations: [],
        activeOrganization: null,
      }))
    )

    render(
      <ThemeProvider>
        <AppStateProvider>
          <BranchProvider>
            <AdminLayoutProvider>
              <AdminShell
                active="users"
                onNavigate={() => {}}
                onContextAction={onContextAction}
              >
                <div>Contenido</div>
              </AdminShell>
            </AdminLayoutProvider>
          </BranchProvider>
        </AppStateProvider>
      </ThemeProvider>
    )

    // Open menu
    const trigger = screen.getByLabelText('Acciones de sección')
    await user.click(trigger)

    // Refresh item should be visible
    const refreshItem = await screen.findByText('Refrescar sección')
    expect(refreshItem).toBeInTheDocument()

    // Click refresh
    await user.click(refreshItem)
    expect(onContextAction).toHaveBeenCalledWith('refresh')
  })
})
