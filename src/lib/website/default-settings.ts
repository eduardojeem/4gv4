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
  const companyInfo = settings.company_info ?? {}
  const heroContent = settings.hero_content ?? {}
  const heroStats = settings.hero_stats ?? {}
  const maintenanceMode = settings.maintenance_mode ?? {}

  return {
    company_info: {
      ...defaults.company_info,
      ...companyInfo,
      hours: {
        ...defaults.company_info.hours,
        ...(companyInfo.hours ?? {})
      }
    },
    hero_content: {
      ...defaults.hero_content,
      ...heroContent
    },
    hero_stats: {
      ...defaults.hero_stats,
      ...heroStats
    },
    services: Array.isArray(settings.services) ? settings.services : defaults.services,
    testimonials: Array.isArray(settings.testimonials) ? settings.testimonials : defaults.testimonials,
    maintenance_mode: {
      ...defaults.maintenance_mode,
      ...maintenanceMode
    }
  }
}
