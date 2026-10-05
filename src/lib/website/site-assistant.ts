import type { BusinessVertical } from '@/lib/organization/business-profile'
import type { WebsiteFocus, WebsiteSectionId } from '@/lib/website/setup-checklist'

/**
 * Asistente interno del sitio: arma textos con plantillas por rubro y lo que
 * cuenta el dueño. No llama a servicios externos ni tiene costo por uso.
 */

export const ASSISTANT_TRUST_ICONS = [
  'truck', 'credit-card', 'shield', 'message', 'star', 'award', 'zap', 'clock',
  'wrench', 'package', 'map-pin', 'thumbs-up', 'sparkles', 'handshake', 'check',
] as const

export type AssistantTrustIcon = (typeof ASSISTANT_TRUST_ICONS)[number]
export type AssistantTone = 'cercano' | 'profesional' | 'premium' | 'juvenil'
type TipSection = Exclude<WebsiteSectionId, 'overview'>

export interface WebsiteSuggestion {
  hero: { badge: string; title: string; subtitle: string; ctaPrimaryText: string; ctaSecondaryText: string }
  slogan: string
  description: string
  trustBar: Array<{ icon: AssistantTrustIcon; title: string; description: string }>
  tips: Array<{ section: TipSection; advice: string }>
}

export interface WebsiteAssistantInput {
  about: string
  tone: AssistantTone
  /** Cambia en cada "Probar de nuevo" para mostrar otra variante. */
  variant: number
  name: string
  vertical: BusinessVertical
  focus: WebsiteFocus
  services: string[]
  bookingAvailable: boolean
  commerceMode: 'cart' | 'whatsapp' | 'catalog'
  /** Pasos pendientes del checklist, en orden. */
  pending: Array<{ section: TipSection; title: string }>
}

interface VerticalCopy {
  noun: string
  badges: string[]
  titles: string[]
  offer: string
  slogans: string[]
  benefits: Array<[AssistantTrustIcon, string, string]>
}

const COPY: Record<BusinessVertical | 'repairs', VerticalCopy> = {
  barbershop: {
    noun: 'una barbería',
    badges: ['Reservá tu turno online', 'Cortes y barba', 'Turnos sin esperas'],
    titles: ['Tu mejor corte, sin esperas', 'Estilo que se nota', 'Cortes, barba y estilo en un solo lugar'],
    offer: 'cortes, perfilado de barba y estilo',
    slogans: ['Tu estilo, nuestro oficio', 'Cortes con detalle', 'Salí renovado'],
    benefits: [['clock', 'Reservá online', 'Elegí día, horario y profesional'], ['star', 'Atención con detalle', 'Cada corte a tu medida'], ['message', 'Te avisamos', 'Recordatorio de tu turno']],
  },
  clothing: {
    noun: 'una tienda de ropa',
    badges: ['Nueva temporada', 'Moda para todos los días', 'Colección disponible'],
    titles: ['Encontrá tu próximo look', 'Moda que va con vos', 'Prendas para cada momento'],
    offer: 'prendas y accesorios',
    slogans: ['Vestite a tu manera', 'Tu estilo empieza acá', 'Moda simple y cómoda'],
    benefits: [['message', 'Te asesoramos', 'Consultá talles por WhatsApp'], ['package', 'Stock actualizado', 'Lo que ves está disponible'], ['map-pin', 'Retiro en tienda', 'Pasá a buscar tu pedido']],
  },
  cosmetics: {
    noun: 'una tienda de cosmética',
    badges: ['Belleza y cuidado', 'Productos seleccionados', 'Novedades en belleza'],
    titles: ['Todo para tu rutina de belleza', 'Cuidate con lo mejor', 'Belleza que se siente'],
    offer: 'cosmética, cuidado de la piel y maquillaje',
    slogans: ['Tu belleza, tu momento', 'Cuidado que se nota', 'Brillá a tu manera'],
    benefits: [['award', 'Productos originales', 'Marcas de confianza'], ['handshake', 'Asesoramiento', 'Te ayudamos a elegir'], ['map-pin', 'Retiro en tienda', 'Pasá a buscar tu pedido']],
  },
  electronics: {
    noun: 'una tienda de tecnología',
    badges: ['Tecnología al día', 'Equipos y accesorios', 'Lo último en tecnología'],
    titles: ['La tecnología que necesitás', 'Equipos y accesorios al mejor precio', 'Conectate con lo último'],
    offer: 'celulares, accesorios y tecnología',
    slogans: ['Tecnología a tu alcance', 'Conectado con vos', 'Lo último, cerca tuyo'],
    benefits: [['shield', 'Compra segura', 'Productos revisados'], ['message', 'Soporte por WhatsApp', 'Respondemos tus dudas'], ['package', 'Stock disponible', 'Entrega inmediata en tienda']],
  },
  food: {
    noun: 'un comercio de alimentos',
    badges: ['Fresco todos los días', 'Pedí online', 'Sabor de casa'],
    titles: ['Lo de todos los días, más cerca', 'Productos frescos para tu mesa', 'Hacé tu pedido sin salir de casa'],
    offer: 'alimentos y productos frescos',
    slogans: ['Calidad que se saborea', 'Fresco y cerca', 'Todo para tu mesa'],
    benefits: [['zap', 'Pedido rápido', 'Armá tu compra en minutos'], ['star', 'Productos frescos', 'Seleccionados cada día'], ['message', 'Atención directa', 'Consultanos por WhatsApp']],
  },
  hardware: {
    noun: 'una ferretería',
    badges: ['Todo para tu obra', 'Herramientas y materiales', 'Stock disponible'],
    titles: ['Todo para tus proyectos', 'Herramientas y materiales en un solo lugar', 'Lo que tu obra necesita'],
    offer: 'herramientas, materiales y accesorios',
    slogans: ['Construí con confianza', 'La herramienta justa', 'Todo para tu obra'],
    benefits: [['package', 'Amplio stock', 'Lo que buscás, disponible'], ['handshake', 'Asesoramiento', 'Te ayudamos a elegir'], ['map-pin', 'Retiro en local', 'Pasá a buscar tu pedido']],
  },
  repairs: {
    noun: 'un servicio técnico',
    badges: ['Servicio técnico', 'Diagnóstico y reparación', 'Reparaciones con garantía'],
    titles: ['Reparamos tu equipo', 'Tu equipo en buenas manos', 'Diagnóstico claro, reparación confiable'],
    offer: 'diagnóstico y reparación de equipos',
    slogans: ['Reparamos con cuidado', 'Tu equipo, como nuevo', 'Soluciones que duran'],
    benefits: [['wrench', 'Técnicos con experiencia', 'Diagnóstico claro'], ['clock', 'Seguimiento online', 'Mirá el estado de tu equipo'], ['message', 'Te mantenemos al tanto', 'Avisos por WhatsApp']],
  },
  general: {
    noun: 'un comercio',
    badges: ['Comprá online', 'Novedades', 'Atención personalizada'],
    titles: ['Lo que buscás, en un solo lugar', 'Comprá fácil y rápido', 'Todo lo que necesitás, cerca tuyo'],
    offer: 'productos para el día a día',
    slogans: ['Cerca tuyo, siempre', 'Comprá fácil', 'Calidad y buena atención'],
    benefits: [['message', 'Atención directa', 'Consultanos por WhatsApp'], ['package', 'Stock actualizado', 'Lo que ves está disponible'], ['map-pin', 'Retiro en tienda', 'Pasá a buscar tu pedido']],
  },
  other: {
    noun: 'un negocio',
    badges: ['Bienvenido', 'Atención personalizada', 'Conocenos'],
    titles: ['Lo que buscás, en un solo lugar', 'Atención que marca la diferencia', 'Conocé lo que hacemos'],
    offer: 'productos y servicios',
    slogans: ['Cerca tuyo, siempre', 'Hecho con dedicación', 'Calidad y buena atención'],
    benefits: [['message', 'Atención directa', 'Consultanos por WhatsApp'], ['handshake', 'Trato cercano', 'Te acompañamos en tu compra'], ['star', 'Calidad', 'Lo hacemos con dedicación']],
  },
}

/** Palabras que, si el dueño las menciona, se vuelven un beneficio concreto. */
const MENTIONED_BENEFITS: Array<[RegExp, AssistantTrustIcon, string, string]> = [
  [/\b(delivery|env[ií]o|enviamos|a domicilio)/i, 'truck', 'Envíos a domicilio', 'Recibí tu pedido en casa'],
  [/\b(cuotas|tarjeta|transferencia|qr)/i, 'credit-card', 'Varias formas de pago', 'Pagá como te quede cómodo'],
  [/\bgarant[ií]a/i, 'shield', 'Con garantía', 'Comprá con tranquilidad'],
  [/\b(turno|reserva|cita|agenda)/i, 'clock', 'Reservá online', 'Elegí el horario que te quede bien'],
  [/\b(original|oficial|importad)/i, 'award', 'Productos originales', 'Marcas de confianza'],
  [/\b(r[aá]pido|express|mismo d[ií]a|al instante)/i, 'zap', 'Atención rápida', 'Sin largas esperas'],
  [/\b(retiro|sucursal|local)\b/i, 'map-pin', 'Retiro en el local', 'Pasá cuando quieras'],
  [/\b(asesor|te ayudamos|recomendamos)/i, 'handshake', 'Asesoramiento', 'Te ayudamos a elegir'],
  [/\b(a[nñ]os|experiencia|trayectoria)/i, 'star', 'Experiencia', 'Conocemos nuestro oficio'],
]

const TONE: Record<AssistantTone, { closing: string[]; secondary: string }> = {
  cercano: { closing: ['Te esperamos.', 'Escribinos cuando quieras.', 'Vení a conocernos.'], secondary: 'Escribinos' },
  profesional: { closing: ['Atención seria y responsable.', 'Calidad y cumplimiento en cada trabajo.', 'Estamos para ayudarte.'], secondary: 'Contactar' },
  premium: { closing: ['Una experiencia cuidada en cada detalle.', 'Calidad sin concesiones.', 'Lo mejor, pensado para vos.'], secondary: 'Conocer más' },
  juvenil: { closing: ['¡Pasá y mirá todo lo nuevo!', 'Sumate a la movida.', 'Te va a encantar.'], secondary: 'Hablemos' },
}

const TIP_ADVICE: Record<TipSection, string> = {
  company: 'Completá logo y WhatsApp: es lo primero que mira un cliente nuevo.',
  checkout: 'Definí cómo te compran (carrito, WhatsApp o solo catálogo) y activá al menos un pago y una entrega.',
  hero: 'Aplicá la portada sugerida y revisá que el botón principal lleve a la acción correcta.',
  trust_bar: 'Mostrá 3 beneficios reales; los sugeridos ya están listos para aplicar.',
  brands: 'Si vendés marcas conocidas, mostralas: generan confianza al instante.',
  carousel: 'Subí un banner con tu mejor promoción para darle vida a la portada.',
  offers: 'Cargá precios de oferta en el catálogo para que aparezcan en Ofertas.',
  announcement: 'Usá el aviso para algo puntual: un horario especial o una promo de la semana.',
  booking: 'Activá las reservas para que te pidan turno sin escribirte.',
  gallery: 'Subí al menos 3 fotos de tus trabajos: es lo que más convence.',
  services: 'Cargá tus servicios con precio y duración para que el cliente decida rápido.',
  process: 'Contá en 3 o 4 pasos cómo atendés: da tranquilidad.',
}

const pick = <T,>(items: T[], seed: number): T => items[((seed % items.length) + items.length) % items.length]

function hashText(text: string): number {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) | 0
  return Math.abs(hash)
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** "Barbería en Luque..." → "Luque". */
export function extractPlace(about: string): string | null {
  const match = about.match(/\ben\s+((?:San|Santa|Villa|Puerto|Ciudad del)\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/)
  if (!match) return null
  return `${match[1] ?? ''}${match[2]}`.trim()
}

/** "Hacemos cortes, barba y color." → ['cortes', 'barba', 'color']. */
export function extractOfferings(about: string): string[] {
  const match = about.match(/\b(?:hacemos|ofrecemos|vendemos|trabajamos con|tenemos|reparamos|especialistas en)\s+([^.;:\n]+)/i)
  if (!match) return []
  return match[1]
    .split(/,|\s+y\s+|\s+e\s+/)
    .map((part) => part.trim().replace(/\s+(de|para)\s+(lunes|martes|miércoles|jueves|viernes|sábado|domingo).*/i, ''))
    .filter((part) => part.length > 1 && part.length < 50)
    .slice(0, 5)
}

const joinList = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`

const clip = (value: string, max: number) => {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')
}

export function generateWebsiteSuggestion(input: WebsiteAssistantInput): WebsiteSuggestion {
  const copy = input.focus === 'repairs' ? COPY.repairs : COPY[input.vertical] ?? COPY.general
  const seed = hashText(input.about) + input.variant
  const place = extractPlace(input.about)
  const offerings = extractOfferings(input.about)
  const offered = offerings.length ? joinList(offerings) : input.services.length ? joinList(input.services.slice(0, 4).map((s) => s.toLowerCase())) : copy.offer
  const tone = TONE[input.tone]

  const primary = input.bookingAvailable || input.focus === 'services'
    ? 'Reservar turno'
    : input.focus === 'repairs'
      ? 'Ver servicios'
      : input.commerceMode === 'whatsapp'
        ? 'Ver productos'
        : 'Comprar ahora'

  const title = pick(copy.titles, seed)
  const subtitle = `${capitalize(offered)}${place ? ` en ${place}` : ''}. ${pick(tone.closing, seed + 1)}`
  const badge = place && input.variant % 2 === 1 ? `${pick(copy.badges, seed)} · ${place}` : pick(copy.badges, seed)

  const intro = input.name ? `${input.name} es ${copy.noun}${place ? ` en ${place}` : ''}.` : `Somos ${copy.noun}${place ? ` en ${place}` : ''}.`
  const how = input.bookingAvailable || input.focus === 'services'
    ? 'Reservá tu turno online, eligiendo el día y el horario que te queden mejor.'
    : input.commerceMode === 'whatsapp'
      ? 'Mirá el catálogo y hacé tu pedido por WhatsApp.'
      : input.focus === 'repairs'
        ? 'Traé tu equipo y seguí el estado de la reparación desde la web.'
        : 'Elegí tus productos y hacé tu pedido online.'
  const description = `${intro} Ofrecemos ${offered}. ${how} ${pick(tone.closing, seed + 2)}`

  // Primero lo que el dueño mencionó (es cierto), después lo propio del rubro.
  const mentioned = MENTIONED_BENEFITS
    .filter(([pattern]) => pattern.test(input.about))
    .map(([, icon, benefitTitle, benefitDescription]) => ({ icon, title: benefitTitle, description: benefitDescription }))
  const trustBar: WebsiteSuggestion['trustBar'] = []
  for (const item of [...mentioned, ...copy.benefits.map(([icon, t, d]) => ({ icon, title: t, description: d }))]) {
    if (trustBar.length >= 4) break
    if (trustBar.some((existing) => existing.icon === item.icon || existing.title === item.title)) continue
    trustBar.push(item)
  }

  const tips = input.pending
    .filter((step, index, all) => all.findIndex((other) => other.section === step.section) === index)
    .slice(0, 3)
    .map((step) => ({ section: step.section, advice: TIP_ADVICE[step.section] }))

  return {
    hero: {
      badge: clip(badge, 40),
      title: clip(title, 90),
      subtitle: clip(subtitle, 220),
      ctaPrimaryText: primary,
      ctaSecondaryText: tone.secondary,
    },
    slogan: clip(pick(copy.slogans, seed + 3), 90),
    description: clip(description, 600),
    trustBar: trustBar.map((item) => ({ ...item, title: clip(item.title, 40), description: clip(item.description, 90) })),
    tips,
  }
}
