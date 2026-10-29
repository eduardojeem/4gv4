import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SubscriptionStatusProvider, type SubscriptionStatusData } from '@/contexts/SubscriptionStatusContext'
import { DEFAULT_SHARED_SETTINGS } from '@/hooks/use-shared-settings'
import { SettingsSetupCard, type SettingsSetupStatus } from './SettingsSetupCard'

const subscription = {
  status: 'active', isBlocked: false, isTrialing: false, trialDaysLeft: null, periodDaysLeft: null,
  planCode: 'BASIC', planName: 'Basic', modules: [], entitledModules: [], enabledModules: [], effectiveModules: [],
  businessVertical: 'clothing', operatingModel: 'retail', downgradedFromExpiry: false, moduleTrials: [], trialedModules: [],
  organizationName: 'Moda Uno', organizationLogoUrl: null, modulePlanAvailability: {},
} as unknown as SubscriptionStatusData

const status: SettingsSetupStatus = {
  onboardingStatus: 'completed',
  branch: { name: 'Casa Central', city: 'Asunción' },
  storefront: { public: false, slug: 'moda-uno' },
  logo: false,
  payments: true,
  products: true,
  hasBusinessData: true,
}

const renderCard = (overrides: Partial<typeof DEFAULT_SHARED_SETTINGS>, setup: SettingsSetupStatus | null = status, onGoTo = vi.fn()) => {
  render(
    <SubscriptionStatusProvider value={subscription}>
      <SettingsSetupCard saved={{ ...DEFAULT_SHARED_SETTINGS, ...overrides }} status={setup} onGoTo={onGoTo} />
    </SubscriptionStatusProvider>,
  )
  return onGoTo
}

describe('SettingsSetupCard', () => {
  it('muestra lo que dejó el onboarding y lo que falta', () => {
    renderCard({ companyName: 'Moda Uno', countryCode: 'PY' as never, companyPhone: '0981', companyAddress: 'Ruta 1', city: 'Asunción' })

    expect(screen.getByText('Moda Uno')).toBeInTheDocument()
    expect(screen.getByText('Paraguay · PYG')).toBeInTheDocument()
    expect(screen.getByText('Ropa y moda')).toBeInTheDocument()
    expect(screen.getByText('Casa Central · Asunción')).toBeInTheDocument()
    expect(screen.getByText('Sin publicar')).toBeInTheDocument()

    const pending = screen.getByRole('list', { name: 'Datos pendientes' })
    expect(pending).toHaveTextContent('Email del negocio')
    expect(pending).toHaveTextContent('RUC para tus comprobantes')
    expect(pending).toHaveTextContent('Subí tu logo')
    expect(pending).toHaveTextContent('Publicá tu tienda online')
    expect(pending).not.toHaveTextContent('Teléfono de contacto')
    expect(pending).not.toHaveTextContent('Elegí cómo te pagan')
    expect(screen.getByText('5 de 9 listos')).toBeInTheDocument()
  })

  it('lleva al campo que falta', async () => {
    const user = userEvent.setup()
    const onGoTo = renderCard({ countryCode: 'PY' as never })
    await user.click(screen.getByRole('button', { name: /RUC para tus comprobantes/ }))
    expect(onGoTo).toHaveBeenCalledWith('fiscal', 'companyRuc')
  })

  it('invita a retomar la configuración inicial si quedó a medias', () => {
    renderCard({}, { ...status, onboardingStatus: 'in_progress' })
    expect(screen.getByRole('link', { name: 'Continuar configuración inicial' })).toHaveAttribute('href', '/admin/onboarding')
  })
})
