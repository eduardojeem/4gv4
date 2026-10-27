import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createInitialOnboardingState, type SharedOnboardingState } from '@/lib/onboarding/shared-setup'
import { SharedOnboardingWizard } from './SharedOnboardingWizard'

function stateAtStep(currentStep: 3 | 4): SharedOnboardingState {
  const initial = createInitialOnboardingState({
    plan: 'pro',
    businessName: 'Comercial Central',
    businessCategory: 'electronics',
  })

  return {
    ...initial,
    currentStep,
    completedSteps: currentStep === 3 ? ['plan', 'business'] : ['plan', 'business', 'branch'],
    data: {
      ...initial.data,
      primaryBranch: { ...initial.data.primaryBranch, name: 'Casa Central', city: 'Luque' },
      selectedModules: null,
    },
  }
}

const entitledModules = ['pos', 'inventory', 'repairs']

describe('SharedOnboardingWizard', () => {
  it('explains how to name the main branch', () => {
    render(<SharedOnboardingWizard initialState={stateAtStep(3)} planName="Pro" entitledModules={entitledModules} />)

    expect(screen.getByText(/identifica el local o punto de atención/i)).toBeInTheDocument()
    expect(screen.getByText(/un solo local.*mismo nombre del negocio/i)).toBeInTheDocument()
    expect(screen.getByText(/Casa Central/i)).toBeInTheDocument()
  })

  it('marks entitled category preferences as recommended', () => {
    render(<SharedOnboardingWizard initialState={stateAtStep(4)} planName="Pro" entitledModules={entitledModules} />)

    const posRow = screen.getByText('Ventas / POS').closest('label')
    const repairsRow = screen.getByText('Reparaciones').closest('label')

    expect(within(posRow as HTMLElement).getByText('Recomendado')).toBeInTheDocument()
    expect(within(repairsRow as HTMLElement).getByText('Recomendado')).toBeInTheDocument()
  })

  it('keeps unentitled preferences disabled and not recommended', () => {
    render(<SharedOnboardingWizard initialState={stateAtStep(4)} planName="Pro" entitledModules={entitledModules} />)

    const creditsCheckbox = screen.getByRole('checkbox', { name: /Créditos/i })
    const creditsRow = creditsCheckbox.closest('label') as HTMLElement

    expect(creditsCheckbox).toBeDisabled()
    expect(creditsRow).toHaveTextContent('No incluido')
    expect(within(creditsRow).queryByText('Recomendado')).not.toBeInTheDocument()
  })
})
