import type { WebsiteSettings } from '@/types/website-settings'
import type { BusinessVertical, OperatingModel } from '@/lib/organization/business-profile'

export function getWebsiteDefaultsForVertical(
  vertical: BusinessVertical = 'general',
  operatingModel: OperatingModel = 'retail',
  legacyBusinessType?: string
): Partial<WebsiteSettings> {
  const isRepairOrTech =
    vertical === 'electronics' ||
    operatingModel === 'repair' ||
    operatingModel === 'mixed' ||
    (legacyBusinessType && /reparaci|tecnic|taller|celular/i.test(legacyBusinessType))

  const isServiceOnly = operatingModel === 'service'

  if (vertical === 'clothing') {
    return {
      company_info: {
        servicesPageEnabled: false,
        repairTrackingEnabled: false,
        processSectionEnabled: true,
      } as any,
      hero_content: {
        enabled: true,
        badge: 'Nueva Colección & Tendencias',
        title: 'Tu estilo, tu mejor versión',
        subtitle: 'Prendas de alta calidad, envíos a todo el país y las últimas tendencias en moda.',
        trustBadges: ['Envíos a todo el país', 'Cambio fácil', 'Calidad 100% garantizada'],
        ctaPrimaryText: 'Ver colección',
        ctaSecondaryText: 'Consultar talles',
        trackRepairText: '¿Hiciste una compra? Rastreá el estado de tu pedido',
      },
      hero_stats: {
        enabled: true,
        repairs: '5.000+',
        satisfaction: '99%',
        avgTime: '24-48h',
      },
      process_steps: [
        { id: 'step-1', number: 1, title: 'Elegí tus prendas', description: 'Explorá nuestros modelos, talles y colores disponibles.' },
        { id: 'step-2', number: 2, title: 'Confirmá tu pedido', description: 'Coordinamos el medio de pago más cómodo para vos.' },
        { id: 'step-3', number: 3, title: 'Despacho rápido', description: 'Preparamos tu paquete con el máximo cuidado.' },
        { id: 'step-4', number: 4, title: 'Recibí en tu puerta', description: 'Entrega a domicilio o retiro directo en sucursal.' },
      ],
    }
  }

  if (vertical === 'cosmetics') {
    return {
      company_info: {
        servicesPageEnabled: false,
        repairTrackingEnabled: false,
        processSectionEnabled: true,
      } as any,
      hero_content: {
        enabled: true,
        badge: 'Cuidado & Belleza',
        title: 'Realzá tu belleza con productos de confianza',
        subtitle: 'Cosmética y cuidado personal 100% originales con asesoramiento y envíos rápidos.',
        trustBadges: ['Productos 100% originales', 'Asesoría personalizada', 'Envíos a todo el país'],
        ctaPrimaryText: 'Ver catálogo',
        ctaSecondaryText: 'Asesoramiento',
        trackRepairText: '¿Hiciste una compra? Rastreá tu pedido',
      },
      hero_stats: {
        enabled: true,
        repairs: '10K+',
        satisfaction: '99.5%',
        avgTime: 'En el día',
      },
      process_steps: [
        { id: 'step-1', number: 1, title: 'Explorá el catálogo', description: 'Encontrá los mejores productos para tu rutina.' },
        { id: 'step-2', number: 2, title: 'Asesoría directa', description: 'Te orientamos para elegir la opción ideal para vos.' },
        { id: 'step-3', number: 3, title: 'Pago 100% seguro', description: 'Transferencia, QR, tarjeta o contra entrega.' },
        { id: 'step-4', number: 4, title: 'Entrega en tu casa', description: 'Despacho rápido y embalaje protegido.' },
      ],
    }
  }

  if (vertical === 'food') {
    return {
      company_info: {
        servicesPageEnabled: false,
        repairTrackingEnabled: false,
        processSectionEnabled: true,
      } as any,
      hero_content: {
        enabled: true,
        badge: 'Sabores Únicos & Frescos',
        title: 'Platos y sabores listos para disfrutar',
        subtitle: 'Ingredientes seleccionados, frescura garantizada y entrega rápida a tu mesa.',
        trustBadges: ['100% Fresco y artesanal', 'Delivery express', 'Pago contra entrega'],
        ctaPrimaryText: 'Ver menú online',
        ctaSecondaryText: 'Pedir por WhatsApp',
        trackRepairText: '¿Hiciste un pedido? Consultá el estado de tu delivery',
      },
      hero_stats: {
        enabled: true,
        repairs: '15K+',
        satisfaction: '4.9★',
        avgTime: '30-45 min',
      },
      process_steps: [
        { id: 'step-1', number: 1, title: 'Elegí tu menú', description: 'Descubrí nuestras opciones, combos y promociones.' },
        { id: 'step-2', number: 2, title: 'Hacé tu pedido', description: 'Confirmación directa y personalizada.' },
        { id: 'step-3', number: 3, title: 'Preparación express', description: 'Elaborado en el momento con ingredientes frescos.' },
        { id: 'step-4', number: 4, title: 'Delivery o Retiro', description: 'Llega caliente y listo a tu ubicación.' },
      ],
    }
  }

  if (vertical === 'hardware') {
    return {
      company_info: {
        servicesPageEnabled: false,
        repairTrackingEnabled: false,
        processSectionEnabled: true,
      } as any,
      hero_content: {
        enabled: true,
        badge: 'Herramientas & Materiales',
        title: 'Todo para tus proyectos, obras y refacciones',
        subtitle: 'Herramientas profesionales, asesoramiento técnico y stock inmediato al mejor precio.',
        trustBadges: ['Garantía de fábrica', 'Stock permanente', 'Envíos a obras y talleres'],
        ctaPrimaryText: 'Ver catálogo',
        ctaSecondaryText: 'Pedir cotización',
        trackRepairText: '¿Tenés un pedido? Rastreá el estado de tu despacho',
      },
      hero_stats: {
        enabled: true,
        repairs: '8.000+',
        satisfaction: '98%',
        avgTime: '24h',
      },
      process_steps: [
        { id: 'step-1', number: 1, title: 'Consultá tu lista', description: 'Buscá tus herramientas o envianos tu lista de materiales.' },
        { id: 'step-2', number: 2, title: 'Presupuesto rápido', description: 'Cotización con los mejores precios y descuentos por cantidad.' },
        { id: 'step-3', number: 3, title: 'Pago flexible', description: 'Facturación legal, transferencias y tarjetas.' },
        { id: 'step-4', number: 4, title: 'Despacho o retiro', description: 'Envíos directos a tu obra o retiro en sucursal.' },
      ],
    }
  }

  if (isRepairOrTech) {
    return {
      company_info: {
        servicesPageEnabled: true,
        repairTrackingEnabled: true,
        processSectionEnabled: true,
      } as any,
      hero_content: {
        enabled: true,
        badge: 'Servicio Técnico & Tecnología',
        title: 'Reparación profesional y equipos garantizados',
        subtitle: 'Diagnóstico claro, repuestos originales, técnicos certificados y seguimiento online.',
        trustBadges: ['Garantía escrita', 'Repuestos originales', 'Técnicos certificados'],
        ctaPrimaryText: 'Ver productos',
        ctaSecondaryText: 'Consultar falla',
        trackRepairText: '¿Tenés una reparación? Rastreá tu equipo',
      },
      hero_stats: {
        enabled: true,
        repairs: '10K+',
        satisfaction: '99%',
        avgTime: '24-48h',
      },
      process_steps: [
        { id: 'step-1', number: 1, title: 'Diagnóstico', description: 'Evaluamos tu dispositivo de forma rápida y transparente.' },
        { id: 'step-2', number: 2, title: 'Presupuesto', description: 'Te damos un precio claro y sin sorpresas antes de avanzar.' },
        { id: 'step-3', number: 3, title: 'Reparación especializada', description: 'Técnicos certificados con repuestos garantizados.' },
        { id: 'step-4', number: 4, title: 'Entrega con garantía', description: 'Retirás tu equipo probado y con garantía escrita.' },
      ],
    }
  }

  if (isServiceOnly) {
    return {
      company_info: {
        servicesPageEnabled: true,
        repairTrackingEnabled: false,
        processSectionEnabled: true,
      } as any,
      hero_content: {
        enabled: true,
        badge: 'Atención Profesional',
        title: 'Soluciones profesionales a tu medida',
        subtitle: 'Servicios de alta calidad, atención personalizada y resultados garantizados.',
        trustBadges: ['Atención directa', 'Presupuestos claros', '100% Garantía'],
        ctaPrimaryText: 'Nuestros servicios',
        ctaSecondaryText: 'Solicitar presupuesto',
        trackRepairText: '¿Tenés un servicio activo? Rastreá tu orden',
      },
      hero_stats: {
        enabled: true,
        repairs: '1.500+',
        satisfaction: '100%',
        avgTime: 'Inmediato',
      },
      process_steps: [
        { id: 'step-1', number: 1, title: 'Contacto inicial', description: 'Contanos qué necesidad o proyecto tenés.' },
        { id: 'step-2', number: 2, title: 'Propuesta a medida', description: 'Evaluación y cotización clara y transparente.' },
        { id: 'step-3', number: 3, title: 'Ejecución del servicio', description: 'Trabajo profesional con altos estándares de calidad.' },
        { id: 'step-4', number: 4, title: 'Entrega y soporte', description: 'Revisión final y acompañamiento continuo.' },
      ],
    }
  }

  // Default: General Store / Multirubro
  return {
    company_info: {
      servicesPageEnabled: false,
      repairTrackingEnabled: false,
      processSectionEnabled: true,
    } as any,
    hero_content: {
      enabled: true,
      badge: 'Catálogo Oficial',
      title: 'Los mejores productos al mejor precio',
      subtitle: 'Explorá nuestro catálogo con stock actualizado, promociones exclusivas y atención personalizada.',
      trustBadges: ['Envíos a todo el país', 'Atención personalizada', 'Compra 100% segura'],
      ctaPrimaryText: 'Explorar catálogo',
      ctaSecondaryText: 'Escribinos',
      trackRepairText: '¿Hiciste una compra? Rastreá el estado de tu pedido',
    },
    hero_stats: {
      enabled: true,
      repairs: '5.000+',
      satisfaction: '99%',
      avgTime: '24h',
    },
    process_steps: [
      { id: 'step-1', number: 1, title: 'Elegí tus productos', description: 'Navegá por nuestras categorías y seleccioná lo que necesitás.' },
      { id: 'step-2', number: 2, title: 'Confirmá tu pedido', description: 'Completá tus datos y método de entrega preferido.' },
      { id: 'step-3', number: 3, title: 'Pago seguro', description: 'Aboná por transferencia, tarjeta, billetera o al recibir.' },
      { id: 'step-4', number: 4, title: 'Recibí en tu puerta', description: 'Envíos a todo el país o retiro en local.' },
    ],
  }
}

export function getWebsiteSettingsDefaults(): WebsiteSettings {
  return {
    company_info: {
      name: '',
      phone: '',
      email: '',
      address: '',
      mapsUrl: '',
      hours: { weekdays: '', saturday: '', sunday: '' },
      logoUrl: '',
      brandColor: 'blue',
      headerStyle: 'glass',
      headerColor: '',
      showTopBar: true,
      servicesPageEnabled: false,
      repairTrackingEnabled: false,
      processSectionEnabled: true,
      marketplacePublic: true
    },
    hero_content: {
      enabled: true,
      badge: 'Catálogo Oficial',
      title: 'Los mejores productos al mejor precio',
      subtitle: 'Explorá nuestro catálogo con stock actualizado, promociones exclusivas y atención personalizada.',
      trustBadges: ['Envíos a todo el país', 'Atención personalizada', 'Compra 100% segura'],
      ctaPrimaryText: 'Explorar productos',
      ctaSecondaryText: 'Escribinos',
      trackRepairText: '¿Hiciste una compra? Rastreá el estado de tu pedido',
    },
    hero_stats: {
      enabled: true,
      repairs: '5.000+',
      satisfaction: '99%',
      avgTime: '24h'
    },
    offers_section: {
      enabled: true,
      eyebrow: 'Ofertas especiales',
      title: 'Precios que vale la pena aprovechar',
      subtitle: 'Productos seleccionados con descuentos activos en el catálogo.',
      accentColor: 'rose',
      carousel: {
        enabled: true,
        title: 'Destacados de la semana',
        subtitle: 'Las mejores rebajas activas, en rotación automática.',
        autoplay: true,
        intervalSeconds: 5,
        maxItems: 8
      }
    },
    promotional_carousel: {
      enabled: false,
      autoplay: true,
      intervalSeconds: 6,
      layoutMode: 'contained',
      slides: [],
    },
    // Sin slides el banner no se dibuja, asi que arranca habilitado: aparece
    // recien cuando se carga el primer slide desde el dashboard.
    offers_carousel: {
      enabled: true,
      autoplay: true,
      intervalSeconds: 6,
      layoutMode: 'contained',
      slides: [],
    },
    trust_bar: {
      enabled: true,
      position: 'above_carousel',
      items: [
        {
          id: 'shipping',
          icon: 'truck',
          title: 'Envíos Rápidos',
          description: 'A domicilio o retiro en tienda',
          active: true,
        },
        {
          id: 'payment',
          icon: 'credit-card',
          title: 'Medios de Pago',
          description: 'Tarjetas, cuotas y transferencias',
          active: true,
        },
        {
          id: 'warranty',
          icon: 'shield',
          title: 'Compra Segura',
          description: 'Garantía oficial en tus compras',
          active: true,
        },
        {
          id: 'support',
          icon: 'message',
          title: 'Atención Directa',
          description: 'Asesoramiento personalizado',
          active: true,
        },
      ],
    },
    product_credit_defaults: {
      enabled: true,
      calculationBase: 'sale',
      respectOffer: true,
      costMarkupPercent: 0,
      frequency: 'monthly',
      downPaymentPercent: 0,
      publicByDefault: true,
      plans: [
        { count: 3, rate: 0 },
        { count: 6, rate: 10 },
        { count: 12, rate: 20 },
      ],
    },
    services_section: {
      badge: 'Lo que hacemos',
      title: 'Nuestros servicios',
      subtitle: 'Servicios publicados por la empresa para consultas y atención directa.',
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
  const promotionalCarousel = (settings.promotional_carousel || {}) as Partial<WebsiteSettings['promotional_carousel']>
  const offersCarousel = (settings.offers_carousel || {}) as Partial<WebsiteSettings['offers_carousel']>
  const trustBar = (settings.trust_bar || {}) as Partial<WebsiteSettings['trust_bar']>
  const productCreditDefaults = (settings.product_credit_defaults || {}) as Partial<WebsiteSettings['product_credit_defaults']>
  const servicesSection = (settings.services_section || {}) as Partial<WebsiteSettings['services_section']>
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
      ...offersSection,
      // Merge anidado: los settings guardados antes de existir el carrusel no
      // traen la clave, y un guardado parcial no debe borrar los defaults.
      carousel: {
        ...defaults.offers_section.carousel,
        ...(offersSection.carousel ?? {})
      }
    },
    promotional_carousel: {
      ...defaults.promotional_carousel,
      ...promotionalCarousel,
      slides: Array.isArray(promotionalCarousel.slides)
        ? promotionalCarousel.slides
        : defaults.promotional_carousel.slides,
    },
    offers_carousel: {
      ...defaults.offers_carousel,
      ...offersCarousel,
      slides: Array.isArray(offersCarousel.slides)
        ? offersCarousel.slides
        : defaults.offers_carousel.slides,
    },
    trust_bar: {
      ...defaults.trust_bar,
      ...trustBar,
      items: Array.isArray(trustBar.items)
        ? trustBar.items
        : defaults.trust_bar.items,
    },
    product_credit_defaults: {
      ...defaults.product_credit_defaults,
      ...productCreditDefaults,
      // Los planes se reemplazan enteros: un array vacio es una eleccion
      // valida (no ofrecer ninguno), no un "usa los defaults".
      plans: Array.isArray(productCreditDefaults.plans)
        ? productCreditDefaults.plans
        : defaults.product_credit_defaults.plans,
    },
    services_section: {
      ...defaults.services_section,
      ...servicesSection
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
