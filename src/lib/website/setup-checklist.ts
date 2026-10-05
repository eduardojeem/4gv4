import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { resolveSectionAvailability } from '@/lib/website/section-availability'

/** Pestañas del editor del sitio. `overview` es el resumen guiado. */
export type WebsiteSectionId =
  | 'overview'
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

/** Ancla dentro de una pestaña (tarjetas de Empresa y publicación). */
export type WebsiteSectionAnchor = 'website-identity' | 'website-visibility' | 'website-appearance' | 'website-contact'

export interface WebsiteSetupStep {
  id: string
  section: Exclude<WebsiteSectionId, 'overview'>
  anchor?: WebsiteSectionAnchor
  title: string
  /** Por qué importa, en una línea. */
  why: string
  done: boolean
  /** Qué falta, cuando el paso está incompleto. */
  missing?: string
  cta: string
}

export type WebsiteFocus = 'services' | 'repairs' | 'retail'

/**
 * Cómo trabaja el negocio, visto desde el sitio: un salón vive de los turnos,
 * un taller de sus servicios y su proceso, una tienda de su catálogo.
 */
export function resolveWebsiteFocus(capabilities: Pick<StorefrontCapabilities, 'businessVertical' | 'operatingModel' | 'hasServices' | 'hasRepairs'>): WebsiteFocus {
  if (capabilities.businessVertical === 'barbershop') return 'services'
  if (capabilities.operatingModel === 'service' && capabilities.hasServices) return 'services'
  if (capabilities.hasRepairs || capabilities.operatingModel === 'repair') return 'repairs'
  return 'retail'
}

/** Secciones que más rinden según el foco; el resto queda en "Más secciones". */
export const FOCUS_SECTIONS: Record<WebsiteFocus, Array<Exclude<WebsiteSectionId, 'overview'>>> = {
  services: ['company', 'checkout', 'hero', 'booking', 'services', 'gallery', 'trust_bar', 'process'],
  repairs: ['company', 'checkout', 'hero', 'services', 'process', 'trust_bar', 'carousel', 'announcement'],
  retail: ['company', 'checkout', 'hero', 'trust_bar', 'carousel', 'offers', 'brands', 'announcement'],
}

export function isSectionRecommended(section: WebsiteSectionId, focus: WebsiteFocus): boolean {
  return section === 'overview' || FOCUS_SECTIONS[focus].includes(section)
}

const filled = (value?: string | null) => Boolean(value && value.trim())

function missingList(items: Array<[boolean, string]>): string | undefined {
  const missing = items.filter(([ok]) => !ok).map(([, label]) => label)
  if (missing.length === 0) return undefined
  return `Falta: ${missing.join(', ')}`
}

function essentials(settings: WebsiteSettings): WebsiteSetupStep[] {
  const company = settings.company_info
  const checkout = settings.checkout
  const hero = settings.hero_content

  const hasContact = filled(company.whatsapp) || filled(company.phone)
  const identityDone = filled(company.name) && filled(company.logoUrl) && hasContact

  const mode = checkout?.commerceMode ?? 'cart'
  const payment = checkout?.payment
  const anyPayment = Boolean(payment && Object.values(payment).some((method) => method?.enabled))
  const salesDone = mode === 'catalog'
    || (mode === 'whatsapp' ? filled(company.whatsapp) : anyPayment && Boolean(checkout?.delivery?.enabled || checkout?.pickup?.enabled))

  const style = company.storefrontStyle
  const heroDone = hero?.enabled !== false && filled(hero?.title) && filled(hero?.subtitle)

  return [
    {
      id: 'identity',
      section: 'company',
      anchor: 'website-identity',
      title: 'Datos y contacto',
      why: 'Tu nombre, logo y un contacto dan confianza desde el primer vistazo.',
      done: identityDone,
      missing: missingList([[filled(company.name), 'nombre'], [filled(company.logoUrl), 'logo'], [hasContact, 'WhatsApp o teléfono']]),
      cta: 'Completar datos',
    },
    {
      id: 'appearance',
      section: 'company',
      anchor: 'website-appearance',
      title: 'Plantilla y colores',
      why: 'Elegí el diseño que mejor va con tu rubro; podés cambiarlo cuando quieras.',
      done: Boolean(style && style !== 'auto'),
      missing: style && style !== 'auto' ? undefined : 'Usás la plantilla automática',
      cta: 'Elegir plantilla',
    },
    {
      id: 'sales',
      section: 'checkout',
      title: 'Cómo te compran o contactan',
      why: 'Define si el cliente compra con carrito, te escribe por WhatsApp o solo mira el catálogo.',
      done: salesDone,
      missing: salesDone
        ? undefined
        : mode === 'whatsapp' ? 'Falta tu número de WhatsApp' : 'Activá al menos un medio de pago y una forma de entrega',
      cta: 'Configurar venta',
    },
    {
      id: 'hero',
      section: 'hero',
      title: 'Portada',
      why: 'Es lo primero que se ve: un título claro y un botón que lleve a comprar o reservar.',
      done: heroDone,
      missing: heroDone ? undefined : hero?.enabled === false ? 'La portada está oculta' : 'Falta título o descripción',
      cta: 'Editar portada',
    },
    {
      id: 'publish',
      section: 'company',
      anchor: 'website-visibility',
      title: 'Publicar la tienda',
      why: 'Mientras no la publiques, nadie más puede ver tu sitio.',
      done: company.storefrontPublic === true,
      missing: company.storefrontPublic ? undefined : 'Tu tienda todavía no es pública',
      cta: 'Publicar',
    },
  ]
}

function recommended(settings: WebsiteSettings, focus: WebsiteFocus): WebsiteSetupStep[] {
  const activeServices = (settings.services || []).filter((service) => service.active !== false).length
  const activeTrust = (settings.trust_bar?.items || []).filter((item) => item.active !== false).length
  const trustDone = settings.trust_bar?.enabled !== false && activeTrust >= 2
  const servicesStep: WebsiteSetupStep = {
    id: 'services',
    section: 'services',
    title: 'Servicios con precio y duración',
    why: 'El cliente decide más rápido cuando ve qué incluye cada servicio y cuánto cuesta.',
    done: settings.company_info.servicesPageEnabled !== false && activeServices > 0,
    missing: activeServices > 0 ? undefined : 'Todavía no hay servicios activos',
    cta: 'Cargar servicios',
  }
  const trustStep: WebsiteSetupStep = {
    id: 'trust_bar',
    section: 'trust_bar',
    title: 'Beneficios',
    why: 'Dos o tres ventajas concretas (envíos, garantía, atención) bajan las dudas.',
    done: trustDone,
    missing: trustDone ? undefined : 'Mostrá al menos 2 beneficios',
    cta: 'Elegir beneficios',
  }

  if (focus === 'services') {
    const images = settings.gallery_section?.images?.length || 0
    const galleryDone = Boolean(settings.gallery_section?.enabled) && images >= 3
    return [
      {
        id: 'booking',
        section: 'booking',
        title: 'Reservas online',
        why: 'Tus clientes eligen servicio, profesional y horario sin escribirte.',
        done: Boolean(settings.booking_section?.enabled),
        missing: settings.booking_section?.enabled ? undefined : 'La sección de reservas está oculta',
        cta: 'Activar reservas',
      },
      servicesStep,
      {
        id: 'gallery',
        section: 'gallery',
        title: 'Galería de trabajos',
        why: 'Las fotos de tus trabajos son lo que más convence a un cliente nuevo.',
        done: galleryDone,
        missing: galleryDone ? undefined : `Subí al menos 3 fotos (${images} ahora)`,
        cta: 'Subir fotos',
      },
      trustStep,
    ]
  }

  if (focus === 'repairs') {
    const steps = (settings.process_steps || []).length
    const processDone = settings.company_info.processSectionEnabled !== false && steps > 0
    return [
      servicesStep,
      {
        id: 'process',
        section: 'process',
        title: 'Cómo atendés',
        why: 'Contar las etapas (recepción, diagnóstico, entrega) da tranquilidad.',
        done: processDone,
        missing: processDone ? undefined : 'Agregá las etapas de tu atención',
        cta: 'Contar el proceso',
      },
      trustStep,
    ]
  }

  const slides = (settings.promotional_carousel?.slides || []).filter((slide) => slide.active !== false).length
  const bannersDone = settings.promotional_carousel?.enabled !== false && slides > 0
  return [
    trustStep,
    {
      id: 'carousel',
      section: 'carousel',
      title: 'Un banner de campaña',
      why: 'Una imagen con tu mejor promoción le da vida a la portada.',
      done: bannersDone,
      missing: bannersDone ? undefined : 'No hay banners activos',
      cta: 'Crear banner',
    },
    {
      id: 'offers',
      section: 'offers',
      title: 'Ofertas',
      why: 'Muestra automáticamente los productos con precio de oferta.',
      done: settings.offers_section?.enabled !== false,
      missing: settings.offers_section?.enabled === false ? 'La sección de ofertas está oculta' : undefined,
      cta: 'Revisar ofertas',
    },
  ]
}

export interface WebsiteSetupChecklist {
  focus: WebsiteFocus
  essentials: WebsiteSetupStep[]
  recommended: WebsiteSetupStep[]
  done: number
  total: number
  /** El primer paso pendiente, empezando por lo esencial. */
  next: WebsiteSetupStep | null
}

export function buildWebsiteSetupChecklist(
  settings: WebsiteSettings,
  capabilities: Pick<StorefrontCapabilities, 'businessVertical' | 'operatingModel' | 'hasCatalog' | 'hasServices' | 'hasRepairs'>,
): WebsiteSetupChecklist {
  const focus = resolveWebsiteFocus(capabilities)
  // Un paso de una sección que la cuenta no puede usar no se pide.
  const availability = resolveSectionAvailability(capabilities)
  const usable = (step: WebsiteSetupStep) => availability[step.section].available
  const base = essentials(settings).filter(usable)
  const extra = recommended(settings, focus).filter(usable)
  const all = [...base, ...extra]
  return {
    focus,
    essentials: base,
    recommended: extra,
    done: all.filter((step) => step.done).length,
    total: all.length,
    next: all.find((step) => !step.done) ?? null,
  }
}
