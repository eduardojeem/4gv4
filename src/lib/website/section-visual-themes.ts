export interface SectionVisualTheme {
  id: string
  group: 'sales' | 'design' | 'services' | 'overview'
  groupLabel: string
  groupTone: 'blue' | 'purple' | 'teal' | 'slate'
  location: string
  iconColor: string
  iconBg: string
  borderTone: string
  activeBg: string
  activeBorder: string
  activeIndicator: string
  activeText: string
  gradientBg: string
  badgeTone: string
}

export const SECTION_GROUP_THEMES = {
  sales: {
    label: 'Datos y venta',
    dot: 'bg-zinc-500 dark:bg-zinc-400',
    pill: 'border-border/80 bg-muted/60 text-foreground',
    border: 'border-border/80',
  },
  design: {
    label: 'Diseño de la tienda',
    dot: 'bg-zinc-500 dark:bg-zinc-400',
    pill: 'border-border/80 bg-muted/60 text-foreground',
    border: 'border-border/80',
  },
  services: {
    label: 'Servicios y turnos',
    dot: 'bg-zinc-500 dark:bg-zinc-400',
    pill: 'border-border/80 bg-muted/60 text-foreground',
    border: 'border-border/80',
  },
  overview: {
    label: 'Panel general',
    dot: 'bg-foreground',
    pill: 'border-border/80 bg-muted/60 text-foreground',
    border: 'border-border/80',
  },
} as const

const NEUTRAL_THEME_BASE = {
  iconColor: 'text-foreground',
  iconBg: 'bg-muted/70 dark:bg-muted/40',
  borderTone: 'border-border/70',
  activeBg: 'bg-muted dark:bg-muted/60',
  activeBorder: 'border-border',
  activeIndicator: 'bg-foreground',
  activeText: 'text-foreground',
  gradientBg: 'from-muted/40 via-muted/20 to-transparent border-border/80',
  badgeTone: 'border-border/80 bg-muted/50 text-muted-foreground',
}

export const SECTION_VISUAL_THEMES: Record<string, SectionVisualTheme> = {
  overview: {
    id: 'overview',
    group: 'overview',
    groupLabel: 'Panel general',
    groupTone: 'slate',
    location: 'Resumen global y guía de configuración',
    ...NEUTRAL_THEME_BASE,
  },
  company: {
    id: 'company',
    group: 'sales',
    groupLabel: 'Datos y venta',
    groupTone: 'slate',
    location: 'Cabecera, contacto, horarios, logo y pie de página',
    ...NEUTRAL_THEME_BASE,
  },
  checkout: {
    id: 'checkout',
    group: 'sales',
    groupLabel: 'Datos y venta',
    groupTone: 'slate',
    location: 'Carrito de compras, envíos, retiro y botón de WhatsApp',
    ...NEUTRAL_THEME_BASE,
  },
  hero: {
    id: 'hero',
    group: 'design',
    groupLabel: 'Diseño de la tienda',
    groupTone: 'slate',
    location: 'Arriba de todo en la portada principal (/inicio)',
    ...NEUTRAL_THEME_BASE,
  },
  carousel: {
    id: 'carousel',
    group: 'design',
    groupLabel: 'Diseño de la tienda',
    groupTone: 'slate',
    location: 'Banners publicitarios deslizantes en portada (/inicio)',
    ...NEUTRAL_THEME_BASE,
  },
  trust_bar: {
    id: 'trust_bar',
    group: 'design',
    groupLabel: 'Diseño de la tienda',
    groupTone: 'slate',
    location: 'Barra horizontal de garantías y confianza en portada',
    ...NEUTRAL_THEME_BASE,
  },
  offers: {
    id: 'offers',
    group: 'design',
    groupLabel: 'Diseño de la tienda',
    groupTone: 'slate',
    location: 'Sección de ofertas en portada y página /ofertas',
    ...NEUTRAL_THEME_BASE,
  },
  brands: {
    id: 'brands',
    group: 'design',
    groupLabel: 'Diseño de la tienda',
    groupTone: 'slate',
    location: 'Marquesina deslizante de marcas oficiales en portada',
    ...NEUTRAL_THEME_BASE,
  },
  announcement: {
    id: 'announcement',
    group: 'design',
    groupLabel: 'Diseño de la tienda',
    groupTone: 'slate',
    location: 'Ventana emergente (modal) al ingresar a la tienda',
    ...NEUTRAL_THEME_BASE,
  },
  services: {
    id: 'services',
    group: 'services',
    groupLabel: 'Servicios y turnos',
    groupTone: 'slate',
    location: 'Grilla de servicios en portada y página /servicios',
    ...NEUTRAL_THEME_BASE,
  },
  booking: {
    id: 'booking',
    group: 'services',
    groupLabel: 'Servicios y turnos',
    groupTone: 'slate',
    location: 'Agendamiento de turnos online en portada y /reservar',
    ...NEUTRAL_THEME_BASE,
  },
  gallery: {
    id: 'gallery',
    group: 'services',
    groupLabel: 'Servicios y turnos',
    groupTone: 'slate',
    location: 'Mosaico de fotos y trabajos realizados en portada',
    ...NEUTRAL_THEME_BASE,
  },
  process: {
    id: 'process',
    group: 'services',
    groupLabel: 'Servicios y turnos',
    groupTone: 'slate',
    location: 'Explicación del proceso de atención o compra paso a paso',
    ...NEUTRAL_THEME_BASE,
  },
}

export function getSectionVisualTheme(sectionId: string): SectionVisualTheme {
  return SECTION_VISUAL_THEMES[sectionId] ?? SECTION_VISUAL_THEMES.overview
}
