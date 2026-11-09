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

  it('conserva el borrador y reintenta con la revisión actualizada al finalizar', async () => {
    const fresh=stateAtStep(3)
    fresh.data={...fresh.data,countryCode:'PY',currency:'PYG',timezone:'America/Asuncion',locale:'es-PY',regionalConfirmed:true}
    const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status})
    const fetchMock=vi.fn().mockResolvedValueOnce(json({code:'ONBOARDING_REVISION_CONFLICT',error:'Otro dispositivo cambió la configuración.'},409)).mockResolvedValueOnce(json({onboardingRevision:5,setupState:fresh})).mockResolvedValueOnce(json({revision:6})).mockResolvedValueOnce(json({revision:7})).mockResolvedValueOnce(json({revision:8})).mockResolvedValueOnce(json({revision:9,completedAt:'2026-11-08T12:00:00Z'}))
    vi.stubGlobal('fetch',fetchMock)
    render(<SharedOnboardingWizard initialState={fresh} initialRevision={4} planName="Pro" entitledModules={entitledModules}/>)
    fireEvent.change(screen.getByLabelText('Nombre de la sucursal'),{target:{value:'Sucursal en edición'}})
    fireEvent.click(screen.getByRole('button',{name:/Siguiente/}));fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Finalizar y guardar'}))
    await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.getByText(/Sucursal en edición/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Finalizar y guardar'}))
    await waitFor(()=>expect(screen.getByRole('heading',{name:'Configuración guardada'})).toBeInTheDocument())
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toMatchObject({expectedRevision:5,step:2})
    expect(JSON.parse(fetchMock.mock.calls[3][1].body as string)).toMatchObject({expectedRevision:6,step:3,data:{name:'Sucursal en edición'}})
    expect(JSON.parse(fetchMock.mock.calls[5][1].body as string)).toMatchObject({expectedRevision:8,sharedSetup:true})
    vi.unstubAllGlobals()
  })})

it('Siguiente no escribe en el servidor antes de finalizar',()=>{
 const request=vi.fn();vi.stubGlobal('fetch',request)
 render(<SharedOnboardingWizard initialState={stateAtStep(3)} initialRevision={0} planName="Pro" entitledModules={entitledModules}/>)
 fireEvent.click(screen.getByRole('button',{name:/Siguiente/}))
 expect(request).not.toHaveBeenCalled()
 expect(screen.getByText('¿Qué querés usar?')).toBeInTheDocument()
 vi.unstubAllGlobals()
})
