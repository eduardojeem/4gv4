import type { PromotionalCarouselSlide } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { StorefrontStyle } from '@/lib/website/storefront-style'

/**
 * Plantillas, ideas y enlaces del carrusel según lo que tiene la tienda. Antes
 * eran fijos para una tienda de celulares: una barbería veía «Servicio técnico»,
 * la plantilla de cosmética traía la foto de accesorios de celular y los
 * atajos llevaban a secciones que la tienda no tiene.
 */
export type CarouselContext = Pick<StorefrontCapabilities, 'businessVertical' | 'hasCatalog' | 'hasServices' | 'hasRepairs'>

type Needs = 'catalog' | 'services' | 'repairs'

export interface CarouselExample {
  name: string
  category: string
  badgeIcon?: string
  /** Qué tiene que tener la tienda para que tenga sentido. */
  needs: Needs
  /** Rubros para los que se recomienda; sin lista, para cualquiera. */
  verticals?: readonly string[]
  slide: Omit<PromotionalCarouselSlide, 'id' | 'active'>
}

const ANY_STORE = ['general', 'other'] as const

/**
 * Sin foto propia (`imageUrl: ''`) la plantilla completa los textos y pide la
 * imagen: mejor eso que una foto de otro rubro.
 */
export const CAROUSEL_EXAMPLES: readonly CarouselExample[] = [
  {
    name: 'Reservá tu turno', category: 'Servicios', badgeIcon: '✂️', needs: 'services', verticals: ['barbershop', 'beauty_services', 'cosmetics', ...ANY_STORE],
    slide: { title: 'Reservá tu turno online', message: 'Elegí el servicio, el día y el horario en un minuto. Sin llamadas ni esperas.', imageUrl: '', imageAlt: '', ctaText: 'Reservar turno', ctaHref: '/turnos', textTone: 'light', contentAlign: 'left' },
  },
  {
    name: 'Promo de la semana', category: 'Servicios', badgeIcon: '⭐', needs: 'services', verticals: ['barbershop', 'beauty_services', 'cosmetics', ...ANY_STORE],
    slide: { title: 'Precio especial de lunes a jueves', message: 'Aprovechá la promo de la semana: reservá tu lugar antes de que se llenen los horarios.', imageUrl: '', imageAlt: '', ctaText: 'Reservar ahora', ctaHref: '/turnos', textTone: 'light', contentAlign: 'center' },
  },
  {
    name: 'Accesorios Tech', category: 'Tecnología', badgeIcon: '📱', needs: 'catalog', verticals: ['electronics', ...ANY_STORE],
    slide: { title: 'Todo para acompañar tu celular', message: 'Descubrí cargadores, cables, auriculares y fundas seleccionadas con garantía.', imageUrl: '/images/promotional-carousel/accesorios.webp', imageAlt: 'Cargadores, cables, auriculares y fundas para celulares', ctaText: 'Ver accesorios', ctaHref: '/productos', textTone: 'dark', contentAlign: 'left' },
  },
  {
    name: 'Renovación de Celulares', category: 'Tecnología', badgeIcon: '📱', needs: 'catalog', verticals: ['electronics', ...ANY_STORE],
    slide: { title: 'Encontrá tu próximo celular', message: 'Conocé los equipos disponibles y elegí el que mejor se adapta a vos con financiación.', imageUrl: '/images/promotional-carousel/renovacion.webp', imageAlt: 'Tres celulares modernos exhibidos en una tienda', ctaText: 'Ver celulares', ctaHref: '/productos', textTone: 'dark', contentAlign: 'right' },
  },
  {
    name: 'Servicio Técnico Especializado', category: 'Reparaciones', badgeIcon: '🔧', needs: 'repairs',
    slide: { title: 'Tu equipo en manos expertas', message: 'Diagnóstico claro, repuestos originales y reparación profesional con seguimiento online.', imageUrl: '/images/promotional-carousel/reparacion.webp', imageAlt: 'Técnico revisando un celular en una mesa de reparación', ctaText: 'Seguir mi reparación', ctaHref: '/mis-reparaciones', textTone: 'dark', contentAlign: 'left' },
  },
  {
    name: 'Nueva Colección de Ropa', category: 'Moda & Ropa', badgeIcon: '👗', needs: 'catalog', verticals: ['clothing', ...ANY_STORE],
    slide: { title: 'Nueva Colección de Temporada', message: 'Renová tu estilo con las últimas tendencias en prendas y calzados exclusivos.', imageUrl: '/images/promotional-carousel/hero-moda-esenciales.jpg', imageAlt: 'Prendas de vestir y ropa de moda', ctaText: 'Ver colección', ctaHref: '/productos', textTone: 'dark', contentAlign: 'right' },
  },
  {
    name: 'Moda Urbana & Streetwear', category: 'Moda & Ropa', badgeIcon: '🔥', needs: 'catalog', verticals: ['clothing', ...ANY_STORE],
    slide: { title: 'Estilo Urbano & Calce Relajado', message: 'Prendas básicas y oversize confeccionadas en algodón peinado premium para todo el día.', imageUrl: '/images/promotional-carousel/hero-moda-urbana.jpg', imageAlt: 'Modelos vistiendo prendas urbanas oversize y hoodies de moda', ctaText: 'Ver catálogo', ctaHref: '/productos', textTone: 'light', contentAlign: 'left' },
  },
  {
    name: 'Uniformes & Línea Corporativa', category: 'Moda & Ropa', badgeIcon: '💼', needs: 'catalog', verticals: ['clothing', ...ANY_STORE],
    slide: { title: 'Prendas Corporativas para Empresas', message: 'Camperas softshell, chombas polo y remeras con bordado de tu marca y precio mayorista.', imageUrl: '/images/promotional-carousel/hero-linea-corporativa.jpg', imageAlt: 'Equipo corporativo profesional con uniformes institucionales y camperas softshell', ctaText: 'Ver Línea Empresas', ctaHref: '/productos', textTone: 'dark', contentAlign: 'right' },
  },
  {
    name: 'Cuidado Facial & Belleza', category: 'Cosmética', badgeIcon: '💄', needs: 'catalog', verticals: ['cosmetics', 'beauty_services', ...ANY_STORE],
    slide: { title: 'Cuidado Personal & Skincare', message: 'Productos 100% originales para realzar tu belleza y cuidar tu piel día a día.', imageUrl: '', imageAlt: '', ctaText: 'Explorar catálogo', ctaHref: '/productos', textTone: 'light', contentAlign: 'left' },
  },
  {
    name: 'Herramientas Profesionales', category: 'Ferretería', badgeIcon: '🔨', needs: 'catalog', verticals: ['hardware', ...ANY_STORE],
    slide: { title: 'Herramientas & Materiales', message: 'Equipate con las mejores marcas, asesoramiento técnico y garantía de fábrica.', imageUrl: '', imageAlt: '', ctaText: 'Ver herramientas', ctaHref: '/productos', textTone: 'light', contentAlign: 'left' },
  },
  {
    name: 'Ofertas de la semana', category: 'Alimentos', badgeIcon: '🛒', needs: 'catalog', verticals: ['food', ...ANY_STORE],
    slide: { title: 'Ofertas de la semana', message: 'Precios especiales en tus productos de todos los días, hasta agotar stock.', imageUrl: '', imageAlt: '', ctaText: 'Ver ofertas', ctaHref: '/productos?ofertas=true', textTone: 'light', contentAlign: 'left' },
  },
  {
    name: 'Envíos Gratis a Todo el País', category: 'Promociones', badgeIcon: '🚚', needs: 'catalog',
    slide: { title: 'Envíos Gratis a Todo el País', message: 'Hacé tu pedido hoy y recibilo en la comodidad de tu hogar sin costo de envío.', imageUrl: '', imageAlt: '', ctaText: 'Comprar ahora', ctaHref: '/productos', textTone: 'light', contentAlign: 'center' },
  },
]

const hasNeed = (context: CarouselContext, needs: Needs) =>
  needs === 'catalog' ? context.hasCatalog : needs === 'services' ? context.hasServices : context.hasRepairs

/** Las plantillas que tienen sentido para la tienda; primero las de su rubro. */
export function carouselExamplesFor(context: CarouselContext) {
  const usable = CAROUSEL_EXAMPLES.filter((example) => hasNeed(context, example.needs))
  const fitsVertical = (example: CarouselExample) => !example.verticals || example.verticals.includes(context.businessVertical)
  const relevant = usable.filter(fitsVertical)
  return [...relevant, ...usable.filter((example) => !fitsVertical(example))]
    .map((example) => ({ ...example, recommended: Boolean(example.verticals?.includes(context.businessVertical)) }))
}

export interface CarouselLinkShortcut { label: string; href: string }

/** Atajos de enlace: solo a secciones que la tienda tiene. */
export function carouselLinkShortcuts(context: CarouselContext): CarouselLinkShortcut[] {
  return [
    ...(context.hasServices ? [{ label: 'Reservar turno (/turnos)', href: '/turnos' }, { label: 'Servicios (/servicios)', href: '/servicios' }] : []),
    ...(context.hasCatalog ? [{ label: 'Catálogo (/productos)', href: '/productos' }, { label: 'Ofertas (/productos?ofertas=true)', href: '/productos?ofertas=true' }] : []),
    ...(context.hasRepairs ? [{ label: 'Seguimiento de reparaciones (/mis-reparaciones)', href: '/mis-reparaciones' }] : []),
  ]
}

/** Ideas de títulos, mensajes y botones del rubro. */
export function carouselSuggestions(context: CarouselContext) {
  const titles: string[] = []
  const messages: string[] = []
  const buttons: string[] = []
  if (context.hasServices) {
    titles.push('Reservá tu turno online', 'Promo de la semana', 'Nuevo servicio disponible')
    messages.push('Elegí el servicio, el día y el horario en un minuto.', 'Reservá tu lugar antes de que se llenen los horarios.')
    buttons.push('Reservar turno', 'Ver servicios')
  }
  if (context.hasCatalog) {
    titles.push('30% OFF en Seleccionados', 'Los Productos Más Vendidos', 'Ofertas Exclusivas de la Semana', 'Hasta 6 Cuotas Sin Interés')
    messages.push('Aprovechá precios especiales y descuentos por tiempo limitado.', 'Consultá nuestro catálogo y hacé tu pedido directo por WhatsApp.')
    buttons.push('Ver ofertas', 'Comprar ahora', 'Ver catálogo', 'Pedir por WhatsApp')
    if (context.businessVertical === 'clothing') titles.push('Nueva Colección de Temporada', 'Liquidación de Temporada')
    if (context.businessVertical === 'electronics') titles.push('Renovación de Equipos al Mejor Precio')
  }
  if (context.hasRepairs) {
    titles.push('Tu equipo en manos expertas')
    messages.push('Diagnóstico claro, repuestos originales y atención técnica especializada.')
    buttons.push('Seguir mi reparación')
  }
  if (buttons.length === 0) buttons.push('Escribinos', 'Ver más')
  return { titles, messages, buttons }
}

/** Botón de una diapositiva nueva: adonde la tienda tiene algo que mostrar. */
export function defaultSlideCta(context: CarouselContext): Pick<PromotionalCarouselSlide, 'ctaText' | 'ctaHref'> {
  if (context.hasServices && !context.hasCatalog) return { ctaText: 'Reservar turno', ctaHref: '/turnos' }
  if (context.hasCatalog) return { ctaText: 'Ver productos', ctaHref: '/productos' }
  if (context.hasServices) return { ctaText: 'Reservar turno', ctaHref: '/turnos' }
  return { ctaText: '', ctaHref: '' }
}

/** Si el botón lleva a una sección que la tienda no tiene, por qué. */
export function slideLinkProblem(href: string | undefined, context: CarouselContext): string | null {
  const path = (href ?? '').trim().split(/[?#]/)[0]
  if (!path || !path.startsWith('/')) return null
  if (path === '/productos' && !context.hasCatalog) return 'Lleva al catálogo, pero tu tienda no vende productos.'
  if ((path === '/servicios' || path === '/turnos') && !context.hasServices) return 'Lleva a los servicios, pero tu tienda no tiene la agenda activa.'
  if (path === '/mis-reparaciones' && !context.hasRepairs) return 'Lleva a reparaciones, pero tu tienda no tiene ese módulo.'
  return null
}

/** Dónde aparece el carrusel en cada plantilla. */
export function carouselPlacement(style: StorefrontStyle) {
  if (style === 'classic') {
    return { replacesHero: false, text: 'En tu plantilla Clásica el carrusel aparece debajo de la portada principal.' }
  }
  return {
    replacesHero: true,
    text: style === 'services'
      ? 'En tu plantilla Servicios, con el carrusel activo los banners reemplazan la portada (la de «Reservar turno», horario y dirección).'
      : 'En tu plantilla, con el carrusel activo los banners reemplazan la portada principal.',
  }
}
