import type { WebsiteSettings } from '@/types/website-settings'

export type ContentStatus = 'empty' | 'default' | 'preset' | 'customized'

export interface StorefrontContentAudit {
  hasCustomContent: boolean
  sections: {
    hero_content: ContentStatus
    hero_stats: ContentStatus
    trust_bar: ContentStatus
    process_flows: ContentStatus
  }
  customizedSections: ('hero_content' | 'hero_stats' | 'trust_bar' | 'process_flows')[]
}

const KNOWN_DEFAULT_TITLES = new Set([
  'Los mejores productos al mejor precio',
  'Tu estilo, tu mejor versión',
  'Realzá tu belleza con productos de confianza',
  'Tu estilo, en las mejores manos',
  'Tu estilo, en buenas manos',
  'Platos y sabores listos para disfrutar',
  'Lo rico de siempre, directo a tu mesa',
  'Todo para tus proyectos, obras y refacciones',
  'Todo lo que tu hogar necesita al mejor precio',
  'Reparación profesional y equipos garantizados',
  'Reparamos tu equipo en tiempo récord con total confianza',
  'Soluciones profesionales a tu medida',
  'Lo último en tecnología con atención personalizada',
  'Estilo, calidad y las mejores marcas para vos',
  'Los mejores productos con atención personalizada',
])

const KNOWN_DEFAULT_SUBTITLES = new Set([
  'Explorá nuestro catálogo con stock actualizado, promociones exclusivas y atención personalizada.',
  'Explorá nuestro catálogo con stock actualizado, promociones exclusivas y envíos a todo el país.',
  'Prendas de calidad y las últimas tendencias en moda.',
  'Cosmética y cuidado personal con asesoramiento para elegir lo ideal.',
  'Cosmética y cuidado personal originales, con asesoramiento y entregas rápidas.',
  'Cortes, barba y color. Elegí el servicio, el día y el horario que te quede cómodo.',
  'Cortes, barba y color con profesionales. Elegí el servicio y reservá en un minuto.',
  'Ingredientes seleccionados y preparaciones hechas en el momento.',
  'Hacé tu pedido online y recibilo en tu casa o pasá a retirarlo listo.',
  'Herramientas profesionales, asesoramiento técnico y stock inmediato al mejor precio.',
  'Herramientas, materiales y equipamiento con stock disponible y envíos a domicilio u obra.',
  'Diagnóstico claro, presupuesto antes de reparar y seguimiento online.',
  'Diagnóstico sin costo, repuestos certificados y seguimiento online de tu reparación.',
  'Servicios con atención personalizada y presupuestos claros.',
  'Servicios claros, atención personalizada y presupuestos sin sorpresas.',
  'Equipos, accesorios y productos originales con garantía y entrega rápida.',
  'Encontrá las últimas novedades, ofertas exclusivas y envíos rápidos a tu puerta.',
  'Explorá nuestro catálogo online con stock actualizado, promociones exclusivas y envíos rápidos.',
])

export function detectHeroContentStatus(heroContent?: Partial<WebsiteSettings['hero_content']> | null): ContentStatus {
  if (!heroContent || (!heroContent.title?.trim() && !heroContent.subtitle?.trim())) {
    return 'empty'
  }
  const title = heroContent.title?.trim() || ''
  const subtitle = heroContent.subtitle?.trim() || ''
  if (KNOWN_DEFAULT_TITLES.has(title) || KNOWN_DEFAULT_SUBTITLES.has(subtitle)) {
    return 'preset'
  }
  return 'customized'
}

export function detectHeroStatsStatus(heroStats?: Partial<WebsiteSettings['hero_stats']> | null): ContentStatus {
  if (!heroStats) return 'empty'
  if (heroStats.enabled === true) {
    // Si fue habilitado explícitamente y tiene datos, el dueño lo personalizó
    if (heroStats.repairs?.trim() || heroStats.satisfaction?.trim() || heroStats.avgTime?.trim()) {
      return 'customized'
    }
  }
  return 'default'
}

export function detectTrustBarStatus(trustBar?: Partial<WebsiteSettings['trust_bar']> | null): ContentStatus {
  if (!trustBar || !Array.isArray(trustBar.items) || trustBar.items.length === 0) {
    return 'empty'
  }
  // Revisamos si los ítems tienen IDs de defaults ('shipping', 'payment', etc.) o presets ('vertical-1', etc.)
  const defaultIds = new Set(['shipping', 'payment', 'warranty', 'support'])
  const isDefaultOrPreset = trustBar.items.every((item) =>
    defaultIds.has(item.id) || item.id.startsWith('vertical-')
  )
  if (isDefaultOrPreset) return 'preset'
  return 'customized'
}

export function detectProcessFlowsStatus(processFlows?: WebsiteSettings['process_flows'] | null): ContentStatus {
  if (!processFlows || !Array.isArray(processFlows) || processFlows.length === 0) {
    return 'empty'
  }
  const isPresetFlow = processFlows.every((flow) => flow.id.startsWith('vertical-'))
  if (isPresetFlow) return 'preset'
  return 'customized'
}

export function detectStorefrontContentAudit(settings: Partial<WebsiteSettings>): StorefrontContentAudit {
  const heroStatus = detectHeroContentStatus(settings.hero_content)
  const statsStatus = detectHeroStatsStatus(settings.hero_stats)
  const trustBarStatus = detectTrustBarStatus(settings.trust_bar)
  const processFlowsStatus = detectProcessFlowsStatus(settings.process_flows)

  const customizedSections: ('hero_content' | 'hero_stats' | 'trust_bar' | 'process_flows')[] = []
  if (heroStatus === 'customized') customizedSections.push('hero_content')
  if (statsStatus === 'customized') customizedSections.push('hero_stats')
  if (trustBarStatus === 'customized') customizedSections.push('trust_bar')
  if (processFlowsStatus === 'customized') customizedSections.push('process_flows')

  return {
    hasCustomContent: customizedSections.length > 0,
    sections: {
      hero_content: heroStatus,
      hero_stats: statsStatus,
      trust_bar: trustBarStatus,
      process_flows: processFlowsStatus,
    },
    customizedSections,
  }
}
