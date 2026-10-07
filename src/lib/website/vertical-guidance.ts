import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { StorefrontStyle } from '@/lib/website/storefront-style'
import type { ProcessStepTemplateId } from '@/lib/website/process-steps'
import type { BusinessVertical } from '@/lib/organization/business-profile'
import type { TrustBarItem } from '@/types/website-settings'

/**
 * Qué sugerirle a cada negocio en el editor del sitio. Un taller con
 * reparaciones habla distinto que una tienda del mismo rubro sin taller, así
 * que las reparaciones mandan sobre el rubro.
 */
export type GuidanceFamily = BusinessVertical | 'repairs'

export function guidanceFamily(capabilities: Pick<StorefrontCapabilities, 'businessVertical' | 'hasRepairs'>): GuidanceFamily {
  return capabilities.hasRepairs ? 'repairs' : capabilities.businessVertical
}

type BenefitIdea = Pick<TrustBarItem, 'icon' | 'title' | 'description'>

/** Beneficios típicos de cada rubro: reales y fáciles de cumplir. */
export const TRUST_BAR_IDEAS: Record<GuidanceFamily, BenefitIdea[]> = {
  general: [
    { icon: 'truck', title: 'Envíos a domicilio', description: 'Coordinamos la entrega en tu zona' },
    { icon: 'map-pin', title: 'Retiro en el local', description: 'Pasá a buscar tu pedido sin costo' },
    { icon: 'credit-card', title: 'Varias formas de pago', description: 'Efectivo, transferencia o tarjeta' },
    { icon: 'message', title: 'Atención por WhatsApp', description: 'Respondemos tus consultas' },
  ],
  clothing: [
    { icon: 'package', title: 'Cambios fáciles', description: 'Si no te queda, lo cambiamos' },
    { icon: 'message', title: 'Te ayudamos con el talle', description: 'Consultanos antes de comprar' },
    { icon: 'truck', title: 'Envíos a todo el país', description: 'Recibilo en tu casa' },
    { icon: 'credit-card', title: 'Pagá como quieras', description: 'Transferencia, tarjeta o efectivo' },
  ],
  barbershop: [
    { icon: 'clock', title: 'Reservá tu turno', description: 'Elegí el día y la hora que te queden bien' },
    { icon: 'star', title: 'Profesionales con experiencia', description: 'Cortes y barbas a tu estilo' },
    { icon: 'check', title: 'Higiene garantizada', description: 'Herramientas desinfectadas en cada servicio' },
    { icon: 'credit-card', title: 'Pagá en el local', description: 'Efectivo, transferencia o tarjeta' },
  ],
  cosmetics: [
    { icon: 'award', title: 'Productos originales', description: 'Marcas con procedencia garantizada' },
    { icon: 'handshake', title: 'Asesoramiento personalizado', description: 'Te ayudamos a elegir según tu piel' },
    { icon: 'truck', title: 'Envíos rápidos', description: 'Recibí tu pedido en tu casa' },
    { icon: 'sparkles', title: 'Novedades cada semana', description: 'Lanzamientos y tendencias' },
  ],
  electronics: [
    { icon: 'shield', title: 'Garantía', description: 'Todos los equipos con garantía escrita' },
    { icon: 'award', title: 'Productos originales', description: 'Equipos y accesorios de marca' },
    { icon: 'credit-card', title: 'Pagá en cuotas', description: 'Consultá los planes disponibles' },
    { icon: 'truck', title: 'Envíos a todo el país', description: 'Despacho rápido y seguro' },
  ],
  food: [
    { icon: 'zap', title: 'Delivery en el día', description: 'Pedí hoy y recibilo hoy' },
    { icon: 'star', title: 'Siempre fresco', description: 'Productos seleccionados todos los días' },
    { icon: 'map-pin', title: 'Retiro en el local', description: 'Pasá a buscarlo cuando quieras' },
    { icon: 'credit-card', title: 'Pagá al recibir', description: 'Efectivo, transferencia o QR' },
  ],
  hardware: [
    { icon: 'package', title: 'Stock disponible', description: 'Lo que buscás, listo para llevar' },
    { icon: 'handshake', title: 'Te asesoramos', description: 'Te ayudamos a elegir el material justo' },
    { icon: 'truck', title: 'Envíos a obra', description: 'Llevamos tu pedido a domicilio u obra' },
    { icon: 'credit-card', title: 'Precios para profesionales', description: 'Consultá por cantidad' },
  ],
  other: [
    { icon: 'handshake', title: 'Atención personalizada', description: 'Te ayudamos en cada paso' },
    { icon: 'message', title: 'Respondemos rápido', description: 'Escribinos por WhatsApp' },
    { icon: 'credit-card', title: 'Varias formas de pago', description: 'Efectivo, transferencia o tarjeta' },
  ],
  repairs: [
    { icon: 'wrench', title: 'Diagnóstico sin costo', description: 'Revisamos tu equipo antes de presupuestar' },
    { icon: 'shield', title: 'Garantía escrita', description: 'En cada reparación' },
    { icon: 'zap', title: 'Reparaciones en el día', description: 'En la mayoría de los casos' },
    { icon: 'check', title: 'Seguí tu reparación', description: 'Consultá el estado online' },
  ],
}

export interface AnnouncementIdea {
  title: string
  message: string
}

/** Avisos que suelen hacer falta en cada rubro. */
export const ANNOUNCEMENT_IDEAS: Record<GuidanceFamily, AnnouncementIdea[]> = {
  general: [
    { title: 'Horario especial', message: 'Este feriado atendemos de 8 a 12. ¡Te esperamos!' },
    { title: 'Ofertas de la semana', message: 'Aprovechá los precios especiales hasta el domingo.' },
  ],
  clothing: [
    { title: 'Nueva temporada', message: 'Ya llegó la colección nueva. ¡Mirala antes que nadie!' },
    { title: 'Cambios', message: 'Tenés 30 días para cambiar tu compra con el ticket.' },
  ],
  barbershop: [
    { title: 'Reservá online', message: 'Ahora podés sacar tu turno desde acá, en un minuto.' },
    { title: 'Horario especial', message: 'Este sábado atendemos hasta las 20 h.' },
  ],
  cosmetics: [
    { title: 'Lanzamiento', message: 'Llegaron las novedades de la temporada. ¡Conocelas!' },
    { title: 'Regalo con tu compra', message: 'Llevate una muestra de regalo en compras superiores a Gs. 200.000.' },
  ],
  electronics: [
    { title: 'Cuotas sin interés', message: 'Este mes llevá tu equipo en cuotas. Consultanos.' },
    { title: 'Ingresos nuevos', message: 'Llegaron equipos nuevos: mirá el catálogo.' },
  ],
  food: [
    { title: 'Pedidos para el finde', message: 'Hacé tu pedido hasta el viernes a las 18 h para recibirlo el sábado.' },
    { title: 'Horario de delivery', message: 'Entregamos de lunes a sábado de 9 a 20 h.' },
  ],
  hardware: [
    { title: 'Envíos a obra', message: 'Llevamos tu pedido a la obra. Consultá zonas y costos.' },
    { title: 'Horario especial', message: 'Este sábado abrimos de 7 a 12.' },
  ],
  other: [
    { title: 'Horario especial', message: 'Esta semana cambiamos el horario de atención. Consultanos.' },
    { title: 'Novedad', message: 'Tenemos novedades para vos: escribinos para conocerlas.' },
  ],
  repairs: [
    { title: 'Seguí tu reparación', message: 'Consultá el estado de tu equipo online con tu número de orden.' },
    { title: 'Horario del taller', message: 'Recibimos equipos de lunes a viernes de 8 a 18 h.' },
  ],
}

/** Los recorridos de «Cómo atendés a tus clientes» que mejor le van a cada rubro, en orden. */
export const PROCESS_TEMPLATES_BY_FAMILY: Record<GuidanceFamily, ProcessStepTemplateId[]> = {
  general: ['purchase', 'personalized', 'payments'],
  clothing: ['fashion', 'purchase'],
  barbershop: ['appointment', 'personalized'],
  cosmetics: ['personalized', 'purchase', 'appointment'],
  electronics: ['purchase', 'personalized'],
  food: ['food', 'purchase'],
  hardware: ['quote', 'purchase'],
  other: ['personalized', 'purchase', 'payments'],
  repairs: ['repairs', 'purchase'],
}

/** Categoría de servicios de ejemplo que corresponde al rubro (ver ServicesManager). */
export const SERVICE_PRESET_CATEGORY: Record<GuidanceFamily, string | null> = {
  general: null,
  clothing: 'Moda',
  barbershop: 'Barbería',
  cosmetics: 'Belleza',
  electronics: 'Tecnología',
  food: 'Gastronomía',
  hardware: 'Ferretería',
  other: null,
  repairs: 'Tecnología',
}

export interface ServicesSectionIdea {
  label: string
  badge: string
  title: string
  subtitle: string
}

const GENERIC_SERVICES_COPY: ServicesSectionIdea = {
  label: 'General',
  badge: 'Servicios',
  title: 'Servicios pensados para vos',
  subtitle: 'Conocé lo que hacemos, compará opciones y coordiná por WhatsApp.',
}

/** Encabezado de la sección de servicios: primero el del rubro, después uno general. */
export const SERVICES_SECTION_IDEAS: Record<GuidanceFamily, ServicesSectionIdea[]> = {
  general: [GENERIC_SERVICES_COPY],
  other: [GENERIC_SERVICES_COPY],
  clothing: [
    { label: 'Arreglos y confección', badge: 'Arreglos a medida', title: 'Tu ropa, a tu medida', subtitle: 'Ajustes, dobladillos y prendas a pedido con terminaciones prolijas.' },
    GENERIC_SERVICES_COPY,
  ],
  barbershop: [
    { label: 'Barbería', badge: 'Cortes & barba', title: 'Tu estilo, en buenas manos', subtitle: 'Cortes, barba y perfilado con turno. Elegí el servicio y reservá en un minuto.' },
    { label: 'Peluquería', badge: 'Peluquería', title: 'Cortes, color y peinados', subtitle: 'Profesionales con experiencia y productos de calidad. Reservá tu turno online.' },
  ],
  cosmetics: [
    { label: 'Estética', badge: 'Estética & cuidado', title: 'Tratamientos para cuidarte', subtitle: 'Faciales, manos y asesoramiento personalizado con productos profesionales.' },
    GENERIC_SERVICES_COPY,
  ],
  electronics: [
    { label: 'Soporte técnico', badge: 'Soporte técnico', title: 'Instalación y soporte para tus equipos', subtitle: 'Configuración, mantenimiento y asesoramiento con técnicos de confianza.' },
    GENERIC_SERVICES_COPY,
  ],
  food: [
    { label: 'Encargos y eventos', badge: 'Por encargo', title: 'Encargos y catering para tus eventos', subtitle: 'Tortas, bandejas y menús para reuniones. Pedí con anticipación y coordinamos la entrega.' },
    GENERIC_SERVICES_COPY,
  ],
  hardware: [
    { label: 'Instalaciones', badge: 'Instalaciones', title: 'Instalaciones y trabajos en tu casa u obra', subtitle: 'Electricidad, plomería y montaje con personal calificado. Pedí tu presupuesto sin cargo.' },
    GENERIC_SERVICES_COPY,
  ],
  repairs: [
    { label: 'Taller y reparaciones', badge: 'Servicio técnico', title: 'Reparamos tu equipo con garantía', subtitle: 'Diagnóstico profesional, repuestos de calidad y seguimiento online de tu reparación.' },
    { label: 'Servicio express', badge: 'Servicio express', title: 'Mantenimiento y reparaciones en el día', subtitle: 'Cuidamos tus equipos con técnicos de confianza y entregas rápidas.' },
  ],
}

/** Los servicios de pagos y giros solo tienen sentido en un comercio general. */
export function showsFinancialServices(family: GuidanceFamily): boolean {
  return family === 'general' || family === 'other'
}

export interface HeroFields {
  /** Botones de la portada (ver productos / contacto). */
  buttons: boolean
  /** Enlace «¿Tenés una reparación?». */
  tracking: boolean
  /** Números de confianza (clientes, valoración, entrega). */
  stats: boolean
}

/**
 * Qué usa la portada de cada plantilla: el editor pide solo eso. Supermercado
 * pone un buscador en lugar de botones; los números solo los muestra Clásica.
 */
export function heroFieldsForStyle(style: StorefrontStyle, capabilities: Pick<StorefrontCapabilities, 'tracking'>): HeroFields {
  const campaign = style === 'classic' || style === 'fashion' || style === 'tech' || style === 'modern' || style === 'beauty'
  return {
    buttons: style !== 'market',
    tracking: campaign && capabilities.tracking.kind === 'repairs',
    stats: style === 'classic',
  }
}

export interface CheckoutRecommendation {
  /** Modalidad que mejor le va al rubro. */
  mode: 'cart' | 'whatsapp' | 'catalog'
  summary: string
  /** Lo que se activa al aplicarla: solo lo que no necesita datos de la tienda. */
  pickup: boolean
  delivery: boolean
  cash: boolean
  card: boolean
  tips: string[]
}

/**
 * Cómo conviene vender en cada rubro. Transferencia y billetera no se activan
 * solas: necesitan las cuentas o el alias de la tienda.
 */
export const CHECKOUT_RECOMMENDATIONS: Record<GuidanceFamily, CheckoutRecommendation> = {
  general: {
    mode: 'cart', summary: 'Carrito con retiro en el local y efectivo; sumá envíos cuando puedas cumplirlos.',
    pickup: true, delivery: false, cash: true, card: false,
    tips: ['Cargá tus cuentas para activar transferencia.', 'Si hacés envíos, definí zonas con su costo.'],
  },
  other: {
    mode: 'whatsapp', summary: 'Consultas por WhatsApp: el cliente te escribe y coordinan precio, pago y entrega.',
    pickup: true, delivery: false, cash: true, card: false,
    tips: ['Si vendés productos con precio fijo, el carrito te ahorra mensajes.'],
  },
  clothing: {
    mode: 'cart', summary: 'Carrito con envío y retiro; muchos clientes consultan el talle antes de comprar.',
    pickup: true, delivery: true, cash: true, card: true,
    tips: ['Contá tu política de cambios en las instrucciones de entrega.', 'Activá transferencia con tus cuentas: es el pago más usado online.'],
  },
  barbershop: {
    mode: 'whatsapp', summary: 'Tus turnos se reservan por la agenda. Para los productos (ceras, shampoo) alcanza con consultas por WhatsApp y retiro en el local.',
    pickup: true, delivery: false, cash: true, card: true,
    tips: ['Activá «Reservas online en tu inicio» para recibir turnos sin escribirte.'],
  },
  cosmetics: {
    mode: 'cart', summary: 'Carrito con envío a domicilio y retiro: la compra de reposición es rápida.',
    pickup: true, delivery: true, cash: true, card: true,
    tips: ['Un envío gratis desde cierto monto sube el ticket promedio.', 'Activá billetera o QR con tu alias.'],
  },
  electronics: {
    mode: 'cart', summary: 'Carrito con retiro y envío; la tarjeta permite vender en cuotas.',
    pickup: true, delivery: true, cash: true, card: true,
    tips: ['Indicá la garantía en las instrucciones de entrega.'],
  },
  food: {
    mode: 'cart', summary: 'Pedidos por carrito con delivery por zonas y retiro; un pedido mínimo hace rentable cada envío.',
    pickup: true, delivery: true, cash: true, card: false,
    tips: ['Definí zonas de delivery con su costo.', 'Poné un pedido mínimo para delivery.', 'Activá billetera o QR: es rápido para pedidos chicos.'],
  },
  hardware: {
    mode: 'whatsapp', summary: 'Consultas por WhatsApp para cotizar listas de materiales, con retiro en el local o envío a obra.',
    pickup: true, delivery: true, cash: true, card: true,
    tips: ['Si tenés precios fijos y stock al día, el carrito agiliza las compras chicas.'],
  },
  repairs: {
    mode: 'cart', summary: 'Las reparaciones se gestionan aparte; el carrito sirve para vender accesorios con retiro en el local.',
    pickup: true, delivery: false, cash: true, card: true,
    tips: ['Tus clientes siguen su reparación desde «Mis reparaciones».'],
  },
}
