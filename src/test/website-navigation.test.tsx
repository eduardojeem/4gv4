import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WebsiteNavigation } from '@/components/admin/website/WebsiteNavigation'
import { ServicesPublicationStatus } from '@/components/admin/website/ServicesPublicationStatus'
import { resolveSectionAvailability } from '@/lib/website/section-availability'

describe('website navigation', () => {
  it('lists the summary plus all twelve sections and requests navigation from the mobile selector', () => {
    const change = vi.fn()
    render(<WebsiteNavigation value="company" onChange={change} />)
    // El resumen guiado más las doce secciones editables.
    expect(screen.getAllByRole('option')).toHaveLength(13)
    expect(screen.getAllByRole('option')[0]).toHaveValue('overview')
    fireEvent.change(screen.getByLabelText('Editar sección'), { target: { value: 'services' } })
    expect(change).toHaveBeenCalledWith('services')
    expect(screen.getByLabelText('Editar sección')).toHaveValue('company')
    fireEvent.click(screen.getByRole('button', { name: 'Banners promocionales' }))
    expect(change).toHaveBeenCalledWith('carousel')
  })
})

describe('website navigation by business focus', () => {
  it('folds the sections a barbershop rarely needs under "Más secciones"', () => {
    const change = vi.fn()
    render(<WebsiteNavigation value="overview" onChange={change} focus="services" progress={{ done: 2, total: 9 }} />)
    // El selector móvil sigue ofreciendo todo.
    expect(screen.getAllByRole('option')).toHaveLength(13)
    expect(screen.getByRole('button', { name: 'Reservas online' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcas destacadas' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Más secciones/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcas destacadas' }))
    expect(change).toHaveBeenCalledWith('brands')
    expect(screen.getByText('2/9')).toBeInTheDocument()
  })

  it('does not list sections from modules the account does not have', () => {
    const availability = resolveSectionAvailability({ hasCatalog: true, hasServices: false, hasRepairs: false })
    render(<WebsiteNavigation value="overview" onChange={vi.fn()} focus="retail" availability={availability} />)
    const options = screen.getAllByRole('option').map((option) => (option as HTMLOptionElement).value)
    expect(options).not.toContain('booking')
    expect(options).not.toContain('gallery')
    expect(options).not.toContain('services')
    expect(options).toContain('offers')
    expect(screen.getAllByText('9 secciones').length).toBeGreaterThan(0)
  })

  it('keeps a folded section visible while it is the one being edited', () => {
    render(<WebsiteNavigation value="brands" onChange={vi.fn()} focus="services" />)
    expect(screen.getByRole('button', { name: 'Marcas destacadas' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('services publication status', () => {
  it('does not advertise a private store as online', () => {
    render(<ServicesPublicationStatus storefrontPublic={false} enabled activeCount={2} orgSlug="tienda" />)
    expect(screen.getByText('Tienda sin publicar')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('links only to the published organization', () => {
    render(<ServicesPublicationStatus storefrontPublic enabled activeCount={2} orgSlug="tienda" />)
    expect(screen.getByRole('link', { name: 'Ver servicios' })).toHaveAttribute('href', '/tienda/servicios')
  })
  it('keeps disabled services private even when the store is published', () => {
    render(<ServicesPublicationStatus storefrontPublic enabled={false} activeCount={2} orgSlug="tienda" />)
    expect(screen.getByText('Sección de servicios oculta')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('shows module inactive status and hides link when organization lacks services module', () => {
    render(<ServicesPublicationStatus storefrontPublic enabled activeCount={2} orgSlug="tienda" servicesModuleEnabled={false} />)
    expect(screen.getByText('Módulo de servicios no activo')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('website navigation module gating', () => {
  it('displays "Sin módulo" badge and inactive plan description when services module is disabled', () => {
    render(<WebsiteNavigation value="company" onChange={vi.fn()} servicesModuleEnabled={false} />)
    expect(screen.getByText('Sin módulo')).toBeInTheDocument()
    expect(screen.getByText('Módulo inactivo en tu plan')).toBeInTheDocument()
  })
})
