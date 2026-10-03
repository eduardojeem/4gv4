import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SubscriptionStatusProvider, type SubscriptionStatusData } from '@/contexts/SubscriptionStatusContext'
import { BusinessProfileCard } from './BusinessProfileCard'

const status: SubscriptionStatusData = {
  status: 'active',
  isBlocked: false,
  isTrialing: false,
  trialDaysLeft: null,
  periodDaysLeft: null,
  planCode: 'BASIC',
  planName: 'Basic',
  modules: ['inventory', 'pos', 'crm'],
  entitledModules: ['inventory', 'pos', 'crm'],
  enabledModules: ['inventory', 'pos', 'crm'],
  effectiveModules: ['inventory', 'pos', 'crm'],
  businessVertical: 'clothing',
  operatingModel: 'retail',
  downgradedFromExpiry: false,
  moduleTrials: [],
  trialedModules: [],
  organizationName: 'Moda Uno',
  organizationLogoUrl: null,
  modulePlanAvailability: {
    delivery: [{ name: 'Enterprise', isActive: false }],
    repairs: [
      { name: 'Basic', isActive: true },
      { name: 'Pro', isActive: true },
      { name: 'Enterprise', isActive: false },
    ],
  },
}

describe('BusinessProfileCard', () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('explains the business profile and distinguishes unavailable repairs', () => {
    render(
      <SubscriptionStatusProvider value={status}>
        <BusinessProfileCard />
      </SubscriptionStatusProvider>,
    )

    expect(screen.getByText('Perfil y módulos del negocio')).toBeInTheDocument()
    expect(screen.getByText('Rubro actual')).toBeInTheDocument()
    expect(screen.getByTestId('current-business-vertical')).toHaveTextContent('Ropa y moda')
    expect(screen.getByTestId('current-operating-model')).toHaveTextContent('Venta minorista')
    expect(screen.getByLabelText('Rubro')).toHaveTextContent('Ropa y moda')
    expect(screen.getByLabelText('Forma de trabajo')).toHaveTextContent('Venta minorista')
    expect(screen.getByText('Módulo de Reparaciones')).toBeInTheDocument()
    expect(screen.getAllByText(/No incluido en el plan Basic/).length).toBeGreaterThan(0)
  })

  it('explains whether a module is included, disabled by the organization, or available in another plan', () => {
    render(
      <SubscriptionStatusProvider value={{
        ...status,
        planCode: 'PRO',
        planName: 'Pro',
        entitledModules: ['inventory', 'repairs'],
        enabledModules: ['inventory'],
        effectiveModules: ['inventory'],
      }}>
        <BusinessProfileCard />
      </SubscriptionStatusProvider>,
    )

    expect(screen.getByText('Plan actual: Pro')).toBeInTheDocument()
    expect(screen.getByText('Incluido en Pro, pero desactivado para esta organización')).toBeInTheDocument()
    expect(screen.getByText('No incluido en Pro. Disponible en Enterprise, pero ese plan no está activo')).toBeInTheDocument()
  })

  it('does not disable entitled modules when the business profile changes', async () => {
    const user = userEvent.setup()
    render(
      <SubscriptionStatusProvider value={{
        ...status,
        planCode: 'PRO',
        planName: 'Pro',
        entitledModules: ['inventory', 'pos', 'crm', 'analytics', 'security'],
        enabledModules: ['inventory', 'pos', 'crm', 'analytics', 'security'],
        effectiveModules: ['inventory', 'pos', 'crm', 'analytics', 'security'],
      }}>
        <BusinessProfileCard />
      </SubscriptionStatusProvider>,
    )

    await user.click(screen.getByLabelText('Forma de trabajo'))
    await user.click(screen.getByRole('option', { name: 'Negocio mixto' }))

    expect(screen.getByLabelText('Analytics avanzado')).toBeChecked()
    expect(screen.getByLabelText('Seguridad y auditoría')).toBeChecked()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: 'Aplicar recomendación' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('desactivará 2 herramientas'))
    expect(screen.getByLabelText('Analytics avanzado')).toBeChecked()
    expect(screen.getByLabelText('Seguridad y auditoría')).toBeChecked()
    confirm.mockRestore()
  })

  it('shows business recommendations, higher-plan modules, and safe activation actions', () => {
    render(
      <SubscriptionStatusProvider value={{
        ...status,
        modulePlanAvailability: {
          ...status.modulePlanAvailability,
          analytics: [{ name: 'Pro', isActive: true }],
          security: [{ name: 'Pro', isActive: true }],
        },
      }}>
        <BusinessProfileCard />
      </SubscriptionStatusProvider>,
    )

    expect(screen.getByText('Recomendado para Ropa y moda')).toBeInTheDocument()
    expect(screen.getByText('Disponible en planes superiores')).toBeInTheDocument()
    expect(screen.getByText('Analytics avanzado — Pro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activar recomendados incluidos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activar todo lo incluido' })).toBeInTheDocument()
  })

  it('una barbería propone prestación de servicios y muestra la agenda en el menú', async () => {
    const user = userEvent.setup()
    render(
      <SubscriptionStatusProvider value={{
        ...status,
        entitledModules: ['inventory', 'pos', 'crm', 'services'],
        enabledModules: ['inventory', 'pos', 'crm', 'services'],
        effectiveModules: ['inventory', 'pos', 'crm', 'services'],
      }}>
        <BusinessProfileCard />
      </SubscriptionStatusProvider>,
    )

    await user.click(screen.getByLabelText('Rubro'))
    await user.click(screen.getByRole('option', { name: 'Barbería y peluquería' }))
    expect(screen.getByLabelText('Forma de trabajo')).toHaveTextContent('Prestación de servicios')
    expect(screen.getByText(/agenda de turnos, reservas online y cobro del servicio en caja/)).toBeInTheDocument()

    // Qué incluye la herramienta y cómo queda el menú.
    expect(screen.getAllByText('Agenda de turnos, reservas online y catálogo de servicios').length).toBeGreaterThan(0)
    const menu = screen.getByRole('region', { name: 'Así queda tu menú' })
    expect(menu).toHaveTextContent('Agenda')
    expect(menu).not.toHaveTextContent('Reparaciones')
  })
})
