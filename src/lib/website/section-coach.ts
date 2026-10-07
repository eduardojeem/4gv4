import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { StorefrontStyle } from '@/lib/website/storefront-style'
import type { WebsiteSectionId } from '@/lib/website/setup-checklist'
import { MAX_STORE_ANNOUNCEMENTS, announcementStatus, normalizeAnnouncementList } from '@/lib/announcements/announcement'
import { getConfiguredProcessFlows } from '@/lib/website/process-steps'
import { guidanceFamily, showsFinancialServices } from '@/lib/website/vertical-guidance'
import { hasStoreWhatsapp } from '@/lib/whatsapp-number'
import { reviewCartSetup } from '@/lib/checkout/cart-setup'

/**
 * Asistente de cada sección del sitio: revisa lo guardado con reglas propias
 * (sin servicios externos) y dice qué falta, qué no conviene y qué sigue.
 */

export type CoachSection = Exclude<WebsiteSectionId, 'overview'>
export type CoachLevel = 'ok' | 'warn' | 'tip'

export type CoachAction =
  | { kind: 'navigate'; section: CoachSection; label: string }
  | { kind: 'assistant'; label: string }

export interface CoachItem {
  level: CoachLevel
  text: string
  action?: CoachAction
}

export interface CoachContext {
  capabilities: StorefrontCapabilities
  storefrontStyle: StorefrontStyle
  /** Módulos activos de la cuenta; sin ellos no se revisa lo que depende del plan. */
  effectiveModules?: readonly string[]
  now?: Date
}

const REPAIR_WORDS = /reparaci|servicio técnico|soporte técnico|diagnóstico|repuestos?/i
const ok = (text: string): CoachItem => ({ level: 'ok', text })
const warn = (text: string, action?: CoachAction): CoachItem => ({ level: 'warn', text, action })
const tip = (text: string, action?: CoachAction): CoachItem => ({ level: 'tip', text, action })
const go = (section: CoachSection, label: string): CoachAction => ({ kind: 'navigate', section, label })
const ASSISTANT: CoachAction = { kind: 'assistant', label: 'Escribirlo con el asistente' }

function company(settings: WebsiteSettings): CoachItem[] {
  const info = settings.company_info
  const items: CoachItem[] = []
  if (!info.logoUrl?.trim()) items.push(warn('Falta el logo: es lo primero que mira un cliente nuevo.'))
  if (!(info.whatsapp || info.phone)?.trim()) items.push(warn('Cargá un WhatsApp o teléfono: sin eso no te pueden escribir.'))
  if (!info.address?.trim()) items.push(tip('Sumá la dirección para que te encuentren en el mapa.'))
  if (!info.hours?.weekdays?.trim()) items.push(tip('Indicá tu horario de atención.'))
  if ((info.description ?? '').trim().length < 40) items.push(tip('Escribí una descripción de 2 o 3 líneas sobre tu negocio.', ASSISTANT))
  if (info.storefrontPublic !== true) items.push(warn('Tu tienda todavía no está publicada: nadie la puede ver.'))
  if (items.length === 0) items.push(ok('Identidad y contacto completos.'))
  return items
}

function hero(settings: WebsiteSettings, ctx: CoachContext): CoachItem[] {
  const content = settings.hero_content
  const items: CoachItem[] = []
  if (!content || content.enabled === false) {
    return [tip('La portada está oculta: tu inicio arranca con la sección siguiente.')]
  }
  const title = content.title?.trim() ?? ''
  if (title.length < 10) items.push(warn('El título es muy corto: decí en una frase qué ofrecés.', ASSISTANT))
  else if (title.length > 70) items.push(tip('El título es largo: en el celular se lee mejor con menos de 70 letras.'))
  if ((content.badge ?? '').length > 32) items.push(tip('La etiqueta es larga: 2 a 4 palabras alcanzan.'))
  const copy = [content.badge, content.title, content.subtitle, content.ctaPrimaryText, content.ctaSecondaryText].join(' ')
  if (!ctx.capabilities.hasRepairs && REPAIR_WORDS.test(copy)) {
    items.push(warn('Los textos hablan de reparaciones y tu cuenta no tiene ese módulo.', ASSISTANT))
  }
  if (ctx.storefrontStyle !== 'classic' && settings.promotional_carousel?.slides?.some((slide) => slide.active)) {
    items.push(tip('Tenés banners activos: en tu plantilla se muestran en lugar de la portada.', go('carousel', 'Ver banners')))
  }
  if (items.length === 0) items.push(ok('Portada clara y acorde a tu negocio.'))
  return items
}

/** Beneficios que prometen algo que el sitio no tiene configurado. */
function trustBar(settings: WebsiteSettings, ctx: CoachContext): CoachItem[] {
  const bar = settings.trust_bar
  const items: CoachItem[] = []
  if (!bar || bar.enabled === false) return [tip('Los beneficios están ocultos. Mostrar 3 ventajas reales da confianza.')]
  const active = bar.items.filter((item) => item.active !== false && item.title.trim())
  if (active.length === 0) return [warn('No hay beneficios activos: la franja queda vacía.', ASSISTANT)]
  if (active.length < 3) items.push(tip('Con 3 o 4 beneficios la franja se ve completa.'))
  if (active.length > 4) items.push(tip(`Tenés ${active.length} activos: con 3 o 4 se leen mejor.`))
  const long = active.filter((item) => item.title.trim().length > 28)
  if (long.length > 0) items.push(tip(`Acortá «${long[0].title.trim()}»: un título de 2 a 4 palabras se entiende de un vistazo.`))

  const text = active.map((item) => `${item.title} ${item.description}`).join(' ').toLowerCase()
  const checkout = settings.checkout
  if (/env[ií]o|delivery|domicilio/.test(text) && checkout && checkout.commerceMode === 'cart' && !checkout.delivery?.enabled) {
    items.push(warn('Prometés envíos, pero el envío a domicilio está apagado en Pagos y entregas.', go('checkout', 'Configurar envíos')))
  }
  if (/retiro|retir[aá]/.test(text) && checkout && checkout.commerceMode === 'cart' && !checkout.pickup?.enabled) {
    items.push(warn('Prometés retiro en el local, pero el retiro está apagado en Pagos y entregas.', go('checkout', 'Configurar retiro')))
  }
  if (/whatsapp/.test(text) && !(settings.company_info.whatsapp || settings.company_info.phone)?.trim()) {
    items.push(warn('Mencionás WhatsApp, pero no cargaste un número.', go('company', 'Cargar WhatsApp')))
  }
  if (/turno|reserv/.test(text) && !ctx.capabilities.hasServices) {
    items.push(warn('Mencionás turnos, pero tu cuenta no tiene agenda.'))
  }
  if (!ctx.capabilities.hasRepairs && REPAIR_WORDS.test(text)) {
    items.push(warn('Un beneficio habla de reparaciones y tu cuenta no tiene ese módulo.'))
  }
  if (items.every((item) => item.level !== 'warn')) items.unshift(ok(`${active.length} beneficios activos y coherentes con tu configuración.`))
  return items
}

function announcement(settings: WebsiteSettings, ctx: CoachContext): CoachItem[] {
  const now = ctx.now ?? new Date()
  const list = normalizeAnnouncementList(settings.announcements ?? settings.announcement, MAX_STORE_ANNOUNCEMENTS)
  if (list.length === 0) return [tip('No tenés avisos. Usalo para algo puntual: un feriado, una promo o una novedad.')]
  const statuses = list.map((item) => announcementStatus(item, now))
  const live = statuses.filter((status) => status === 'activo').length
  const items: CoachItem[] = []
  if (live === 0) items.push(tip('Ningún aviso está vigente ahora.'))
  if (live > 1) items.push(warn(`Hay ${live} avisos vigentes: se muestra solo el primero de la lista.`))
  const expired = statuses.filter((status) => status === 'vencido').length
  if (expired > 0) items.push(tip(`${expired === 1 ? 'Un aviso venció' : `${expired} avisos vencieron`}: borralo o cambiale las fechas.`))
  if (statuses.includes('incompleto')) items.push(warn('Un aviso activado no tiene título o mensaje.'))
  if (items.length === 0) items.push(ok('Tu aviso está vigente y completo.'))
  return items
}

function process(settings: WebsiteSettings, ctx: CoachContext): CoachItem[] {
  if (settings.company_info.processSectionEnabled === false) {
    return [tip('La sección está oculta. Contar en 3 o 4 pasos cómo atendés da tranquilidad.')]
  }
  const flows = getConfiguredProcessFlows(settings.process_flows, settings.process_steps).filter((flow) => flow.active !== false)
  if (flows.length === 0) return [warn('No hay recorridos visibles: la sección queda vacía.')]
  const items: CoachItem[] = []
  const family = guidanceFamily(ctx.capabilities)
  const text = flows.map((flow) => `${flow.title} ${flow.steps.map((step) => step.title).join(' ')}`).join(' ')
  if (!ctx.capabilities.hasRepairs && REPAIR_WORDS.test(text)) items.push(warn('Un recorrido habla de reparaciones y tu cuenta no tiene ese módulo.'))
  if (!showsFinancialServices(family) && /giro|billetera|pago de facturas/i.test(text)) items.push(warn('Un recorrido es de pagos y giros, que no es de tu rubro.'))
  const long = flows.find((flow) => flow.steps.length > 5)
  if (long) items.push(tip(`«${long.title}» tiene ${long.steps.length} pasos: con 3 a 5 se entiende mejor.`))
  if (flows.length > 3) items.push(tip('Más de 3 recorridos se vuelven difíciles de elegir.'))
  if (items.length === 0) items.push(ok(`${flows.length === 1 ? 'Un recorrido claro' : `${flows.length} recorridos claros`} y acorde a tu negocio.`))
  return items
}

function services(settings: WebsiteSettings, ctx: CoachContext): CoachItem[] {
  const active = (settings.services ?? []).filter((service) => service.active !== false)
  if (active.length === 0) return [warn('No hay servicios publicados: cargá al menos uno con precio y duración.')]
  const items: CoachItem[] = []
  const noPrice = active.filter((service) => service.price == null || String(service.price).trim() === '')
  if (noPrice.length > 0) items.push(tip(`${noPrice.length === 1 ? `«${noPrice[0].title}» no tiene` : `${noPrice.length} servicios no tienen`} precio: aunque sea «Desde…», ayuda a decidir.`))
  const noDuration = active.filter((service) => !service.duration?.trim())
  if (noDuration.length > 0) items.push(tip(`${noDuration.length === 1 ? `«${noDuration[0].title}» no tiene` : `${noDuration.length} servicios no tienen`} duración.`))
  if (!ctx.capabilities.hasRepairs && active.some((service) => REPAIR_WORDS.test(`${service.title} ${service.description}`))) {
    items.push(warn('Hay servicios de reparación y tu cuenta no tiene ese módulo.'))
  }
  if (!showsFinancialServices(guidanceFamily(ctx.capabilities)) && active.some((service) => /giro|billetera|factura/i.test(service.title))) {
    items.push(warn('Hay servicios de pagos y giros, que no son de tu rubro.'))
  }
  if (ctx.capabilities.businessVertical === 'barbershop' && !settings.booking_section?.enabled) {
    items.push(tip('Activá las reservas en tu inicio: tus clientes sacan turno sin escribirte.', go('booking', 'Ir a Reservas')))
  }
  if (items.length === 0) items.push(ok(`${active.length} servicios con precio y duración.`))
  return items
}

function checkout(settings: WebsiteSettings, ctx: CoachContext): CoachItem[] {
  const config = settings.checkout
  if (!config) return [tip('Elegí cómo te compran: carrito, WhatsApp o solo catálogo.')]
  const modules = ctx.effectiveModules
  const hasModule = (module: string) => !modules || modules.length === 0 || modules.includes(module)
  if (config.commerceMode === 'whatsapp') {
    return hasStoreWhatsapp(settings.company_info)
      ? [ok('Te piden por WhatsApp.')]
      : [warn('Elegiste consultas por WhatsApp, pero no hay un número válido cargado.', go('company', 'Cargar WhatsApp'))]
  }
  if (config.commerceMode === 'catalog') return [ok('Mostrás el catálogo sin compra online.')]
  const items: CoachItem[] = []
  if (!hasModule('orders')) {
    items.push(warn(hasStoreWhatsapp(settings.company_info)
      ? 'Tu plan no incluye pedidos online: la tienda atiende por WhatsApp aunque elijas carrito.'
      : 'Tu plan no incluye pedidos online y no hay WhatsApp: la tienda queda como catálogo, sin forma de pedir.'))
  }
  if (config.delivery?.enabled && !hasModule('delivery')) {
    items.push(warn(config.pickup?.enabled
      ? 'El delivery está activado, pero tu cuenta no tiene el módulo Entregas: tus clientes solo ven retiro en el local.'
      : 'El delivery está activado sin el módulo Entregas y el retiro está apagado: nadie puede terminar una compra.'))
  }
  if (guidanceFamily(ctx.capabilities) === 'food' && config.delivery?.enabled && !config.minOrderAmount) {
    items.push(tip('Un pedido mínimo hace rentable cada envío.'))
  }
  // Las mismas reglas que el editor del carrito: lo que no deja guardar es un aviso.
  for (const issue of reviewCartSetup(config, { company: settings.company_info, deliveryModuleEnabled: hasModule('delivery') })) {
    const action = issue.fixIn === 'company' ? go('company', 'Cargar en Empresa') : undefined
    items.push(issue.level === 'error' ? warn(issue.message, action) : tip(issue.message, action))
  }
  if (items.length === 0) items.push(ok('Pagos y entregas listos para recibir pedidos.'))
  return items
}

function simple(section: CoachSection, settings: WebsiteSettings, ctx: CoachContext): CoachItem[] {
  switch (section) {
    case 'carousel': {
      const slides = settings.promotional_carousel?.slides ?? []
      const active = slides.filter((slide) => slide.active)
      if (active.length === 0) return [tip('Sin banners activos. Uno con tu mejor promo le da vida al inicio.')]
      if (ctx.storefrontStyle !== 'classic') return [tip('En tu plantilla los banners activos reemplazan a la portada.', go('hero', 'Ver portada')), ok(`${active.length} banners activos.`)]
      return [ok(`${active.length} banners activos.`)]
    }
    case 'offers':
      return settings.offers_section?.enabled === false
        ? [tip('La sección de ofertas está oculta.')]
        : [tip('Las ofertas salen de los precios de oferta del catálogo y de Promociones.')]
    case 'brands': {
      const brands = (settings.brands_section?.items ?? []).filter((brand) => brand.active)
      if (!settings.brands_section?.enabled || brands.length === 0) return [tip('Si vendés marcas conocidas, mostralas: generan confianza.')]
      return [ok(`${brands.length} marcas visibles.`)]
    }
    case 'gallery': {
      const images = settings.gallery_section?.images ?? []
      if (!settings.gallery_section?.enabled) return [tip('La galería está oculta. Las fotos de tus trabajos son lo que más convence.')]
      if (images.length < 3) return [tip('Subí al menos 3 fotos para que la galería se vea completa.')]
      return [ok(`${images.length} fotos en la galería.`)]
    }
    case 'booking':
      return settings.booking_section?.enabled
        ? [ok('Tus clientes reservan desde el inicio.')]
        : [tip('Activá la reserva en el inicio para recibir turnos sin escribirte.')]
    default:
      return []
  }
}

export function reviewWebsiteSection(section: CoachSection, settings: WebsiteSettings, ctx: CoachContext): CoachItem[] {
  switch (section) {
    case 'company': return company(settings)
    case 'hero': return hero(settings, ctx)
    case 'trust_bar': return trustBar(settings, ctx)
    case 'announcement': return announcement(settings, ctx)
    case 'process': return process(settings, ctx)
    case 'services': return services(settings, ctx)
    case 'checkout': return checkout(settings, ctx)
    default: return simple(section, settings, ctx)
  }
}

/** Las secciones donde el asistente general puede escribir los textos. */
export const ASSISTANT_WRITES: ReadonlySet<CoachSection> = new Set(['company', 'hero', 'trust_bar'])
