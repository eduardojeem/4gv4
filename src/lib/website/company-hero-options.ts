import type { CompanyInfo, HeroContent, HeroStats } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { PremiumHeroDefinition } from '@/lib/website/premium-hero'
import type { SectionCardTone } from '@/components/admin/website/SectionCard'

export interface CompanyHeroOption {
  id: string
  label: string
  badgeLabel: string
  icon: string
  tone: SectionCardTone
  description: string
  hero: {
    badge: string
    title: string
    subtitle: string
    ctaPrimaryText: string
    ctaSecondaryText: string
    trustBadges: string[]
  }
  stats: {
    repairs: string
    satisfaction: string
    avgTime: string
  }
}

/**
 * Genera opciones estratégicas de portada para la empresa.
 * Se adaptan automáticamente al nombre comercial, eslogan, rubro y capacidades.
 */
export function getCompanyHeroOptions(
  company: Pick<CompanyInfo, 'name' | 'slogan' | 'description' | 'address' | 'phone' | 'whatsapp'> | undefined,
  capabilities: StorefrontCapabilities,
  verticalDef?: PremiumHeroDefinition
): CompanyHeroOption[] {
  const companyName = company?.name?.trim() || 'Tu Empresa'
  const slogan = company?.slogan?.trim()
  const isServices = capabilities.primaryAction.kind === 'services' || capabilities.businessVertical === 'barbershop' || capabilities.businessVertical === 'beauty_services'

  const options: CompanyHeroOption[] = [
    {
      id: 'catalog',
      label: 'Venta & Catálogo',
      badgeLabel: 'Comercial',
      icon: '🛍️',
      tone: 'blue',
      description: 'Ideal para destacar tu catálogo de productos y maximizar ventas online.',
      hero: {
        badge: slogan && slogan.length >= 3 ? slogan : `✨ Novedades y Catálogo en ${companyName}`,
        title: `Todo lo que buscás en ${companyName}`,
        subtitle: `Explorá nuestra selección exclusiva de productos con la mejor calidad, stock disponible y envíos directos a tu puerta.`,
        ctaPrimaryText: 'Ver productos',
        ctaSecondaryText: 'Consultar por WhatsApp',
        trustBadges: ['Calidad garantizada', 'Atención directa', 'Envíos a todo el país'],
      },
      stats: {
        repairs: '1.000+',
        satisfaction: '99%',
        avgTime: '24-48h',
      },
    },
    {
      id: 'offers',
      label: 'Ofertas & Novedades',
      badgeLabel: 'Promocional',
      icon: '🔥',
      tone: 'orange',
      description: 'Ideal para temporadas de descuentos, liquidaciones o nuevos ingresos.',
      hero: {
        badge: '⚡ Precios Especiales & Novedades',
        title: `Aprovechá las mejores promociones en ${companyName}`,
        subtitle: `Descubrí ofertas imperdibles y precios especiales por tiempo limitado en artículos seleccionados. ¡No te quedes sin el tuyo!`,
        ctaPrimaryText: 'Ver promociones',
        ctaSecondaryText: 'Pedir cotización',
        trustBadges: ['Precios especiales', 'Stock limitado', 'Envíos en el día'],
      },
      stats: {
        repairs: '100%',
        satisfaction: '4.9★',
        avgTime: 'En el día',
      },
    },
    {
      id: 'trust',
      label: 'Confianza & Respaldo',
      badgeLabel: 'Institucional',
      icon: '🛡️',
      tone: 'indigo',
      description: 'Destaca la trayectoria de tu negocio, respaldo y atención personalizada.',
      hero: {
        badge: '✨ Calidad, Garantía & Respaldo',
        title: `${companyName} · Tu tienda de máxima confianza`,
        subtitle: `Brindamos productos seleccionados y atención profesional con garantía real, asesoramiento honesto y soporte postventa continuo.`,
        ctaPrimaryText: 'Conocer catálogo',
        ctaSecondaryText: 'Hablar con un asesor',
        trustBadges: ['Garantía por escrito', 'Atención personalizada', 'Años de experiencia'],
      },
      stats: {
        repairs: '5.000+',
        satisfaction: '99.5%',
        avgTime: 'Garantía real',
      },
    },
    {
      id: 'whatsapp',
      label: 'Asesoría por WhatsApp',
      badgeLabel: 'Conversión rápida',
      icon: '💬',
      tone: 'emerald',
      description: 'Enfocada en que los clientes te consulten directamente para cerrar ventas por chat.',
      hero: {
        badge: '💬 Atención Inmediata & Asesoría',
        title: `Te asesoramos al instante en ${companyName}`,
        subtitle: `¿Tenés dudas o buscás algo específico? Escribinos por WhatsApp y nuestro equipo te responde al instante con atención personalizada.`,
        ctaPrimaryText: 'Hablar por WhatsApp',
        ctaSecondaryText: 'Explorar productos',
        trustBadges: ['Respuesta inmediata', 'Asesoramiento experto', 'Atención directa'],
      },
      stats: {
        repairs: '100%',
        satisfaction: 'Respuesta rápida',
        avgTime: 'En minutos',
      },
    },
  ]

  if (isServices) {
    options.unshift({
      id: 'services',
      label: 'Turnos & Servicios',
      badgeLabel: 'Reservas online',
      icon: '📅',
      tone: 'teal',
      description: 'Enfocada en que los clientes agenden su turno online de forma inmediata sin demoras.',
      hero: {
        badge: '💈 Reservá tu turno online',
        title: `${companyName} · Tu estilo y bienestar en las mejores manos`,
        subtitle: `Elegí tu profesional, seleccioná el servicio y agendá tu horario preferido en menos de un minuto sin esperas.`,
        ctaPrimaryText: 'Reservar turno',
        ctaSecondaryText: 'Consultar precios',
        trustBadges: ['Turnos online', 'Profesionales expertos', 'Sin esperas'],
      },
      stats: {
        repairs: '100%',
        satisfaction: '5.0★',
        avgTime: 'Sin demoras',
      },
    })
  }

  // Si tenemos definición vertical específica, sincronizar métricas del vertical
  if (verticalDef) {
    const catalogOpt = options.find((o) => o.id === 'catalog')
    if (catalogOpt && verticalDef.stats.repairs) {
      catalogOpt.stats = {
        repairs: verticalDef.stats.repairs,
        satisfaction: verticalDef.stats.satisfaction,
        avgTime: verticalDef.stats.avgTime,
      }
    }
  }

  return options
}
