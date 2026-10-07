import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SectionAssistant } from '@/components/admin/website/SectionAssistant'
import { reviewWebsiteSection, type CoachSection } from '@/lib/website/section-coach'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { WebsiteSettings } from '@/types/website-settings'

const clothing = resolveStorefrontCapabilities({ businessVertical: 'clothing', operatingModel: 'retail', effectiveModules: ['inventory', 'ecommerce', 'orders'] })
const barbershop = resolveStorefrontCapabilities({ businessVertical: 'barbershop', operatingModel: 'service', effectiveModules: ['services', 'crm'] })

function settingsWith(patch: Partial<WebsiteSettings>): WebsiteSettings {
  const base = getWebsiteSettingsDefaults()
  return { ...base, ...patch, company_info: { ...base.company_info, ...patch.company_info } } as WebsiteSettings
}

const SECTIONS: CoachSection[] = ['company', 'hero', 'trust_bar', 'brands', 'carousel', 'offers', 'announcement', 'services', 'gallery', 'booking', 'process', 'checkout']

describe('asistente por sección', () => {
  it('todas las secciones tienen algo que decir', () => {
    const settings = getWebsiteSettingsDefaults()
    for (const section of SECTIONS) {
      expect(reviewWebsiteSection(section, settings, { capabilities: clothing, storefrontStyle: 'fashion' }).length).toBeGreaterThan(0)
    }
  })

  it('beneficios: avisa si promete envíos y el envío está apagado', () => {
    const base = getWebsiteSettingsDefaults()
    const settings = settingsWith({
      trust_bar: { enabled: true, position: 'above_carousel', items: [
        { id: '1', icon: 'truck', title: 'Envíos a todo el país', description: 'Recibilo en casa', active: true },
        { id: '2', icon: 'shield', title: 'Garantía', description: 'Escrita', active: true },
        { id: '3', icon: 'message', title: 'Atención', description: 'Por WhatsApp', active: true },
      ] },
      checkout: { ...base.checkout!, commerceMode: 'cart', delivery: { ...base.checkout!.delivery, enabled: false } },
    })
    const items = reviewWebsiteSection('trust_bar', settings, { capabilities: clothing, storefrontStyle: 'fashion' })
    const delivery = items.find((item) => /envíos/.test(item.text))
    expect(delivery).toMatchObject({ level: 'warn', action: { kind: 'navigate', section: 'checkout' } })
  })

  it('beneficios: no promete reparaciones ni turnos que la cuenta no tiene', () => {
    const settings = settingsWith({
      trust_bar: { enabled: true, position: 'above_carousel', items: [
        { id: '1', icon: 'wrench', title: 'Reparaciones con garantía', description: 'En el día', active: true },
        { id: '2', icon: 'clock', title: 'Reservá tu turno', description: 'Online', active: true },
      ] },
    })
    const texts = reviewWebsiteSection('trust_bar', settings, { capabilities: clothing, storefrontStyle: 'fashion' }).map((item) => item.text).join(' ')
    expect(texts).toMatch(/reparaciones/)
    expect(texts).toMatch(/turnos/)
  })

  it('servicios: a una barbería le sugiere activar las reservas', () => {
    const settings = settingsWith({
      services: [{ id: 's', title: 'Corte', description: 'Corte a tijera', icon: 'sparkles', color: 'blue', benefits: ['x'], price: 'Gs. 50.000', duration: '30 min' }],
      booking_section: { enabled: false, title: '', subtitle: '', showTeam: true },
    })
    const items = reviewWebsiteSection('services', settings, { capabilities: barbershop, storefrontStyle: 'services' })
    expect(items.find((item) => item.action?.kind === 'navigate')?.action).toMatchObject({ section: 'booking' })
  })

  it('el panel se abre solo cuando hay algo para corregir y lleva a la sección', () => {
    const onNavigate = vi.fn()
    const base = getWebsiteSettingsDefaults()
    const settings = settingsWith({
      trust_bar: { enabled: true, position: 'above_carousel', items: [{ id: '1', icon: 'truck', title: 'Envíos', description: 'A domicilio', active: true }] },
      checkout: { ...base.checkout!, commerceMode: 'cart', delivery: { ...base.checkout!.delivery, enabled: false } },
    })
    render(
      <SectionAssistant
        section="trust_bar"
        settings={settings}
        context={{ capabilities: clothing, storefrontStyle: 'fashion' }}
        onNavigate={onNavigate}
        onOpenAssistant={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /Asistente de esta sección/ })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Configurar envíos/ }))
    expect(onNavigate).toHaveBeenCalledWith('checkout')
  })

  it('en las secciones de textos ofrece el asistente general', () => {
    const onOpenAssistant = vi.fn()
    render(
      <SectionAssistant
        section="hero"
        settings={getWebsiteSettingsDefaults()}
        context={{ capabilities: clothing, storefrontStyle: 'fashion' }}
        onNavigate={vi.fn()}
        onOpenAssistant={onOpenAssistant}
      />,
    )
    const toggle = screen.getByRole('button', { name: /Asistente de esta sección/ })
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
    fireEvent.click(screen.getAllByRole('button', { name: /con el asistente/ })[0])
    expect(onOpenAssistant).toHaveBeenCalled()
  })
})
