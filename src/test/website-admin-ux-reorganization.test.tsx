import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WebsiteOverview } from '@/components/admin/website/WebsiteOverview'
import { StorefrontTemplateSelector } from '@/components/admin/website/StorefrontTemplateSelector'
import { StoreTrustBar } from '@/components/public/inicio/StoreTrustBar'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { buildWebsiteSetupChecklist } from '@/lib/website/setup-checklist'
import { resolveSectionAvailability } from '@/lib/website/section-availability'

const capabilities = { businessVertical: 'general', operatingModel: 'retail', hasCatalog: true, hasServices: false, hasRepairs: false } as const

describe('reorganización del editor de tienda', () => {
  it('muestra la tienda y la plantilla actual en el resumen, y lleva al diseño', () => {
    const onNavigate = vi.fn()
    const settings = getWebsiteSettingsDefaults()
    const checklist = buildWebsiteSetupChecklist(settings, capabilities)
    render(<WebsiteOverview
      checklist={checklist}
      businessLabel="Comercio general"
      storeName="Tienda sintética"
      currentTemplate="Clásico Universal"
      storeHref="/tienda-sintetica/inicio"
      publicUrl="https://example.test/tienda-sintetica/inicio"
      isPublic={false}
      onOpenAi={vi.fn()}
      onNavigate={onNavigate}
      availability={resolveSectionAvailability(capabilities)}
      account={{ planName: 'Prueba', hasCatalog: true, hasServices: false, hasRepairs: false }}
    />)

    expect(screen.getByText('Tienda online')).toBeInTheDocument()
    expect(screen.getByText('Tienda sintética')).toBeInTheDocument()
    expect(screen.getByText('Clásico Universal')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar plantilla' }))
    expect(onNavigate).toHaveBeenCalledWith('design-template')
  })

  it('cambiar plantilla solo solicita cambiar el estilo, sin tocar contenido', () => {
    const onChange = vi.fn()
    render(<StorefrontTemplateSelector value="classic" onChange={onChange} businessVertical="general" catalogAvailable />)
    fireEvent.click(screen.getByRole('button', { name: /^Moderno:/ }))
    expect(onChange).toHaveBeenCalledWith('modern')
  })

  it('muestra un único estado, descripción y rubros recomendados para cada plantilla', () => {
    const onChange = vi.fn()
    render(<StorefrontTemplateSelector value="modern" onChange={onChange} businessVertical="electronics" catalogAvailable />)

    const current = screen.getByRole('button', { name: 'Moderno: actual' })
    const recommended = screen.getByRole('button', { name: 'Tecnología: recomendada' })
    const compatible = screen.getByRole('button', { name: 'Clásico: compatible' })

    expect(current).toHaveAttribute('aria-pressed', 'true')
    expect(within(current).getByText('ACTUAL')).toBeInTheDocument()
    expect(within(recommended).getByText(/Estética moderna/)).toBeInTheDocument()
    expect(recommended.textContent).toMatch(/Recomendada para:\s*Celulares, Informática/)
    expect(within(recommended).getByText('Seleccionar plantilla')).toBeInTheDocument()
    expect(within(compatible).getByText('COMPATIBLE')).toBeInTheDocument()
    expect(within(recommended).getAllByText(/RECOMENDADA|ACTUAL|REQUIERE MÓDULOS|COMPATIBLE/)).toHaveLength(1)

    fireEvent.click(recommended)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('tech')
  })

  it('no muestra claims de beneficios cuando el comercio no configuró ninguno', () => {
    const defaults = getWebsiteSettingsDefaults()
    expect(defaults.trust_bar).toMatchObject({ enabled: false, items: [] })
    const { container } = render(<StoreTrustBar settings={{ enabled: true, items: [] }} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(/garantía oficial|envío gratis|productos originales/i)).not.toBeInTheDocument()
  })
})
