import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WebsiteNavigation } from '@/components/admin/website/WebsiteNavigation'
import { ServicesPublicationStatus } from '@/components/admin/website/ServicesPublicationStatus'

describe('website navigation', () => {
  it('groups all eight sections and requests navigation from the mobile selector', () => {
    const change = vi.fn()
    render(<WebsiteNavigation value="company" onChange={change} />)
    expect(screen.getAllByRole('option')).toHaveLength(8)
    fireEvent.change(screen.getByLabelText('Editar sección'), { target: { value: 'services' } })
    expect(change).toHaveBeenCalledWith('services')
    expect(screen.getByLabelText('Editar sección')).toHaveValue('company')
    fireEvent.click(screen.getByRole('button', { name: 'Banners promocionales' }))
    expect(change).toHaveBeenCalledWith('carousel')
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
})
