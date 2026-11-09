import type { BusinessVertical } from '@/lib/organization/business-profile'
import type { PublicCommerceMode } from '@/types/website-settings'

/**
 * Aspecto de la tienda online.
 *
 * Cada tienda puede adoptar un tema visual / plantilla adaptada a su nicho:
 * - `classic`: Clásico confiable para múltiples rubros con fotos completas apaisadas.
 * - `fashion`: Boutique y moda con fotos verticales a sangre y tipografía estilizada.
 * - `sport`: Deportivo y streetwear con tipografía contundente y alto impacto visual.
 * - `tech`: Electrónica, celulares, informática y servicios técnicos.
 * - `market`: Supermercados, almacenes, ferreterías y retail con precios destacados.
 * - `modern`: Diseño contemporáneo / studio minimalista con bordes suaves redondeados.
 * - `services`: Peluquerías, barberías y estética: servicios con precio y turnos online primero.
 * - `beauty`: Cosmética, maquillaje, skincare y perfumería: compra por necesidad, marcas y rutinas.
 * - `wholesale-pro`: Catálogo mayorista & retail moderno.
 * - `catalog-basic`: Vitrina simple para exhibición de productos sin botones de compra ni carrito.
 *
 * `classic` es el aspecto por defecto donde no hay una tienda resuelta (dashboard, marketplace).
 */
export const STOREFRONT_STYLE_PREFERENCES = [
  'auto',
  'classic',
  'fashion',
  'sport',
  'tech',
  'market',
  'modern',
  'services',
  'beauty',
  'wholesale-pro',
  'catalog-basic',
  'informatica-electronica',
  'barber',
] as const

export type StorefrontStylePreference = (typeof STOREFRONT_STYLE_PREFERENCES)[number]
export type StorefrontStyle = Exclude<StorefrontStylePreference, 'auto'>

export const DEFAULT_STOREFRONT_STYLE: StorefrontStyle = 'classic'

/**
 * Mapeo canónico de rubro a aspecto/plantilla de tienda.
 * Utilizado para resolver 'auto' y como sugerencia predeterminada.
 */
export const STYLE_BY_VERTICAL: Record<BusinessVertical, StorefrontStyle> = {
  general: 'classic',
  clothing: 'fashion',
  cosmetics: 'beauty',
  electronics: 'tech',
  food: 'market',
  hardware: 'classic',
  barbershop: 'services',
  beauty_services: 'services',
  other: 'classic',
}

export interface StorefrontStyleContext {
  /**
   * La cuenta usa el módulo Servicios (agenda). Sin dato se asume que sí, para
   * no cambiar nada donde no se sabe.
   */
  servicesAvailable?: boolean
  /** La tienda vende productos (módulo de inventario). Sin dato se asume que sí. */
  catalogAvailable?: boolean
  /** El rubro de la cuenta; si no viene, se usa el que recibe resolveStorefrontStyle. */
  businessVertical?: unknown
  /** Modo de venta resuelto de la tienda (cart | whatsapp | catalog). */
  commerceMode?: PublicCommerceMode
}

/** Negocios de turnos: su sitio gira alrededor de la agenda, no de un catálogo. */
const SERVICE_VERTICALS = new Set<string>(['barbershop', 'beauty_services'])
/**
 * Negocios de productos: sus servicios van en una sección de su plantilla, no
 * como un sitio de turnos. Cosmética queda afuera: suele sumar estética o spa.
 */
const PRODUCT_VERTICALS = new Set<string>(['clothing', 'electronics', 'food', 'hardware'])
/**
 * Plantillas de tienda que encajan en un negocio de servicios que además vende
 * productos. Supermercado, Tecnología, Moda y Deportivo se arman alrededor de
 * góndolas, fichas técnicas y talles: en una barbería mostraban un catálogo ajeno.
 */
const STORE_STYLES_FOR_SERVICE_VERTICAL: Record<string, readonly StorefrontStyle[]> = {
  barbershop: ['classic', 'modern'],
  beauty_services: ['classic', 'modern', 'beauty'],
}

/** Lo que muestra una barbería sin agenda: limpio y con fotos, sin reserva al frente. */
const SERVICES_FALLBACK_STYLE: StorefrontStyle = 'modern'

/**
 * Qué plantillas tienen sentido para la cuenta, para no mezclar un sitio de
 * turnos con una tienda:
 * - «Servicios» gira alrededor de la agenda (carta, equipo y reserva): necesita
 *   el módulo Servicios y no se ofrece a rubros de productos.
 * - «Catálogo básico» solo se ofrece cuando el modo comercial resuelto es 'catalog'.
 * - En rubros de servicios, las plantillas de tienda solo si vende productos, y
 *   solo las que encajan con el rubro.
 */
export function isStorefrontStyleAvailable(style: StorefrontStylePreference, context: StorefrontStyleContext = {}): boolean {
  if (style === 'auto' || style === 'wholesale-pro') return true
  if (style === 'catalog-basic') {
    return context.commerceMode === 'catalog'
  }
  const vertical = typeof context.businessVertical === 'string' ? context.businessVertical : ''
  if (style === 'services' || style === 'barber') {
    return context.servicesAvailable !== false && !PRODUCT_VERTICALS.has(vertical)
  }
  if (SERVICE_VERTICALS.has(vertical)) {
    return context.catalogAvailable !== false && (STORE_STYLES_FOR_SERVICE_VERTICAL[vertical] ?? []).includes(style)
  }
  return true
}

export function resolveStorefrontStyle(preference: unknown, businessVertical: unknown, context: StorefrontStyleContext = {}): StorefrontStyle {
  context = { businessVertical, ...context }
  const validVertical = typeof businessVertical === 'string' && Object.prototype.hasOwnProperty.call(STYLE_BY_VERTICAL, businessVertical)
    ? (businessVertical as BusinessVertical)
    : undefined
  const byVertical = validVertical ? STYLE_BY_VERTICAL[validVertical] : DEFAULT_STOREFRONT_STYLE

  const isExplicit = (
    preference === 'classic' ||
    preference === 'fashion' ||
    preference === 'sport' ||
    preference === 'tech' ||
    preference === 'market' ||
    preference === 'modern' ||
    preference === 'services' ||
    preference === 'beauty' ||
    preference === 'wholesale-pro' ||
    preference === 'catalog-basic' ||
    preference === 'informatica-electronica' ||
    preference === 'barber'
  )

  const chosen: StorefrontStyle = isExplicit
    ? (preference as StorefrontStyle)
    : byVertical

  // Una plantilla que ya no corresponde (quitó la agenda, cambió de rubro) vuelve
  // a la de su rubro en lugar de mostrar una portada vacía o datos de otro negocio.
  if (!isStorefrontStyleAvailable(chosen, context)) {
    // Un negocio de servicios cae en Moderno (fotos y contacto); una tienda, en Clásico (catálogo).
    const order = SERVICE_VERTICALS.has(String(businessVertical)) ? [SERVICES_FALLBACK_STYLE, DEFAULT_STOREFRONT_STYLE] : [DEFAULT_STOREFRONT_STYLE, SERVICES_FALLBACK_STYLE]
    const fallback = [byVertical, ...order]
      .find((style): style is StorefrontStyle => Boolean(style) && style !== chosen && isStorefrontStyleAvailable(style, context))
    return fallback ?? SERVICES_FALLBACK_STYLE
  }
  return chosen
}

export type TemplateCompatibilityStatus = 'current' | 'recommended' | 'requires_modules' | 'compatible'

export interface TemplateCompatibilityResult {
  status: TemplateCompatibilityStatus
  isCurrent: boolean
  isRecommended: boolean
  isCompatible: boolean
  warnings: string[]
  missingModules: string[]
  missingData?: string[]
}

/**
 * Valida la compatibilidad entre una plantilla, el rubro y los módulos del negocio.
 * Permite advertir sin bloquear innecesariamente (ALLOW + WARNING).
 */
export function getTemplateCompatibility(input: {
  storefrontStyle: StorefrontStyle
  currentStyle?: StorefrontStylePreference
  businessVertical?: unknown
  modules?: readonly string[] | null
  servicesAvailable?: boolean
  repairsAvailable?: boolean
  catalogAvailable?: boolean
  categories?: readonly { name: string }[]
  commerceMode?: PublicCommerceMode
}): TemplateCompatibilityResult {
  const { storefrontStyle, currentStyle, businessVertical, modules, servicesAvailable, categories, commerceMode } = input

  const vertical = typeof businessVertical === 'string' && Object.prototype.hasOwnProperty.call(STYLE_BY_VERTICAL, businessVertical)
    ? (businessVertical as BusinessVertical)
    : undefined
  const recommendedStyle = commerceMode === 'catalog'
    ? 'catalog-basic'
    : (vertical ? STYLE_BY_VERTICAL[vertical] : DEFAULT_STOREFRONT_STYLE)
  const isRecommended = storefrontStyle === 'wholesale-pro'
    ? ['electronics', 'hardware', 'general'].includes(String(vertical))
    : storefrontStyle === 'informatica-electronica'
    ? ['electronics', 'general'].includes(String(vertical))
    : storefrontStyle === 'barber'
    ? ['barbershop', 'beauty_services'].includes(String(vertical))
    : storefrontStyle === recommendedStyle
  const resolvedCurrent = currentStyle === 'auto'
    ? resolveStorefrontStyle('auto', businessVertical, { servicesAvailable })
    : currentStyle
  const isCurrent = currentStyle === storefrontStyle || resolvedCurrent === storefrontStyle

  const warnings: string[] = []
  const missingModules: string[] = []
  const missingData: string[] = []

  // Plantillas de Servicios / Barbería: requieren módulos de servicios/agenda
  if (storefrontStyle === 'services' || storefrontStyle === 'barber') {
    const hasServicesModule = modules ? modules.includes('services') : servicesAvailable !== false
    if (!hasServicesModule || servicesAvailable === false) {
      missingModules.push('services')
      warnings.push('Esta plantilla está optimizada para negocios con Servicios y Agenda. Tu organización no tiene esos módulos activos.')
    }
  }

  // Plantilla Tech: no bloquea si no tiene repairs (auditoría: tech funciona sin repairs)
  // Plantilla Beauty: cosmetics funciona sin servicios (auditoría: beauty no requiere agenda para retail)

  // Enlaces de audiencia en Moda y Deportivo
  if (storefrontStyle === 'fashion' || storefrontStyle === 'sport') {
    if (categories && categories.length > 0) {
      const hasAudienceCategories = categories.some((c) =>
        /mujer|dama|femenin|hombre|caballero|masculin|niñ|nino|infantil|kids|bebe/i.test(c.name)
      )
      if (!hasAudienceCategories) {
        missingData.push('audiences')
      }
    }
  }

  const isCompatible = missingModules.length === 0
  let status: TemplateCompatibilityStatus
  if (missingModules.length > 0) {
    status = 'requires_modules'
  } else if (isCurrent) {
    status = 'current'
  } else if (isRecommended) {
    status = 'recommended'
  } else {
    status = 'compatible'
  }

  return {
    status,
    isCurrent,
    isRecommended,
    isCompatible,
    warnings,
    missingModules,
    missingData: missingData.length > 0 ? missingData : undefined,
  }
}

export const STOREFRONT_STYLE_LABELS: Record<StorefrontStyle, string> = {
  'wholesale-pro': 'Mayorista & Distribuidora',
  'catalog-basic': 'Vitrina sin Carrito',
  classic: 'Tienda Clásica',
  fashion: 'Boutique de Moda',
  sport: 'Deportes & Zapatillas',
  tech: 'Celulares & Gadgets',
  market: 'Supermercado & Almacén',
  modern: 'Estudio Minimalista',
  services: 'Turnos & Servicios',
  beauty: 'Cosmética & Perfumería',
  'informatica-electronica': 'Mega Tienda Tech',
  barber: 'Barbería Club',
}

export const STOREFRONT_STYLE_OPTIONS: ReadonlyArray<{
  value: StorefrontStylePreference
  label: string
  description: string
}> = [
  { value: 'barber', label: 'Barbería Club', description: 'Inspirada en exclusivos clubes de caballeros como Club Varsovia: carta de rituales, atención personalizada, café o bebidas de cortesía, maestros barberos y turnos online.' },
  { value: 'wholesale-pro', label: 'Mayorista & Distribuidora', description: 'Catálogo moderno para ventas minoristas y mayoristas, ideal para negocios con muchos productos y compradores frecuentes.' },
  { value: 'catalog-basic', label: 'Vitrina sin Carrito', description: 'Vitrina simple para exhibir productos con foto, precio y descripción, sin carrito ni botones de compra.' },
  { value: 'informatica-electronica', label: 'Mega Tienda Tech', description: 'Tienda de tecnología con compra por marca y por categoría, ofertas reales y diseño neutro adaptable a tu marca.' },
  { value: 'auto', label: 'Automático', description: 'Se elige según el rubro de tu negocio.' },
  { value: 'classic', label: 'Tienda Clásica', description: 'Foto completa en tarjetas apaisadas. Para tecnología, ferretería o almacén.' },
  { value: 'fashion', label: 'Boutique de Moda', description: 'Fotos verticales a sangre, títulos elegantes y categorías con foto.' },
  { value: 'sport', label: 'Deportes & Zapatillas', description: 'Fotos verticales, títulos grandes en mayúsculas y más contraste.' },
  { value: 'tech', label: 'Celulares & Gadgets', description: 'Diseño enfocado en dispositivos, ficha técnica, gadgets y servicios técnicos.' },
  { value: 'market', label: 'Supermercado & Almacén', description: 'Pasillos, descuentos por porcentaje y compra rápida: se suman cantidades desde la misma tarjeta.' },
  { value: 'modern', label: 'Estudio Minimalista', description: 'Estilo contemporáneo con bordes suaves redondeados, atmósfera limpia y premium.' },
  { value: 'services', label: 'Turnos & Servicios', description: 'Peluquerías, barberías y estética: servicios con precio y reserva de turnos al frente.' },
  { value: 'beauty', label: 'Cosmética & Perfumería', description: 'Cosmética, maquillaje, skincare y perfumería: compra por necesidad, marcas y rutinas.' },
]

export type StorefrontTemplateGroupId = 'auto' | 'general' | 'tech' | 'fashion' | 'beauty' | 'food'

export interface StorefrontTemplateGroup {
  id: StorefrontTemplateGroupId
  title: string
  label: string
  badge: string
  description: string
  templateKeys: readonly StorefrontStylePreference[]
}

/**
 * Plantillas agrupadas por tipo de negocio. Cada plantilla está en un solo grupo;
 * el orden dentro del grupo va de la más simple a la más completa.
 */
export const STOREFRONT_TEMPLATE_GROUPS: ReadonlyArray<StorefrontTemplateGroup> = [
  {
    id: 'auto',
    title: 'Selección automática',
    label: 'Automático',
    badge: 'Según tu rubro',
    description: 'Elige la plantilla que mejor encaja con el rubro de tu negocio.',
    templateKeys: ['auto'],
  },
  {
    id: 'general',
    title: 'Comercio general',
    label: 'Comercio',
    badge: 'Multirrubro',
    description: 'Para cualquier negocio: ferreterías, librerías, bazares, regalerías y tiendas con productos variados.',
    templateKeys: ['classic', 'modern', 'catalog-basic'],
  },
  {
    id: 'tech',
    title: 'Tecnología & Electrónica',
    label: 'Tecnología',
    badge: 'Celulares, PC y gadgets',
    description: 'Celulares, informática, accesorios, repuestos y servicio técnico.',
    templateKeys: ['tech', 'informatica-electronica'],
  },
  {
    id: 'fashion',
    title: 'Moda & Deportes',
    label: 'Moda',
    badge: 'Ropa y calzado',
    description: 'Indumentaria, calzado, accesorios, ropa deportiva y zapatillas, con fotos verticales.',
    templateKeys: ['fashion', 'sport'],
  },
  {
    id: 'beauty',
    title: 'Belleza & Estética',
    label: 'Belleza',
    badge: 'Productos y turnos',
    description: 'Cosmética y perfumería, peluquerías, barberías y centros de estética con reserva de turnos.',
    templateKeys: ['beauty', 'services', 'barber'],
  },
  {
    id: 'food',
    title: 'Almacén & Mayoristas',
    label: 'Almacén',
    badge: 'Alto volumen',
    description: 'Supermercados, almacenes, distribuidoras y ventas por mayor con muchos productos.',
    templateKeys: ['market', 'wholesale-pro'],
  },
]

/** Variantes específicas de cada plantilla */
export interface TemplateVariant {
  id: string
  name: string
  tagline: string
  description: string
  badgeText: string
  accentClass?: string
}

/** Plantillas ricas con metadatos visuales para el catálogo de temas */
export interface StorefrontTemplateMeta {
  id: StorefrontStyle
  name: string
  badge: string
  tagline: string
  description: string
  recommendedVerticals: string[]
  recommendedColors: Array<'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo' | 'teal' | 'rose' | 'amber' | 'emerald' | 'cyan' | 'sky'>
  features: string[]
  accentGradient: string
  badgeColorClass: string
  variants: TemplateVariant[]
}

export const STOREFRONT_TEMPLATES_METADATA: Record<StorefrontStyle, StorefrontTemplateMeta> = {
  'informatica-electronica': {
    id: 'informatica-electronica',
    name: 'Mega Tienda Tech',
    badge: 'Tech & Informática',
    tagline: 'Mega tienda de tecnología, informática y dispositivos',
    description: 'Diseño para tecnología y electrónica: categorías con íconos, compra por marca, ofertas con descuento real y estética neutra adaptable a tu color de marca.',
    recommendedVerticals: ['Electrónica', 'Informática', 'General', 'Repuestos'],
    recommendedColors: ['blue', 'indigo', 'cyan', 'emerald'],
    features: ['Header técnico con buscador y categorías', 'Compra por marca y por categoría', 'Ofertas con % OFF real', 'Carrito o WhatsApp según tu forma de venta'],
    accentGradient: 'from-slate-800 to-slate-950',
    badgeColorClass: 'bg-primary/10 text-primary border-primary/20',
    variants: [],
  },
  'wholesale-pro': { id: 'wholesale-pro', name: 'Mayorista & Distribuidora', badge: 'Catálogo profesional', tagline: 'Encontrá lo que necesitás', description: 'Catálogo moderno para ventas minoristas y mayoristas, ideal para negocios con muchos productos y compradores frecuentes.', recommendedVerticals: ['Electrónica', 'Ferretería', 'General'], recommendedColors: ['blue','indigo','teal'], features: ['Buscador protagonista','Categorías accesibles','Precios según tu cuenta'], accentGradient: 'from-slate-700 to-slate-900', badgeColorClass: 'bg-primary/10 text-primary', variants: [] },
  'catalog-basic': {
    id: 'catalog-basic',
    name: 'Vitrina sin Carrito',
    badge: 'Vitrina simple',
    tagline: 'Vitrina rápida y directa para exhibir tus productos',
    description: 'Diseño limpio y liviano optimizado para celulares. Muestra fotos, precios y stock sin botones de compra ni carrito.',
    recommendedVerticals: ['General', 'Ferretería', 'Almacén', 'Mayorista'],
    recommendedColors: ['blue', 'emerald', 'indigo', 'teal'],
    features: ['Sin carrito', 'Carga rápida', 'Ideal para mostrador'],
    accentGradient: 'from-slate-600 to-slate-800',
    badgeColorClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
    variants: [],
  },
  classic: {
    id: 'classic',
    name: 'Tienda Clásica',
    badge: 'Equilibrado',
    tagline: 'Diseño comprobado para cualquier tipo de negocio',
    description: 'Tarjetas apaisadas que muestran productos completos sin recortes. Ideal para catálogos con variedad amplia de artículos.',
    recommendedVerticals: ['General', 'Ferretería', 'Servicios', 'Repuestos'],
    recommendedColors: ['blue', 'indigo', 'emerald'],
    features: ['Tarjetas con foto completa 4:3', 'Estadísticas de garantía y atención', 'Cabecera formal con buscador'],
    accentGradient: 'from-blue-600 to-indigo-600',
    badgeColorClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    variants: [
      { id: 'classic-standard', name: 'Estándar Universal', tagline: 'Tarjetas 4:3 y distribución equilibrada', description: 'Diseño confiable y versátil para cualquier tipo de inventario.', badgeText: 'Recomendado' },
      { id: 'classic-technical', name: 'Catálogo Industrial', tagline: 'Foco en códigos SKU y disponibilidad', description: 'Tarjetas estructuradas para repuestos, ferretería y herramientas.', badgeText: 'Técnico' },
      { id: 'classic-commercial', name: 'Comercial Directo', tagline: 'Buscador destacado y atención rápida', description: 'Enfocado en compras directas por WhatsApp y pedidos rápidos.', badgeText: 'Directo' },
    ],
  },
  fashion: {
    id: 'fashion',
    name: 'Boutique de Moda',
    badge: 'Visual & Elegante',
    tagline: 'Impacto visual con fotografía vertical de prendas',
    description: 'Inspirado en marcas internacionales de moda. Fotografías en proporción 3:4 a sangre, tipografía refinada y lookbook integrado.',
    recommendedVerticals: ['Indumentaria', 'Calzados', 'Accesorios', 'Joyería'],
    recommendedColors: ['rose', 'amber', 'purple'],
    features: ['Fotos verticales 3:4 a sangre', 'Tipografía serif sofisticada', 'Categorías estilo colecciones'],
    accentGradient: 'from-rose-500 to-pink-600',
    badgeColorClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    variants: [
      { id: 'fashion-lookbook', name: 'Editorial Lookbook', tagline: 'Fotos verticales 3:4 sin bordes', description: 'Presentación estilo pasarela con tipografía serif y colecciones.', badgeText: 'Editorial' },
      { id: 'fashion-luxury', name: 'Haute Couture / Lujo', tagline: 'Contraste sobrio y atmósfera oscura', description: 'Minimalismo sofisticado con tipografía condensada y fotos de autor.', badgeText: 'Lujo' },
      { id: 'fashion-streetwear', name: 'Streetwear Urbano', tagline: 'Tipografía bold moderna y dinámica', description: 'Look contemporáneo para indumentaria casual, deportiva y urbana.', badgeText: 'Urbano' },
    ],
  },
  sport: {
    id: 'sport',
    name: 'Deportes & Zapatillas',
    badge: 'Dinámico & Bold',
    tagline: 'Fuerza visual para zapatillas, fitness y rendimiento',
    description: 'Líneas angulares, tipografía en mayúsculas inclinadas, alto contraste y estética dinámica inspirada en marcas de entrenamiento.',
    recommendedVerticals: ['Deportes', 'Zapatillas', 'Fitness', 'Suplementos'],
    recommendedColors: ['red', 'orange', 'emerald'],
    features: ['Badges angulares en skew', 'Tipografía deportiva en mayúsculas', 'Fotos verticales de alto contraste'],
    accentGradient: 'from-orange-500 to-red-600',
    badgeColorClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    variants: [
      { id: 'sport-pro', name: 'High Performance Pro', tagline: 'Líneas angulares y alto contraste', description: 'Estética enérgica con tipografía italic y badges de alto impacto.', badgeText: 'Pro' },
      { id: 'sport-fitness', name: 'Fitness & Wellness', tagline: 'Look fresco, limpio y motivador', description: 'Tonos esmeralda y cian para gimnasios, suplementos y vida sana.', badgeText: 'Fitness' },
      { id: 'sport-sneakers', name: 'Sneakers & Drops', tagline: 'Foco en lanzamientos de calzados', description: 'Especial para zapatillas y productos de edición limitada.', badgeText: 'Drops' },
    ],
  },
  tech: {
    id: 'tech',
    name: 'Celulares & Gadgets',
    badge: 'Innovación',
    tagline: 'Especializado en celulares, computación y gadgets',
    description: 'Estética moderna con micro-bordes tecnológicos, badges tipo tag técnico y resaltado de compatibilidad y especificaciones.',
    recommendedVerticals: ['Celulares', 'Informática', 'Gaming', 'Servicio Técnico'],
    recommendedColors: ['cyan', 'sky', 'indigo', 'blue'],
    features: ['Badges con estilo técnico mono', 'Resaltado de compatibilidad', 'Foco en modelos y garantía'],
    accentGradient: 'from-cyan-500 to-blue-600',
    badgeColorClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    variants: [
      { id: 'tech-cyber', name: 'Dark Cyberpunk', tagline: 'Micro-brillos cian y fondo tecnológico', description: 'Aspecto gamer y de electrónica avanzada con badges monoespaciados.', badgeText: 'Cyber' },
      { id: 'tech-clean', name: 'Studio Minimal Tech', tagline: 'Estilo blanco pulcro y elegante', description: 'Inspirado en diseño minimalista nórdico para dispositivos y gadgets.', badgeText: 'Minimal' },
      { id: 'tech-repair', name: 'Servicio Técnico Oficial', tagline: 'Foco en repuestos y cotizaciones', description: 'Destaca garantías, presupuestos en vivo y seguimiento de taller.', badgeText: 'Taller' },
    ],
  },
  market: {
    id: 'market',
    name: 'Supermercado & Almacén',
    badge: 'Alta Conversión',
    tagline: 'Catálogo masivo con precios grandes y compras rápidas',
    description: 'Optimizado para carritos con múltiples artículos. Tarjetas compactas de alta densidad, precios destacados y badges de ahorro.',
    recommendedVerticals: ['Almacén', 'Bebidas', 'Bazar', 'Ferretería masiva'],
    recommendedColors: ['emerald', 'amber', 'green'],
    features: ['Precios en tamaño grande', 'Ahorro y descuentos destacados', 'Espaciado compacto de alta densidad'],
    accentGradient: 'from-emerald-500 to-teal-600',
    badgeColorClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    variants: [
      { id: 'market-wholesale', name: 'Mayorista & Ahorro', tagline: 'Precios en grande con insignias de oferta', description: 'Visibilidad inmediata de promociones, 2x1 y descuentos por cantidad.', badgeText: 'Mayorista' },
      { id: 'market-express', name: 'Compra Ágil Express', tagline: 'Botón + rápido directo al carrito', description: 'Densidad optimizada para agregar múltiples víveres y bebidas en segundos.', badgeText: 'Express' },
      { id: 'market-bazar', name: 'Retail & Bazar', tagline: 'Organización nítida por departamentos', description: 'Excelente para ferreterías masivas, tiendas de hogar y polirrubros.', badgeText: 'Bazar' },
    ],
  },
  modern: {
    id: 'modern',
    name: 'Estudio Minimalista',
    badge: 'Contemporáneo',
    tagline: 'Minimalismo premium con formas suaves y espaciadas',
    description: 'Tarjetas con bordes ultra-redondeados suaves (rounded-2xl), sombras delicadas y paletas sobrias para marcas de autor.',
    recommendedVerticals: ['Cosmética', 'Diseño de Interiores', 'Óptica', 'Librería'],
    recommendedColors: ['teal', 'purple', 'rose'],
    features: ['Bordes suaves rounded-2xl', 'Sombras etéreas refinadas', 'Composición editorial limpia'],
    accentGradient: 'from-purple-500 to-indigo-600',
    badgeColorClass: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    variants: [
      { id: 'modern-organic', name: 'Studio Orgánico', tagline: 'Curvas ultra-suaves rounded-3xl', description: 'Ideal para cosmética, diseño de autor, cafés y decoración.', badgeText: 'Orgánico' },
      { id: 'modern-glass', name: 'Glassmorphism Cristal', tagline: 'Capas translúcidas con desenfoque', description: 'Diseño futurista transparente y refinado con iluminación sutil.', badgeText: 'Glass' },
      { id: 'modern-editorial', name: 'Vanguardia Tipográfica', tagline: 'Espacios en blanco y jerarquía pura', description: 'Estilo galería de arte contemporáneo con tipografía impecable.', badgeText: 'Vanguardia' },
    ],
  },
  services: {
    id: 'services',
    name: 'Turnos & Servicios',
    badge: 'Reservas online',
    tagline: 'Para negocios que venden su tiempo: cortes, color, uñas y tratamientos',
    description: 'La portada invita a reservar: carta de servicios con precio y duración, tu equipo, horarios y cómo llegar. Los productos quedan como complemento.',
    recommendedVerticals: ['Peluquería', 'Barbería', 'Estética', 'Uñas', 'Spa'],
    recommendedColors: ['rose', 'amber', 'teal'],
    features: ['Botón «Reservar turno» siempre a mano', 'Carta de servicios con precio y duración', 'Equipo, horarios y cómo llegar'],
    accentGradient: 'from-rose-500 to-amber-500',
    badgeColorClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    variants: [],
  },
  beauty: {
    id: 'beauty',
    name: 'Cosmética & Perfumería',
    badge: 'Suave & Cuidado',
    tagline: 'Para tiendas de cosmética, maquillaje, skincare y perfumería',
    description: 'Tonos suaves, compra por necesidad (rostro, cabello, maquillaje, fragancias), marcas que vendés y una rutina armada con tus productos.',
    recommendedVerticals: ['Cosmética', 'Maquillaje', 'Skincare', 'Perfumería', 'Farmacia de belleza'],
    recommendedColors: ['rose', 'purple', 'amber'],
    features: ['Categorías en círculos, como en las tiendas de belleza', 'Rutina armada con tus productos', 'Marcas y sellos de confianza a la vista'],
    accentGradient: 'from-rose-400 to-fuchsia-500',
    badgeColorClass: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
    variants: [],
  },
  barber: {
    id: 'barber',
    name: 'Barbería Club',
    badge: 'Club de Caballeros',
    tagline: 'Rituales tradicionales, ambiente exclusivo y turnos online',
    description: 'Inspirada en exclusivos clubes de caballeros como Club Varsovia: carta de rituales, atención personalizada, cortesía de café o bebidas, maestros barberos y turnos online.',
    recommendedVerticals: ['Barbería', 'Peluquería Masculina', 'Grooming', 'Estética Masculina'],
    recommendedColors: ['amber', 'orange', 'teal', 'indigo'],
    features: ['Carta de rituales y servicios', 'Reserva de turnos online integrada', 'Presentación de maestros barberos', 'Sedes y experiencia de hospitalidad', 'Boutique de grooming masculino'],
    accentGradient: 'from-amber-600 via-amber-500 to-yellow-600',
    badgeColorClass: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    variants: [
      { id: 'barber-club', name: 'Gentlemen Club', tagline: 'Estética vintage club con madera y cuero', description: 'Ambiente clásico inspirado en barberías europeas con rituales a navaja y barra.', badgeText: 'Club' },
      { id: 'barber-modern', name: 'Barber Modern Fade', tagline: 'Cortes urbanos y degradados precisos', description: 'Enfoque en tendencias actuales de corte, perfilado de barba y styling contemporáneo.', badgeText: 'Modern' },
    ],
  },
}

export type StorefrontHeaderStyle = 'glass' | 'solid' | 'accent' | 'dark'

/**
 * En la tienda pública `glass` y `solid` pintan el mismo header claro y opaco
 * (ver PublicHeader), así que el editor los ofrece como una sola opción.
 */
export const STOREFRONT_HEADER_OPTIONS: ReadonlyArray<{
  value: Exclude<StorefrontHeaderStyle, 'glass'>
  label: string
  description: string
}> = [
  { value: 'solid', label: 'Claro', description: 'Fondo blanco. Funciona con cualquier logo.' },
  { value: 'accent', label: 'Color de marca', description: 'Fondo con tu color. Ideal con logo blanco.' },
  { value: 'dark', label: 'Oscuro', description: 'Fondo negro, contraste premium.' },
]

export function headerOptionFor(headerStyle: unknown): Exclude<StorefrontHeaderStyle, 'glass'> {
  return headerStyle === 'accent' || headerStyle === 'dark' ? headerStyle : 'solid'
}

export interface StorefrontAppearanceSuggestion {
  style: StorefrontStyle
  brandColor: StorefrontTemplateMeta['recommendedColors'][number]
  headerStyle: Exclude<StorefrontHeaderStyle, 'glass'>
  /** Por qué se sugiere, en palabras del dueño. */
  reason: string
}

const VERTICAL_NAMES: Record<BusinessVertical, string> = {
  general: 'comercio general',
  clothing: 'indumentaria',
  barbershop: 'barbería y peluquería',
  beauty_services: 'belleza y cuidado personal',
  cosmetics: 'cosmética',
  electronics: 'tecnología',
  food: 'alimentos',
  hardware: 'ferretería',
  other: 'otro rubro',
}

const STYLE_BY_VERTICAL_SUGGESTION: Record<BusinessVertical, StorefrontStyle | null> = {
  general: null,
  other: null,
  clothing: 'fashion',
  barbershop: 'services',
  beauty_services: 'services',
  cosmetics: 'beauty',
  electronics: 'tech',
  food: 'market',
  hardware: 'classic',
}

/** Palabras que delatan el tipo de tienda cuando el rubro no lo dice. El orden importa: gana la primera. */
// `\b` de JS no entiende acentos («café»): se delimita por letras Unicode.
const words = (alternatives: string) => new RegExp(`(?<!\\p{L})(?:${alternatives})(?!\\p{L})`, 'u')

const STYLE_KEYWORDS: ReadonlyArray<{ style: StorefrontStyle; pattern: RegExp }> = [
  { style: 'barber', pattern: words('varsovia|club de caballeros?|afeitad\\p{L}* a navaja|toallas? calientes?|fade master') },
  { style: 'informatica-electronica', pattern: words('inform[aá]tica|computaci[oó]n|hardware|perif[eé]ricos?|electr[oó]nica tech|componentes? pc') },
  { style: 'services', pattern: words('peluquer\\p{L}*|barber\\p{L}*|sal[oó]n de belleza|u[nñ]as|manicur\\p{L}*|pedicur\\p{L}*|spa|masajes?|est[eé]tica|tatuajes?|tattoo|pesta[nñ]as|cejas') },
  { style: 'sport', pattern: words('deport\\p{L}*|fitness|gym|gimnasio|suplementos?|zapatillas?|sneakers?|running') },
  { style: 'fashion', pattern: words('ropa|moda|boutique|indumentaria|calzados?|zapater\\p{L}*|lencer\\p{L}*|joyer\\p{L}*|carteras?') },
  { style: 'tech', pattern: words('celular\\p{L}*|tel[eé]fonos?|smartphones?|tecnolog\\p{L}*|inform[aá]tica|computaci[oó]n|gamer|gaming|electr[oó]nic\\p{L}*|servicio t[eé]cnico') },
  { style: 'market', pattern: words('supermercado|s[uú]per|almac[eé]n|despensa|minimarket|bebidas|mayorista|bazar|autoservicio|carnicer\\p{L}*|verduler\\p{L}*') },
  { style: 'beauty', pattern: words('cosm[eé]tic\\p{L}*|maquillaje|skin ?care|perfumer[ií]a|perfumes?|fragancias?|dermocosm[eé]tic\\p{L}*|belleza') },
  { style: 'modern', pattern: words('[oó]ptica|decoraci[oó]n|librer[ií]a|caf[eé]|florer[ií]a') },
]

const HEADER_BY_STYLE: Record<StorefrontStyle, Exclude<StorefrontHeaderStyle, 'glass'>> = {
  'wholesale-pro': 'solid',
  'catalog-basic': 'solid',
  'informatica-electronica': 'accent',
  classic: 'solid',
  fashion: 'solid',
  sport: 'dark',
  tech: 'dark',
  market: 'accent',
  modern: 'solid',
  services: 'dark',
  beauty: 'solid',
  barber: 'dark',
}

/**
 * Sugiere plantilla, color y encabezado. El rubro manda; si es genérico se
 * buscan pistas en el nombre, el eslogan y la descripción del negocio.
 * Es determinístico a propósito: responde al instante y sin costo por tienda.
 */
export function suggestStorefrontAppearance(input: {
  businessVertical?: unknown
  name?: string
  slogan?: string
  description?: string
  /** Sin el módulo Servicios no se sugiere esa plantilla. */
  servicesAvailable?: boolean
  /** Sin productos no se sugiere una plantilla de tienda a un negocio de servicios. */
  catalogAvailable?: boolean
  /** Modo de venta de la tienda (cart | whatsapp | catalog). */
  commerceMode?: PublicCommerceMode
}): StorefrontAppearanceSuggestion {
  const vertical: BusinessVertical = typeof input.businessVertical === 'string' && input.businessVertical in VERTICAL_NAMES
    ? (input.businessVertical as BusinessVertical)
    : 'general'
  const text = [input.name, input.slogan, input.description].filter(Boolean).join(' ').toLowerCase()
  const keywordHit = STYLE_KEYWORDS.map(({ style, pattern }) => ({ style, match: text.match(pattern)?.[0] }))
    .find((hit) => hit.match)

  let style: StorefrontStyle
  let reason: string
  const byVertical = STYLE_BY_VERTICAL_SUGGESTION[vertical]
  if (input.commerceMode === 'catalog') {
    style = 'catalog-basic'
    reason = 'Al tener activa la modalidad Solo Catálogo Digital, esta vitrina simple y rápida es la más adecuada.'
  } else if (byVertical) {
    style = byVertical
    reason = `Tu rubro es ${VERTICAL_NAMES[vertical]}.`
  } else if (keywordHit) {
    style = keywordHit.style
    reason = `Tu negocio menciona «${keywordHit.match}».`
  } else {
    style = DEFAULT_STOREFRONT_STYLE
    reason = 'Es la plantilla más versátil para catálogos variados.'
  }

  const context = { servicesAvailable: input.servicesAvailable, catalogAvailable: input.catalogAvailable, businessVertical: vertical, commerceMode: input.commerceMode }
  if (!isStorefrontStyleAvailable(style, context)) {
    const wanted = style
    style = resolveStorefrontStyle(style, vertical, context)
    reason = wanted === 'services'
      ? PRODUCT_VERTICALS.has(vertical)
        ? `Tu rubro es ${VERTICAL_NAMES[vertical]}: tus servicios se muestran en una sección de la tienda.`
        : 'La plantilla Servicios necesita la agenda de turnos; esta muestra tu negocio con fotos y contacto.'
      : `Es la que mejor encaja con ${VERTICAL_NAMES[vertical]}.`
  }

  return {
    style,
    brandColor: STOREFRONT_TEMPLATES_METADATA[style].recommendedColors[0],
    headerStyle: HEADER_BY_STYLE[style],
    reason,
  }
}

/** Fuera de los aspectos apaisados (clásico, tech, market) las fotos de producto van verticales y recortadas. */
export function usesPortraitMedia(style: StorefrontStyle) {
  return style === 'fashion' || style === 'sport' || style === 'modern'
}

// Las clases son literales para que Tailwind las detecte al compilar.

/** Titulos de seccion. */
export const STOREFRONT_HEADING_CLASS: Record<StorefrontStyle, string> = {
  'wholesale-pro': 'font-semibold tracking-tight',
  'catalog-basic': 'font-bold tracking-tight',
  'informatica-electronica': 'font-black tracking-tight',
  classic: 'font-extrabold tracking-tight',
  fashion: 'font-serif tracking-tight',
  sport: 'font-black uppercase italic tracking-tighter',
  tech: 'font-extrabold tracking-tight',
  market: 'font-black tracking-tight',
  modern: 'font-semibold tracking-tight',
  services: 'font-serif tracking-tight',
  beauty: 'font-serif tracking-tight',
  barber: 'font-serif tracking-tight',
}

/** Etiqueta chica sobre los titulos. */
export const STOREFRONT_EYEBROW_CLASS: Record<StorefrontStyle, string> = {
  'wholesale-pro': 'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
  'catalog-basic': 'text-xs font-semibold uppercase tracking-wider text-muted-foreground',
  'informatica-electronica': 'inline-block rounded-full bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary',
  classic: 'text-xs font-bold uppercase tracking-wider text-primary',
  fashion: 'text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground',
  sport: 'inline-block -skew-x-6 bg-primary px-2 py-0.5 text-[11px] font-black uppercase tracking-widest text-primary-foreground',
  tech: 'inline-block rounded-xs bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400',
  market: 'inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400',
  modern: 'text-[11px] font-semibold uppercase tracking-widest text-primary/80',
  services: 'text-[11px] font-semibold uppercase tracking-[0.2em] text-primary',
  beauty: 'inline-block rounded-full bg-pink-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-pink-700 dark:text-pink-300',
  barber: 'inline-block tracking-[0.2em] uppercase text-xs font-bold text-amber-600 dark:text-amber-400',
}

/** Esquinas de fotos y botones. */
export const STOREFRONT_RADIUS_CLASS: Record<StorefrontStyle, string> = {
  'wholesale-pro': 'rounded-lg',
  'catalog-basic': 'rounded-lg',
  'informatica-electronica': 'rounded-xl',
  classic: 'rounded-xl',
  fashion: 'rounded-none',
  sport: 'rounded-md',
  tech: 'rounded-xl',
  market: 'rounded-md',
  modern: 'rounded-2xl',
  services: 'rounded-2xl',
  beauty: 'rounded-3xl',
  barber: 'rounded-2xl',
}
