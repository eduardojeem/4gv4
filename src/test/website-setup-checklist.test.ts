import { describe, expect, it } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { buildWebsiteSetupChecklist, isSectionRecommended, resolveWebsiteFocus } from '@/lib/website/setup-checklist'
import type { WebsiteSettings } from '@/types/website-settings'

const barbershop = { businessVertical: 'barbershop', operatingModel: 'service', hasCatalog: true, hasServices: true, hasRepairs: false } as const
const clothing = { businessVertical: 'clothing', operatingModel: 'retail', hasCatalog: true, hasServices: false, hasRepairs: false } as const
const repairShop = { businessVertical: 'electronics', operatingModel: 'repair', hasCatalog: true, hasServices: false, hasRepairs: true } as const

function settingsWith(overrides: Partial<WebsiteSettings> = {}): WebsiteSettings {
  const defaults = getWebsiteSettingsDefaults()
  return { ...defaults, ...overrides, company_info: { ...defaults.company_info, ...(overrides.company_info ?? {}) } }
}

describe('website focus', () => {
  it('reads the business the way the site should present it', () => {
    expect(resolveWebsiteFocus(barbershop)).toBe('services')
    expect(resolveWebsiteFocus(clothing)).toBe('retail')
    expect(resolveWebsiteFocus(repairShop)).toBe('repairs')
  })

  it('keeps bookings out of the way of a clothing store, and brands out of a barbershop', () => {
    expect(isSectionRecommended('booking', 'retail')).toBe(false)
    expect(isSectionRecommended('brands', 'services')).toBe(false)
    expect(isSectionRecommended('booking', 'services')).toBe(true)
    expect(isSectionRecommended('overview', 'repairs')).toBe(true)
  })
})

describe('website setup checklist', () => {
  it('asks a new store for its essentials first, ending with publishing', () => {
    const checklist = buildWebsiteSetupChecklist(settingsWith({ company_info: { ...getWebsiteSettingsDefaults().company_info, name: '', logoUrl: '', storefrontPublic: false } }), clothing)
    expect(checklist.essentials.map((step) => step.id)).toEqual(['identity', 'appearance', 'sales', 'hero', 'publish'])
    expect(checklist.next?.id).toBe('identity')
    expect(checklist.essentials[0].missing).toContain('logo')
    expect(checklist.essentials.at(-1)?.done).toBe(false)
  })

  it('recommends bookings, services and a gallery to a barbershop', () => {
    const checklist = buildWebsiteSetupChecklist(settingsWith(), barbershop)
    expect(checklist.focus).toBe('services')
    expect(checklist.recommended.map((step) => step.section)).toEqual(['booking', 'services', 'gallery', 'trust_bar'])
  })

  it('counts a gallery as done only with enough photos to convince someone', () => {
    const image = (id: string) => ({ id, url: `https://example.com/${id}.webp` })
    const few = buildWebsiteSetupChecklist(settingsWith({ gallery_section: { enabled: true, title: '', subtitle: '', images: [image('a')] } }), barbershop)
    expect(few.recommended.find((step) => step.id === 'gallery')).toMatchObject({ done: false, missing: 'Subí al menos 3 fotos (1 ahora)' })
    const enough = buildWebsiteSetupChecklist(settingsWith({ gallery_section: { enabled: true, title: '', subtitle: '', images: [image('a'), image('b'), image('c')] } }), barbershop)
    expect(enough.recommended.find((step) => step.id === 'gallery')?.done).toBe(true)
  })

  it('never asks for a section the account cannot use', () => {
    // Barbería sin el módulo Servicios: ni reservas, ni carta de servicios, ni galería.
    const noModules = buildWebsiteSetupChecklist(settingsWith(), { ...barbershop, hasServices: false })
    const sections = [...noModules.essentials, ...noModules.recommended].map((step) => step.section)
    expect(sections).not.toContain('booking')
    expect(sections).not.toContain('services')
    expect(sections).not.toContain('gallery')
    // Sin catálogo no hay carrito que configurar.
    const servicesOnly = buildWebsiteSetupChecklist(settingsWith(), { ...barbershop, hasCatalog: false })
    expect(servicesOnly.essentials.map((step) => step.id)).not.toContain('sales')
    expect(servicesOnly.total).toBe(servicesOnly.essentials.length + servicesOnly.recommended.length)
  })

  it('treats WhatsApp selling as configured only when there is a WhatsApp number', () => {
    const base = settingsWith()
    const checkout = { ...base.checkout!, commerceMode: 'whatsapp' as const }
    const without = buildWebsiteSetupChecklist({ ...base, checkout, company_info: { ...base.company_info, whatsapp: '' } }, clothing)
    expect(without.essentials.find((step) => step.id === 'sales')?.missing).toBe('Falta tu número de WhatsApp')
    const withNumber = buildWebsiteSetupChecklist({ ...base, checkout, company_info: { ...base.company_info, whatsapp: '595981000000' } }, clothing)
    expect(withNumber.essentials.find((step) => step.id === 'sales')?.done).toBe(true)
  })

  it('reports progress over every step', () => {
    const checklist = buildWebsiteSetupChecklist(settingsWith(), clothing)
    expect(checklist.total).toBe(checklist.essentials.length + checklist.recommended.length)
    expect(checklist.done).toBe([...checklist.essentials, ...checklist.recommended].filter((step) => step.done).length)
  })
})
