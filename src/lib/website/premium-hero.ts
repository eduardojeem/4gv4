import type { BusinessVertical } from '@/lib/organization/business-profile'
import type { HeroContent, HeroStats } from '@/types/website-settings'

export interface PremiumHeroDefinition {
  vertical: BusinessVertical
  verticalLabel: string
  icon: string
  hero: HeroContent
  stats: HeroStats
  previewChips: string[]
  previewProducts: Array<{
    name: string
    category: string
    price: string
    badge?: string
  }>
}

export const PREMIUM_HERO_BY_VERTICAL: Record<BusinessVertical, PremiumHeroDefinition> = {
  clothing: {
    vertical: 'clothing',
    verticalLabel: 'Moda, Calzado & Accesorios',
    icon: '👗',
    hero: {
      enabled: false, // Por defecto desactivada como solicitó el usuario
      badge: '✨ Nueva Colección & Tendencias',
      title: 'Moda, calidad y estilo pensados para vos',
      subtitle: 'Descubrí prendas exclusivas con calce perfecto, telas seleccionadas y envíos rápidos a todo el país.',
      ctaPrimaryText: 'Mirá la colección',
      ctaSecondaryText: 'Consultá talles por WhatsApp',
      trustBadges: ['100% Calidad garantizada', 'Cambio simple y rápido', 'Envíos a todo el país'],
    },
    stats: {
      enabled: false,
      repairs: '5.000+',
      satisfaction: '99%',
      avgTime: '24-48h',
    },
    previewChips: ['Vestidos', 'Jeans & Denim', 'Calzado', 'Camperas', 'Accesorios'],
    previewProducts: [
      { name: 'Remera Premium Algodón', category: 'Indumentaria', price: 'Gs. 85.000', badge: 'Nuevo' },
      { name: 'Jean Slim Fit Denim', category: 'Pantalones', price: 'Gs. 165.000', badge: 'Popular' },
      { name: 'Campera Bomber Urbana', category: 'Abrigos', price: 'Gs. 240.000', badge: 'Tendencia' },
    ],
  },

  electronics: {
    vertical: 'electronics',
    verticalLabel: 'Tecnología, Celulares & Reparaciones',
    icon: '📱',
    hero: {
      enabled: false,
      badge: '⚡ Tecnología & Accesorios Oficiales',
      title: 'Lo último en tecnología con respaldo y garantía',
      subtitle: 'Equipos nuevos, repuestos originales y accesorios premium con asesoramiento técnico especializado.',
      ctaPrimaryText: 'Explorá el catálogo',
      ctaSecondaryText: 'Escribinos por WhatsApp',
      trustBadges: ['Garantía oficial por escrito', 'Productos 100% originales', 'Envíos rápidos asegurados'],
    },
    stats: {
      enabled: false,
      repairs: '12K+',
      satisfaction: '99.4%',
      avgTime: '1-3 horas',
    },
    previewChips: ['Celulares', 'Auriculares', 'Cargadores', 'Smartwatches', 'Fundas'],
    previewProducts: [
      { name: 'Smartphone Pro 128GB', category: 'Equipos', price: 'Gs. 2.450.000', badge: 'Oficial' },
      { name: 'Auriculares Inalámbricos ANC', category: 'Audio', price: 'Gs. 280.000', badge: 'Oferta' },
      { name: 'Cargador Rápido 30W USB-C', category: 'Accesorios', price: 'Gs. 95.000', badge: 'Garantía' },
    ],
  },

  food: {
    vertical: 'food',
    verticalLabel: 'Alimentos, Gastronomía & Bebidas',
    icon: '🥖',
    hero: {
      enabled: false,
      badge: '🥖 Sabores Auténticos & Frescos',
      title: 'Lo rico de siempre, directo a tu mesa',
      subtitle: 'Platos preparados al momento con ingredientes seleccionados. Pedí online para delivery o retiro en el local.',
      ctaPrimaryText: 'Hacé tu pedido online',
      ctaSecondaryText: 'Consultá la carta del día',
      trustBadges: ['Elaboración fresca diaria', 'Delivery rápido en el día', 'Retiro listo en local'],
    },
    stats: {
      enabled: false,
      repairs: '8.000+',
      satisfaction: '4.9★',
      avgTime: '30-45 min',
    },
    previewChips: ['Pizzas', 'Hamburguesas', 'Lomitos', 'Pastas', 'Bebidas'],
    previewProducts: [
      { name: 'Hamburguesa Doble Smash', category: 'Burgers', price: 'Gs. 42.000', badge: 'Especial' },
      { name: 'Pizza Mozzarella Artesanal', category: 'Pizzas', price: 'Gs. 55.000', badge: 'Promo' },
      { name: 'Lomito Completo Especial', category: 'Minutas', price: 'Gs. 38.000', badge: 'Recomendado' },
    ],
  },

  cosmetics: {
    vertical: 'cosmetics',
    verticalLabel: 'Cosmética, Belleza & Skincare',
    icon: '🌸',
    hero: {
      enabled: false,
      badge: '🌸 Cuidado, Belleza & Skincare',
      title: 'Realzá tu belleza con productos certificados',
      subtitle: 'Cosmética, maquillaje y cuidado personal de marcas oficiales con asesoría para tu rutina diaria.',
      ctaPrimaryText: 'Ver catálogo de belleza',
      ctaSecondaryText: 'Pedir asesoramiento',
      trustBadges: ['Productos 100% originales', 'Asesoría personalizada', 'Envíos a todo el país'],
    },
    stats: {
      enabled: false,
      repairs: '3.500+',
      satisfaction: '4.9★',
      avgTime: '24h',
    },
    previewChips: ['Skincare', 'Maquillaje', 'Fragancias', 'Cuidado Capilar', 'Accesorios'],
    previewProducts: [
      { name: 'Sérum Facial Ácido Hialurónico', category: 'Rostro', price: 'Gs. 110.000', badge: 'Top ventas' },
      { name: 'Labial Matte Larga Duración', category: 'Make-up', price: 'Gs. 55.000', badge: 'Nuevo' },
      { name: 'Crema Hidratante Botánica', category: 'Cuidado', price: 'Gs. 90.000', badge: 'Natural' },
    ],
  },

  hardware: {
    vertical: 'hardware',
    verticalLabel: 'Ferretería, Materiales & Hogar',
    icon: '🔨',
    hero: {
      enabled: false,
      badge: '🔨 Herramientas & Construcción',
      title: 'Todo para tu obra, taller y hogar',
      subtitle: 'Herramientas profesionales, materiales y equipamiento con stock permanente y precios mayoristas.',
      ctaPrimaryText: 'Ver catálogo mayorista',
      ctaSecondaryText: 'Pedir cotización por WhatsApp',
      trustBadges: ['Stock permanente inmediato', 'Precios por mayor y menor', 'Despacho rápido a obra'],
    },
    stats: {
      enabled: false,
      repairs: '15K+',
      satisfaction: '98%',
      avgTime: 'En el día',
    },
    previewChips: ['Herramientas', 'Fijaciones & Tornillos', 'Pinturas', 'Electricidad', 'Plomería'],
    previewProducts: [
      { name: 'Taladro Percutor 750W', category: 'Eléctricas', price: 'Gs. 385.000', badge: 'Garantía' },
      { name: 'Set Llaves Combinadas 12p', category: 'Manuales', price: 'Gs. 125.000', badge: 'Mayorista' },
      { name: 'Látex Interior/Exterior 20L', category: 'Pinturas', price: 'Gs. 210.000', badge: 'Rendimiento' },
    ],
  },

  barbershop: {
    vertical: 'barbershop',
    verticalLabel: 'Barbería, Peluquería & Cuidado Masculino',
    icon: '💈',
    hero: {
      enabled: false,
      badge: '💈 Cortes, Barba & Estilo',
      title: 'Tu estilo en las mejores manos',
      subtitle: 'Cortes clásicos y modernos, perfilado de barba y tratamientos capilares con profesionales certificados.',
      ctaPrimaryText: 'Reservar turno online',
      ctaSecondaryText: 'Consultar servicios',
      trustBadges: ['Turnos online sin esperas', 'Barberos profesionales', 'Ambiente confortable'],
    },
    stats: {
      enabled: false,
      repairs: '4.500+',
      satisfaction: '4.9★',
      avgTime: 'Sin espera',
    },
    previewChips: ['Cortes', 'Barba', 'Combos VIP', 'Colorimetría', 'Tratamientos'],
    previewProducts: [
      { name: 'Corte Degradé + Lavado', category: 'Servicio', price: 'Gs. 50.000', badge: 'Popular' },
      { name: 'Perfilado de Barba + Toalla', category: 'Barba', price: 'Gs. 35.000', badge: 'Clásico' },
      { name: 'Combo Corte + Barba Completa', category: 'Promo', price: 'Gs. 75.000', badge: 'Recomendado' },
    ],
  },

  beauty_services: {
    vertical: 'beauty_services',
    verticalLabel: 'Estética, Uñas & Salón de Belleza',
    icon: '✨',
    hero: {
      enabled: false,
      badge: '✨ Experiencia de Bienestar & Belleza',
      title: 'Tratamientos que realzan tu bienestar',
      subtitle: 'Manicuría, pestañas, tratamientos faciales y corporales con tecnología moderna y atención exclusiva.',
      ctaPrimaryText: 'Agendá tu cita online',
      ctaSecondaryText: 'Consultá promociones',
      trustBadges: ['Atención personalizada', 'Higiene y seguridad', 'Resultados garantizados'],
    },
    stats: {
      enabled: false,
      repairs: '3.000+',
      satisfaction: '4.9★',
      avgTime: 'Turno puntual',
    },
    previewChips: ['Manicuría', 'Pestañas & Cejas', 'Tratamientos Faciales', 'Masajes', 'Depilación'],
    previewProducts: [
      { name: 'Semipermanente con Nail Art', category: 'Uñas', price: 'Gs. 70.000', badge: 'Favorito' },
      { name: 'Lifting de Pestañas + Tinte', category: 'Mirada', price: 'Gs. 90.000', badge: 'Promo' },
      { name: 'Limpieza Facial Profunda', category: 'Facial', price: 'Gs. 130.000', badge: 'Relax' },
    ],
  },

  general: {
    vertical: 'general',
    verticalLabel: 'Comercio General & Multi-rubro',
    icon: '⭐',
    hero: {
      enabled: false,
      badge: '⭐ Variedad, Calidad & Confianza',
      title: 'Calidad, variedad y la mejor atención',
      subtitle: 'Encontrá todo lo que buscás en nuestro catálogo online con stock al día, precios claros y envíos seguros.',
      ctaPrimaryText: 'Explorar catálogo',
      ctaSecondaryText: 'Escribinos por WhatsApp',
      trustBadges: ['Atención personalizada', 'Stock 100% verificado', 'Envíos a todo el país'],
    },
    stats: {
      enabled: false,
      repairs: '10K+',
      satisfaction: '4.9★',
      avgTime: 'Despacho 24h',
    },
    previewChips: ['Destacados', 'Novedades', 'Ofertas', 'Más vendidos', 'Todo el catálogo'],
    previewProducts: [
      { name: 'Producto Destacado del Mes', category: 'General', price: 'Gs. 95.000', badge: 'Estrella' },
      { name: 'Artículo de Alta Demanda', category: 'Novedades', price: 'Gs. 140.000', badge: 'Top' },
      { name: 'Pack Especial Promocional', category: 'Promos', price: 'Gs. 185.000', badge: 'Oferta' },
    ],
  },

  other: {
    vertical: 'other',
    verticalLabel: 'Negocios & Emprendimientos',
    icon: '🏬',
    hero: {
      enabled: false,
      badge: '⭐ Tienda Oficial',
      title: 'Variedad y atención personalizada para vos',
      subtitle: 'Descubrí nuestras propuestas con atención directa, medios de pago flexibles y envíos a tu puerta.',
      ctaPrimaryText: 'Explorar productos',
      ctaSecondaryText: 'Contactar por WhatsApp',
      trustBadges: ['Atención directa', 'Garantía y confianza', 'Envíos disponibles'],
    },
    stats: {
      enabled: false,
      repairs: '5K+',
      satisfaction: '4.8★',
      avgTime: '24h',
    },
    previewChips: ['Destacados', 'Novedades', 'Ofertas', 'Recomendados'],
    previewProducts: [
      { name: 'Producto Principal', category: 'Catálogo', price: 'Gs. 120.000', badge: 'Destacado' },
      { name: 'Artículo Seleccionado', category: 'Línea', price: 'Gs. 85.000', badge: 'Nuevo' },
      { name: 'Pack Recomendado', category: 'Especial', price: 'Gs. 175.000', badge: 'Promo' },
    ],
  },
}

/**
 * Obtiene la definición de portada premium y vista previa para un rubro dado.
 */
export function getPremiumHeroForVertical(vertical?: string | null): PremiumHeroDefinition {
  const key = (vertical || 'general') as BusinessVertical
  return PREMIUM_HERO_BY_VERTICAL[key] || PREMIUM_HERO_BY_VERTICAL.general
}
