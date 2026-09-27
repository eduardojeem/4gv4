import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DashboardLayoutProvider, useDashboardLayout } from './DashboardLayoutContext'

function LayoutStateProbe() {
  const { sidebarCollapsed, toggleSidebar } = useDashboardLayout()

  return (
    <button type="button" onClick={toggleSidebar}>
      {sidebarCollapsed ? 'collapsed' : 'expanded'}
    </button>
  )
}

describe('DashboardLayoutProvider', () => {
  it('starts collapsed even when an old preference says expanded', () => {
    localStorage.setItem('dashboard-sidebar-collapsed', 'false')

    render(<DashboardLayoutProvider><LayoutStateProbe /></DashboardLayoutProvider>)

    expect(screen.getByRole('button')).toHaveTextContent('collapsed')
  })

  it('keeps toggles during the mount and resets to collapsed on a new mount', () => {
    const first = render(<DashboardLayoutProvider><LayoutStateProbe /></DashboardLayoutProvider>)

    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveTextContent('expanded')

    first.unmount()
    render(<DashboardLayoutProvider><LayoutStateProbe /></DashboardLayoutProvider>)
    expect(screen.getByRole('button')).toHaveTextContent('collapsed')
  })
})
