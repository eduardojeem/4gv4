import { z } from 'zod'
import { ServiceBusinessDetailsSchema, SERVICE_SPECIALTY_LABELS } from '@/lib/organization/service-specialties'
import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from './storefront-capabilities'
import { applyWebsiteSettingsDefaults } from './default-settings'

export const SERVICE_WEBSITE_VARIANTS = ['barber', 'salon', 'studio', 'professional'] as const
export type ServiceWebsiteVariant = typeof SERVICE_WEBSITE_VARIANTS[number]
export const SERVICE_VARIANT_PRESETS = {
  barber: { label: 'Barbería', color: '#334155', title: 'Tu estilo, tu espacio', subtitle: 'Conocé nuestros servicios de barbería y coordiná tu atención.' },
  salon: { label: 'Salón de belleza', color: '#885F44', title: 'Un espacio para tu cabello', subtitle: 'Conocé los servicios de peluquería y cuidado que ofrecemos.' },
  studio: { label: 'Estudio de belleza', color: '#826078', title: 'Un momento para cuidarte', subtitle: 'Descubrí nuestros servicios de belleza y cuidado personal.' },
  professional: { label: 'Servicios profesionales', color: '#245E58', title: 'Encontrá el servicio que necesitás', subtitle: 'Conocé nuestras opciones y coordiná tu atención.' },
} satisfies Record<ServiceWebsiteVariant, { label: string; color: string; title: string; subtitle: string }>

export const ServiceWebsiteOptionsSchema = z.object({
  variant: z.enum(SERVICE_WEBSITE_VARIANTS),
  specialties: ServiceBusinessDetailsSchema.shape.serviceSpecialties.default([]),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).refine(color => {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return false
    const linear = [1, 3, 5].map(index => { const c = parseInt(color.slice(index, index + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
    return 1.05 / (0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] + 0.05) >= 4.5
  }, 'Elegí un color más oscuro para que los botones se lean bien.'),
  title: z.string().trim().min(1).max(120), subtitle: z.string().trim().max(400),
}).strict()
export type ServiceWebsiteOptions = z.infer<typeof ServiceWebsiteOptionsSchema>
export type ServiceWebsiteProposalInput = ServiceWebsiteOptions & { current: Partial<WebsiteSettings>; capabilities: StorefrontCapabilities }
export const SERVICE_PROPOSAL_KEYS = ['company_info', 'hero_content', 'trust_bar', 'process_flows', 'booking_section'] as const
export type ServiceWebsiteProposal = { values: Partial<Pick<WebsiteSettings, typeof SERVICE_PROPOSAL_KEYS[number]>>; summary: string[] }

export function buildServiceWebsiteProposal(input: ServiceWebsiteProposalInput): ServiceWebsiteProposal {
  const current = applyWebsiteSettingsDefaults(input.current)
  // Do not enable booking by choosing a visual style. Keep configured availability.
  const bookingEnabled = input.capabilities.hasServices && current.booking_section?.enabled === true
  return {
    values: {
      company_info: { ...current.company_info, storefrontStyle: 'services', serviceWebsiteVariant: input.variant,
        brandColor: 'custom', customBrandColor: input.accentColor,
        servicesPageEnabled: input.capabilities.hasServices,
        serviceSpecialties: [...input.specialties] },
      hero_content: { ...current.hero_content, enabled: true, title: input.title, subtitle: input.subtitle,
        badge: input.specialties.map(s => SERVICE_SPECIALTY_LABELS[s]).join(' · ') || 'Nuestros servicios',
        trustBadges: [], ctaPrimaryText: bookingEnabled ? 'Reservar turno' : 'Ver servicios', ctaSecondaryText: 'Consultar' },
      // Preserve benefits/process promises; template switching does not invent them.
      trust_bar: current.trust_bar,
      process_flows: current.process_flows,
      booking_section: { ...current.booking_section, enabled: bookingEnabled },
    },
    summary: [`Estilo: ${SERVICE_VARIANT_PRESETS[input.variant].label}`, 'Color de marca y textos de portada', 'Servicios, precios, profesionales, reservas y pagos sin cambios'],
  }
}
