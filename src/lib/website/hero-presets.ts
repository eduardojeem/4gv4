import type { HeroPresetId } from '@/lib/website/storefront-capabilities'

export interface HeroPreset {
  id: HeroPresetId
  label: string
  icon: string
  badge: string
  title: string
  subtitle: string
  ctaPrimaryText: string
  ctaSecondaryText: string
  trustBadges: [string, string, string]
  stats: { repairs: string; satisfaction: string; avgTime: string }
}

/** Textos de partida por rubro. Las cifras son ejemplos: el dueño pone las suyas. */
export const HERO_PRESETS: HeroPreset[] = [
  {
    id: 'tech',
    label: 'Tecnología & Celulares',
    icon: '📱',
    badge: 'Tecnología & celulares',
    title: 'Lo último en tecnología con atención personalizada',
    subtitle: 'Equipos, accesorios y productos originales con garantía y entrega rápida.',
    ctaPrimaryText: 'Ver productos',
    ctaSecondaryText: 'Escribinos por WhatsApp',
    trustBadges: ['Garantía oficial', 'Productos originales', 'Envíos a todo el país'],
    stats: { repairs: '10K+', satisfaction: '99%', avgTime: '24-48h' },
  },
  {
    id: 'fashion',
    label: 'Moda, Calzado & Accesorios',
    icon: '👗',
    badge: 'Nueva temporada',
    title: 'Estilo, calidad y las mejores marcas para vos',
    subtitle: 'Encontrá las últimas novedades, ofertas exclusivas y envíos rápidos a tu puerta.',
    ctaPrimaryText: 'Ver colección',
    ctaSecondaryText: 'Consultar talles',
    trustBadges: ['100% Calidad', 'Cambio fácil', 'Cuotas y Envíos'],
    stats: { repairs: '5K+', satisfaction: '99%', avgTime: '24h' },
  },
  {
    id: 'cosmetics',
    label: 'Cosmética & Belleza',
    icon: '✨',
    badge: 'Cuidado & belleza',
    title: 'Realzá tu belleza con productos de confianza',
    subtitle: 'Cosmética y cuidado personal originales, con asesoramiento y entregas rápidas.',
    ctaPrimaryText: 'Ver catálogo',
    ctaSecondaryText: 'Pedir asesoramiento',
    trustBadges: ['Productos originales', 'Asesoría personalizada', 'Envíos disponibles'],
    stats: { repairs: '2.000+', satisfaction: '4.9★', avgTime: '24h' },
  },
  {
    id: 'barbershop',
    label: 'Barbería & Peluquería',
    icon: '💈',
    badge: 'Reservá tu turno',
    title: 'Tu estilo, en buenas manos',
    subtitle: 'Cortes, barba y color con profesionales. Elegí el servicio y reservá en un minuto.',
    ctaPrimaryText: 'Reservar turno',
    ctaSecondaryText: 'Escribinos',
    trustBadges: ['Turnos online', 'Profesionales', 'Higiene garantizada'],
    stats: { repairs: '3.000+', satisfaction: '4.9★', avgTime: 'Sin espera' },
  },
  {
    id: 'food',
    label: 'Alimentos & Gastronomía',
    icon: '🥖',
    badge: 'Fresco todos los días',
    title: 'Lo rico de siempre, directo a tu mesa',
    subtitle: 'Hacé tu pedido online y recibilo en tu casa o pasá a retirarlo listo.',
    ctaPrimaryText: 'Hacer mi pedido',
    ctaSecondaryText: 'Escribinos',
    trustBadges: ['Productos frescos', 'Delivery en el día', 'Retiro en el local'],
    stats: { repairs: '5.000+', satisfaction: '4.8★', avgTime: 'En el día' },
  },
  {
    id: 'electro',
    label: 'Ferretería, Hogar & Bazar',
    icon: '🏠',
    badge: 'Todo para tu hogar',
    title: 'Todo lo que tu hogar necesita al mejor precio',
    subtitle: 'Herramientas, materiales y equipamiento con stock disponible y envíos a domicilio u obra.',
    ctaPrimaryText: 'Ver catálogo',
    ctaSecondaryText: 'Pedir cotización',
    trustBadges: ['Stock inmediato', 'Garantía oficial', 'Precios especiales'],
    stats: { repairs: '8K+', satisfaction: '98%', avgTime: '24h' },
  },
  {
    id: 'services',
    label: 'Servicios Profesionales',
    icon: '🧰',
    badge: 'Atención profesional',
    title: 'Soluciones profesionales a tu medida',
    subtitle: 'Servicios claros, atención personalizada y presupuestos sin sorpresas.',
    ctaPrimaryText: 'Ver servicios',
    ctaSecondaryText: 'Solicitar presupuesto',
    trustBadges: ['Atención directa', 'Presupuestos claros', 'Trabajo garantizado'],
    stats: { repairs: '500+', satisfaction: '98%', avgTime: '24h' },
  },
  {
    id: 'repairs',
    label: 'Servicio Técnico & Reparaciones',
    icon: '🔧',
    badge: 'Servicio técnico',
    title: 'Reparamos tu equipo en tiempo récord con total confianza',
    subtitle: 'Diagnóstico sin costo, repuestos certificados y seguimiento online de tu reparación.',
    ctaPrimaryText: 'Ver servicios',
    ctaSecondaryText: 'Consultar falla',
    trustBadges: ['Diagnóstico sin costo', 'Garantía escrita', 'Técnicos certificados'],
    stats: { repairs: '15K+', satisfaction: '99%', avgTime: '1-3 horas' },
  },
  {
    id: 'general',
    label: 'Comercio General / Multi-rubro',
    icon: '🏪',
    badge: 'Tienda oficial',
    title: 'Los mejores productos con atención personalizada',
    subtitle: 'Explorá nuestro catálogo online con stock actualizado, promociones exclusivas y envíos rápidos.',
    ctaPrimaryText: 'Explorar tienda',
    ctaSecondaryText: 'Contactar',
    trustBadges: ['Atención directa', 'Stock permanente', 'Envíos a todo el país'],
    stats: { repairs: '100%', satisfaction: '4.9★', avgTime: 'Despacho 24h' },
  },
]
