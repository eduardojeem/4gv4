import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SetupGuide } from '@/components/admin/website/SetupGuide'

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({ settings: {}, isLoading: false }),
}))

describe('Website setup guide', () => {
  it('starts collapsed even when a previous visit saved it expanded', () => {
    localStorage.setItem('website-setup-guide-collapsed', 'false')
    const onTabChange = vi.fn()
    const { unmount } = render(<SetupGuide activeTab="hero" onTabChange={onTabChange} />)
    expect(screen.getByRole('button', { name: 'Expandir guía' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /Datos de Empresa/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expandir guía' }))
    fireEvent.click(screen.getByRole('button', { name: /Datos de Empresa/ }))
    expect(onTabChange).toHaveBeenCalledWith('company')
    fireEvent.click(screen.getByRole('button', { name: 'Contraer guía' }))
    expect(screen.queryByRole('button', { name: /Datos de Empresa/ })).not.toBeInTheDocument()
    unmount()
    localStorage.removeItem('website-setup-guide-collapsed')
  })
})
