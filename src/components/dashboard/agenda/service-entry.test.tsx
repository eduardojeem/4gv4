import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NewServiceDialog } from './NewServiceDialog'
import { ProfessionalEditorSheet } from './ProfessionalEditorSheet'
import { SuggestedServicesCard } from './SuggestedServicesCard'
import type { AgendaProfessional } from '@/lib/agenda/agenda-server'

vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useSubscriptionStatus: () => ({ businessVertical: 'beauty_services', serviceSpecialties: ['nails', 'lashes'] }) }))
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('guided service entry', () => {
  it('lets a business explore other specialties without saving or inventing prices', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    render(<NewServiceDialog open onOpenChange={vi.fn()} existingNames={['Pedicura']} currency="PYG" onCreated={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Tipo de servicio'), { target: { value: 'brows' } })
    fireEvent.click(screen.getByRole('button', { name: 'Usar Diseño de cejas' }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Diseño de cejas')
    expect(screen.getByLabelText('Precio')).toHaveValue('')
    expect(screen.getByLabelText('Duración')).toHaveValue(null)
    fireEvent.change(screen.getByLabelText('Tipo de servicio'), { target: { value: 'nails' } })
    expect(screen.queryByRole('button', { name: 'Usar Pedicura' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Tipo de servicio'), { target: { value: 'other' } })
    expect(screen.getByLabelText('Nombre')).toHaveValue('Diseño de cejas')
    expect(screen.queryByRole('button', { name: /^Usar / })).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('requires actual prices and durations even for legacy barber suggestions', () => {
    render(<SuggestedServicesCard suggestions={[{ name: 'Corte clásico', pricePyg: 50000, durationMinutes: 30 }]} currency="PYG" rubroLabel="barbería" onAdded={vi.fn()} />)
    expect(screen.getByLabelText('Precio de Corte clásico')).toHaveValue(null)
    expect(screen.getByLabelText('Duración de Corte clásico')).toHaveValue(null)
    expect(screen.getByRole('button', { name: 'Agregar servicios' })).toBeDisabled()
  })
  it('offers specialty names without inventing price or duration and hides existing names', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    render(<NewServiceDialog open onOpenChange={vi.fn()} existingNames={[' MANICÚRA ']} currency="PYG" onCreated={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Usar Manicura' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Usar Lifting de pestañas' }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Lifting de pestañas')
    expect(screen.getByLabelText('Precio')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Agregar servicio' })).toBeDisabled()
    expect(screen.getByLabelText('Duración')).toHaveValue(null)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps a public profile preview separate from access and allows specialty guidance without saving', () => {
    const onUpdate = vi.fn()
    const professional = { id: 'p1', name: 'Ana', specialty: null, color: '#6366f1', is_active: true, online_visible: true, service_ids: [] } as unknown as AgendaProfessional
    render(<ProfessionalEditorSheet professional={professional} open onOpenChange={vi.fn()} services={[]} rates={[]} currency="PYG" advanced otherNames={[]} onUpdate={onUpdate} onServicesSaved={vi.fn()} onRatesSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Usar especialidad Uñas' }))
    expect(screen.getByLabelText('Especialidad')).toHaveValue('Uñas')
    expect(screen.getByLabelText('Vista previa del perfil público')).toHaveTextContent('Ana')
    expect(screen.getByLabelText('Vista previa del perfil público')).toHaveTextContent('Uñas')
    expect(screen.getByText(/no crea una cuenta de acceso/i)).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
