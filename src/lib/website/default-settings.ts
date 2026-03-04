import type { WebsiteSettings } from '@/types/website-settings'

export function getWebsiteSettingsDefaults(): WebsiteSettings {
  return {
    company_info: {
      name: '',
      phone: '',
      email: '',
      address: '',
      hours: { weekdays: '', saturday: '', sunday: '' },
      logoUrl: '',
      brandColor: 'blue',
      headerStyle: 'glass',
      headerColor: '',
      showTopBar: true
    },
    hero_content: {
      badge: 'Servicio técnico especializado',
      title: 'Reparación profesional para tu equipo',
      subtitle: 'Diagnóstico claro, repuestos de calidad y seguimiento en línea.'
    },
    hero_stats: {
      repairs: '0+',
      satisfaction: '0%',
      avgTime: '24h'
    },
    services: [],
    testimonials: [],
    maintenance_mode: {
      enabled: false,
      title: 'Sitio en Mantenimiento',
      message: 'Estamos realizando mejoras en nuestro sitio. Volveremos pronto.',
      estimatedEnd: ''
    }
  }
}

export function applyWebsiteSettingsDefaults(
  settings: Partial<WebsiteSettings>
): WebsiteSettings {
  const defaults = getWebsiteSettingsDefaults()

  return {
    company_info: settings.company_info ?? defaults.company_info,
    hero_content: settings.hero_content ?? defaults.hero_content,
    hero_stats: settings.hero_stats ?? defaults.hero_stats,
    services: Array.isArray(settings.services) ? settings.services : defaults.services,
    testimonials: Array.isArray(settings.testimonials) ? settings.testimonials : defaults.testimonials,
    maintenance_mode: settings.maintenance_mode ?? defaults.maintenance_mode
  }
}

