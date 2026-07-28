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
      showTopBar: true,
      servicesPageEnabled: true,
      processSectionEnabled: false,
      marketplacePublic: true
    },
    hero_content: {
      badge: 'Servicio técnico especializado',
      title: 'Reparación profesional para tu equipo',
      subtitle: 'Diagnóstico claro, repuestos de calidad y seguimiento en línea.',
      trustBadges: ['Garantía escrita', 'Repuestos originales', 'Técnicos certificados'],
      ctaPrimaryText: 'Ver productos',
      ctaSecondaryText: 'Escribinos',
      trackRepairText: '¿Tenés una reparación? Rastreá tu equipo',
    },
    hero_stats: {
      enabled: true,
      repairs: '0+',
      satisfaction: '0%',
      avgTime: '24h'
    },
    offers_section: {
      enabled: true,
      eyebrow: 'Ofertas especiales',
      title: 'Precios que vale la pena aprovechar',
      subtitle: 'Productos seleccionados con descuentos activos en el catálogo.',
      accentColor: 'rose'
    },
    services: [],
    testimonials: [],
    process_steps: [
      { id: 'step-1', number: 1, title: 'Diagnóstico', description: 'Evaluamos tu dispositivo de forma gratuita' },
      { id: 'step-2', number: 2, title: 'Presupuesto', description: 'Te damos un precio claro y sin sorpresas' },
      { id: 'step-3', number: 3, title: 'Reparación', description: 'Nuestros técnicos reparan tu celular' },
      { id: 'step-4', number: 4, title: 'Entrega', description: 'Recoge tu dispositivo como nuevo' },
    ],
    process_flows: [],
    maintenance_mode: {
      enabled: false,
      title: 'Sitio en Mantenimiento',
      message: 'Estamos realizando mejoras en nuestro sitio. Volveremos pronto.',
      estimatedEnd: ''
    },
    checkout: {
      commerceMode: 'cart',
      payment: {
        cash:           { enabled: true,  label: 'Efectivo',          instructions: 'Pagás al retirar en el local o al recibir el delivery.' },
        card:           { enabled: true,  label: 'Tarjeta',           instructions: 'Posnet inalámbrico disponible en el local o a domicilio.' },
        transfer:       { enabled: true,  label: 'Transferencia',     instructions: 'Te enviaremos los datos bancarios por WhatsApp o email.' },
        digital_wallet: { enabled: true,  label: 'Billetera digital', instructions: 'Te enviaremos el QR o link de pago tras confirmar el pedido.' },
      },
      delivery: {
        enabled: true,
        defaultCost: 0,
        freeThreshold: 0,
        estimatedTime: '30–60 min',
        zoneOptions: [],
        zones: '',
        instructions: '',
      },
      pickup: {
        enabled: true,
        estimatedTime: '20–30 min',
        instructions: '',
      },
      minOrderAmount: 0,
      confirmationMessage: '',
    }
  }
}

export function applyWebsiteSettingsDefaults(
  settings: Partial<WebsiteSettings>
): WebsiteSettings {
  const defaults = getWebsiteSettingsDefaults()
  const companyInfo = (settings.company_info || {}) as Partial<WebsiteSettings['company_info']>
  const heroContent = (settings.hero_content || {}) as Partial<WebsiteSettings['hero_content']>
  const heroStats = (settings.hero_stats || {}) as Partial<WebsiteSettings['hero_stats']>
  const offersSection = (settings.offers_section || {}) as Partial<WebsiteSettings['offers_section']>
  const maintenanceMode = (settings.maintenance_mode || {}) as Partial<WebsiteSettings['maintenance_mode']>

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
    offers_section: {
      ...defaults.offers_section,
      ...offersSection
    },
    services: Array.isArray(settings.services) ? settings.services : defaults.services,
    testimonials: Array.isArray(settings.testimonials) ? settings.testimonials : defaults.testimonials,
    process_steps: Array.isArray(settings.process_steps) && settings.process_steps.length > 0
      ? settings.process_steps
      : defaults.process_steps,
    process_flows: Array.isArray(settings.process_flows)
      ? settings.process_flows
      : defaults.process_flows,
    maintenance_mode: {
      ...defaults.maintenance_mode,
      ...maintenanceMode
    },
    checkout: {
      ...defaults.checkout,
      ...(settings.checkout ?? {}),
      payment: {
        ...defaults.checkout.payment,
        ...(settings.checkout?.payment ?? {}),
        cash:           { ...defaults.checkout.payment.cash,           ...(settings.checkout?.payment?.cash ?? {}) },
        card:           { ...defaults.checkout.payment.card,           ...(settings.checkout?.payment?.card ?? {}) },
        transfer:       { ...defaults.checkout.payment.transfer,       ...(settings.checkout?.payment?.transfer ?? {}) },
        digital_wallet: { ...defaults.checkout.payment.digital_wallet, ...(settings.checkout?.payment?.digital_wallet ?? {}) },
      },
      delivery: { ...defaults.checkout.delivery, ...(settings.checkout?.delivery ?? {}) },
      pickup:   { ...defaults.checkout.pickup,   ...(settings.checkout?.pickup   ?? {}) },
    }
  }
}
