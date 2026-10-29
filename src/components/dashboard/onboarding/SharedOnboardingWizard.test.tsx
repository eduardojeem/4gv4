import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
    render(<SharedOnboardingWizard initialState={stateAtStep(3)} initialRevision={0} planName="Pro" entitledModules={entitledModules} />)

    expect(screen.getByText(/identifica el local o punto de atención/i)).toBeInTheDocument()
    expect(screen.getByText(/un solo local.*mismo nombre del negocio/i)).toBeInTheDocument()
    expect(screen.getByText(/Casa Central/i)).toBeInTheDocument()
  })

  it('marks entitled category preferences as recommended', () => {
    render(<SharedOnboardingWizard initialState={stateAtStep(4)} initialRevision={0} planName="Pro" entitledModules={entitledModules} />)

    const posRow = screen.getByText('Ventas / POS').closest('label')
    const repairsRow = screen.getByText('Reparaciones').closest('label')

    expect(within(posRow as HTMLElement).getByText('Recomendado')).toBeInTheDocument()
    expect(within(repairsRow as HTMLElement).getByText('Recomendado')).toBeInTheDocument()
  })

  it('keeps unentitled preferences disabled and not recommended', () => {
    render(<SharedOnboardingWizard initialState={stateAtStep(4)} initialRevision={0} planName="Pro" entitledModules={entitledModules} />)

    const creditsCheckbox = screen.getByRole('checkbox', { name: /Créditos/i })
    const creditsRow = creditsCheckbox.closest('label') as HTMLElement

    expect(creditsCheckbox).toBeDisabled()
    expect(creditsRow).toHaveTextContent('No incluido')
    expect(within(creditsRow).queryByText('Recomendado')).not.toBeInTheDocument()
  })

  it('preserves the active step draft and refreshes the revision after a cross-device conflict', async () => {
    const fresh = stateAtStep(3)
    const latest = {
      ...fresh,
      data: { ...fresh.data, businessName: 'Actualizado desde Mobile' },
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: 'ONBOARDING_REVISION_CONFLICT',
        revision: 5,
        error: 'Tu configuración fue actualizada desde otro dispositivo.',
      }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ setupState: latest, onboardingRevision: 5 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ setupState: latest, revision: 6 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    render(<SharedOnboardingWizard initialState={fresh} initialRevision={4} planName="Pro" entitledModules={entitledModules} />)
    fireEvent.change(screen.getByLabelText('Nombre de la sucursal'), { target: { value: 'Sucursal en edición' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar y continuar/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({ expectedRevision: 4, step: 3 })
    expect(screen.getByLabelText('Nombre de la sucursal')).toHaveValue('Sucursal en edición')
    fireEvent.click(screen.getByRole('button', { name: /Guardar y continuar/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toMatchObject({ expectedRevision: 5, step: 3, data: { name: 'Sucursal en edición' } })
    vi.unstubAllGlobals()
  })
})
