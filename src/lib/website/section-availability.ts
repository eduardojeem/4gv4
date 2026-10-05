import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { WebsiteSettings } from '@/types/website-settings'

/** Secciones editables del sitio (todas menos el resumen). */
export type WebsiteEditableSection =
  | 'company'
  | 'checkout'
  | 'hero'
  | 'trust_bar'
  | 'brands'
  | 'carousel'
  | 'offers'
  | 'announcement'
  | 'booking'
  | 'gallery'
  | 'services'
  | 'process'

export interface SectionAvailability {
  available: boolean
  /** Qué hace falta para usarla, cuando no está disponible. */
  requires?: string
}

type Capabilities = Pick<StorefrontCapabilities, 'hasCatalog' | 'hasServices' | 'hasRepairs'>

const CATALOG = 'el catálogo de productos (Inventario, Pedidos o Tienda online)'
const SERVICES = 'el módulo Servicios (agenda de turnos)'
const SERVICES_OR_REPAIRS = 'el módulo Servicios o Reparaciones'

/**
 * Qué secciones tienen sentido para la cuenta según los módulos que realmente
 * usa. La tienda pública aplica las mismas reglas, así que una sección que no
 * está disponible tampoco se publica aunque haya quedado activada.
 */
export function resolveSectionAvailability(capabilities: Capabilities): Record<WebsiteEditableSection, SectionAvailability> {
  const needs = (ok: boolean, requires: string): SectionAvailability => (ok ? { available: true } : { available: false, requires })
  const serviceLike = capabilities.hasServices || capabilities.hasRepairs
  return {
    company: { available: true },
    hero: { available: true },
    trust_bar: { available: true },
    carousel: { available: true },
    announcement: { available: true },
    process: { available: true },
    checkout: needs(capabilities.hasCatalog, CATALOG),
    brands: needs(capabilities.hasCatalog, CATALOG),
    offers: needs(capabilities.hasCatalog, CATALOG),
    booking: needs(capabilities.hasServices, SERVICES),
    services: needs(serviceLike, SERVICES_OR_REPAIRS),
    gallery: needs(serviceLike, SERVICES_OR_REPAIRS),
  }
}

export function isSectionAvailable(
  availability: Partial<Record<string, SectionAvailability>> | undefined,
  section: string,
): boolean {
  if (section === 'overview' || !availability) return true
  return availability[section]?.available !== false
}

/**
 * Apaga en los ajustes públicos las secciones que la cuenta ya no puede usar,
 * para que la portada, el menú y el pie no muestren algo que no funciona (por
 * ejemplo, reservas sin agenda u ofertas sin catálogo).
 */
export function hideUnavailableSections(settings: WebsiteSettings, capabilities: Capabilities): WebsiteSettings {
  const availability = resolveSectionAvailability(capabilities)
  const next: WebsiteSettings = { ...settings }
  if (!availability.brands.available && next.brands_section) next.brands_section = { ...next.brands_section, enabled: false }
  if (!availability.offers.available && next.offers_section) next.offers_section = { ...next.offers_section, enabled: false }
  if (!availability.booking.available && next.booking_section) next.booking_section = { ...next.booking_section, enabled: false }
  if (!availability.gallery.available && next.gallery_section) next.gallery_section = { ...next.gallery_section, enabled: false }
  if (!availability.services.available) next.company_info = { ...next.company_info, servicesPageEnabled: false }
  return next
}
