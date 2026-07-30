import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MaintenanceGuard } from '@/components/public/MaintenanceGuard'
import { applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'

const useWebsiteSettingsMock = vi.fn()

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => useWebsiteSettingsMock(),
}))

vi.mock('@/components/public/MaintenancePage', () => ({
  MaintenancePage: () => <div>Modo mantenimiento</div>,
}))

describe('MaintenanceGuard', () => {
  beforeEach(() => {
    useWebsiteSettingsMock.mockReset()
  })

  it('renders the storefront from server settings while the client revalidates', () => {
    useWebsiteSettingsMock.mockReturnValue({
      settings: null,
      isLoading: true,
      error: null,
    })

    render(
      <MaintenanceGuard initialSettings={applyWebsiteSettingsDefaults({})}>
        <div>Catalogo de productos</div>
      </MaintenanceGuard>,
    )

    expect(screen.getByText('Catalogo de productos')).toBeInTheDocument()
    expect(screen.queryByText(/Cargando configuraci/i)).not.toBeInTheDocument()
  })

  it('honors maintenance mode from the server snapshot', () => {
    useWebsiteSettingsMock.mockReturnValue({
      settings: null,
      isLoading: true,
      error: null,
    })

    const initialSettings = applyWebsiteSettingsDefaults({
      maintenance_mode: {
        enabled: true,
        title: 'Mantenimiento',
        message: 'Volvemos pronto',
        showEstimatedTime: false,
        estimatedTime: '',
        showContactInfo: false,
      },
    })

    render(
      <MaintenanceGuard initialSettings={initialSettings}>
        <div>Catalogo de productos</div>
      </MaintenanceGuard>,
    )

    expect(screen.getByText('Modo mantenimiento')).toBeInTheDocument()
    expect(screen.queryByText('Catalogo de productos')).not.toBeInTheDocument()
  })
})
