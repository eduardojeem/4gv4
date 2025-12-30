import { SegmentCriteria } from '@/hooks/use-segmentation'

export interface SegmentTemplate {
  id: string
  name: string
  description: string
  criteria: SegmentCriteria
  color: string
  icon: string
  category: 'value' | 'behavior' | 'lifecycle' | 'risk' | 'engagement' | 'geographic' | 'demographic'
  estimatedSize: string
  useCase: string
  priority: number
  tags: string[]
  businessImpact: string
  recommendedActions: string[]
}

export const segmentationTemplates: SegmentTemplate[] = [
  // Segmentos de Valor
  {
    id: 'vip-customers',
    name: 'Clientes VIP Elite',
    description: 'Clientes de máximo valor con historial de compras premium',
    criteria: {
      lifetimeValue: { min: 10000 },
      orderCount: { min: 15 },
      satisfactionScore: { min: 4.5 },
      avgOrderValue: { min: 500 }
    },
    color: '#FFD700',
    icon: 'star',
    category: 'value',
    estimatedSize: '2-5%',
    useCase: 'Programas de lealtad exclusivos y atención personalizada',
    priority: 1,
    tags: ['alto-valor', 'premium', 'lealtad'],
    businessImpact: 'Alto - Representan el 30-40% de los ingresos',
    recommendedActions: [
      'Asignar gerente de cuenta dedicado',
      'Acceso prioritario a nuevos productos',
      'Descuentos exclusivos y ofertas especiales',
      'Invitaciones a eventos VIP'
    ]
  },
  {
    id: 'high-value-customers',
    name: 'Clientes de Alto Valor',
    description: 'Clientes con alto potencial de ingresos',
    criteria: {
      lifetimeValue: { min: 5000, max: 9999 },
      orderCount: { min: 8 },
      satisfactionScore: { min: 4.0 }
    },
    color: '#FF6B35',
    icon: 'trending-up',
    category: 'value',
    estimatedSize: '8-12%',
    useCase: 'Programas de upselling y cross-selling',
    priority: 2,
    tags: ['alto-valor', 'potencial'],
    businessImpact: 'Alto - Candidatos para convertir en VIP',
    recommendedActions: [
      'Campañas de upselling personalizadas',
      'Ofertas de productos complementarios',
      'Programas de referidos con incentivos',
      'Comunicación proactiva sobre nuevos productos'
    ]
  },

  // Segmentos de Comportamiento
  {
    id: 'frequent-buyers',
    name: 'Compradores Súper Frecuentes',
    description: 'Clientes con patrones de compra muy regulares',
    criteria: {
      orderCount: { min: 10 },
      avgDaysBetweenOrders: { max: 21 },
      purchaseFrequency: ['high'],
      lastOrderDays: { max: 30 }
    },
    color: '#4ECDC4',
    icon: 'shopping-bag',
    category: 'behavior',
    estimatedSize: '6-10%',
    useCase: 'Programas de suscripción y compra automática',
    priority: 2,
    tags: ['frecuente', 'regular', 'fidelidad'],
    businessImpact: 'Alto - Ingresos predecibles y constantes',
    recommendedActions: [
      'Ofrecer programas de suscripción',
      'Descuentos por volumen',
      'Recordatorios de recompra automáticos',
      'Productos en oferta basados en historial'
    ]
  },
  {
    id: 'seasonal-buyers',
    name: 'Compradores Estacionales',
    description: 'Clientes que compran en períodos específicos',
    criteria: {
      orderCount: { min: 3, max: 8 },
      avgDaysBetweenOrders: { min: 60, max: 120 }
    },
    color: '#95E1D3',
    icon: 'calendar',
    category: 'behavior',
    estimatedSize: '15-20%',
    useCase: 'Campañas estacionales y recordatorios temporales',
    priority: 3,
    tags: ['estacional', 'temporal'],
    businessImpact: 'Medio - Ingresos concentrados en períodos específicos',
    recommendedActions: [
      'Campañas pre-temporada',
      'Recordatorios antes de fechas clave',
      'Ofertas especiales en temporadas bajas',
      'Análisis de patrones estacionales'
    ]
  },

  // Segmentos de Ciclo de Vida
  {
    id: 'new-customers',
    name: 'Nuevos Clientes Prometedores',
    description: 'Clientes recién registrados con potencial alto',
    criteria: {
      registrationDays: { max: 30 },
      orderCount: { min: 1, max: 3 },
      avgOrderValue: { min: 200 }
    },
    color: '#A8E6CF',
    icon: 'users',
    category: 'lifecycle',
    estimatedSize: '12-18%',
    useCase: 'Programas de onboarding y primera experiencia',
    priority: 1,
    tags: ['nuevo', 'onboarding', 'potencial'],
    businessImpact: 'Alto - Oportunidad de crear lealtad temprana',
    recommendedActions: [
      'Secuencia de emails de bienvenida',
      'Descuento en segunda compra',
      'Guías de productos y tutoriales',
      'Encuestas de satisfacción temprana'
    ]
  },
  {
    id: 'growing-customers',
    name: 'Clientes en Crecimiento',
    description: 'Clientes que muestran tendencia creciente en compras',
    criteria: {
      registrationDays: { min: 90, max: 365 },
      orderCount: { min: 3, max: 8 },
      upsellPotential: { min: 0.6 }
    },
    color: '#88D8B0',
    icon: 'trending-up',
    category: 'lifecycle',
    estimatedSize: '10-15%',
    useCase: 'Programas de desarrollo y expansión de relación',
    priority: 2,
    tags: ['crecimiento', 'desarrollo', 'oportunidad'],
    businessImpact: 'Alto - Potencial de convertirse en clientes de alto valor',
    recommendedActions: [
      'Ofertas de productos premium',
      'Programas de lealtad progresivos',
      'Recomendaciones personalizadas',
      'Invitaciones a webinars y eventos'
    ]
  },

  // Segmentos de Riesgo
  {
    id: 'at-risk-high-value',
    name: 'VIP en Riesgo Crítico',
    description: 'Clientes de alto valor que muestran signos de abandono',
    criteria: {
      lifetimeValue: { min: 3000 },
      lastOrderDays: { min: 60 },
      churnRisk: { min: 0.7 },
      satisfactionScore: { max: 3.5 }
    },
    color: '#FF6B6B',
    icon: 'alert-triangle',
    category: 'risk',
    estimatedSize: '3-7%',
    useCase: 'Campañas urgentes de retención y recuperación',
    priority: 1,
    tags: ['riesgo', 'retención', 'urgente'],
    businessImpact: 'Crítico - Pérdida potencial de ingresos significativos',
    recommendedActions: [
      'Contacto personal inmediato',
      'Ofertas especiales de retención',
      'Encuestas de satisfacción urgentes',
      'Revisión de experiencia del cliente'
    ]
  },
  {
    id: 'dormant-customers',
    name: 'Clientes Dormidos',
    description: 'Clientes inactivos con historial de compras',
    criteria: {
      lastOrderDays: { min: 180 },
      orderCount: { min: 2 },
      lifetimeValue: { min: 500 }
    },
    color: '#FFA07A',
    icon: 'clock',
    category: 'risk',
    estimatedSize: '20-25%',
    useCase: 'Campañas de reactivación y win-back',
    priority: 3,
    tags: ['inactivo', 'reactivación'],
    businessImpact: 'Medio - Oportunidad de recuperar clientes perdidos',
    recommendedActions: [
      'Campañas de "te extrañamos"',
      'Descuentos de reactivación',
      'Encuestas sobre razones de inactividad',
      'Ofertas de productos nuevos'
    ]
  },

  // Segmentos de Engagement
  {
    id: 'brand-advocates',
    name: 'Embajadores de Marca',
    description: 'Clientes altamente comprometidos y satisfechos',
    criteria: {
      satisfactionScore: { min: 4.8 },
      engagementScore: { min: 0.8 },
      loyaltyPoints: { min: 1000 },
      orderCount: { min: 5 }
    },
    color: '#9B59B6',
    icon: 'heart',
    category: 'engagement',
    estimatedSize: '5-8%',
    useCase: 'Programas de referidos y marketing de boca en boca',
    priority: 2,
    tags: ['embajador', 'lealtad', 'referidos'],
    businessImpact: 'Alto - Generan nuevos clientes a través de referidos',
    recommendedActions: [
      'Programa de referidos con incentivos',
      'Solicitar testimonios y reseñas',
      'Invitar a ser beta testers',
      'Crear contenido con sus historias'
    ]
  },
  {
    id: 'low-engagement',
    name: 'Baja Participación',
    description: 'Clientes con bajo nivel de engagement pero potencial',
    criteria: {
      engagementScore: { max: 0.3 },
      orderCount: { min: 2 },
      satisfactionScore: { min: 3.0, max: 4.0 }
    },
    color: '#F39C12',
    icon: 'battery-low',
    category: 'engagement',
    estimatedSize: '15-20%',
    useCase: 'Programas de re-engagement y activación',
    priority: 3,
    tags: ['bajo-engagement', 'activación'],
    businessImpact: 'Medio - Oportunidad de aumentar participación',
    recommendedActions: [
      'Contenido educativo personalizado',
      'Encuestas de preferencias',
      'Ofertas basadas en intereses',
      'Comunicación en canal preferido'
    ]
  },

  // Segmentos Geográficos
  {
    id: 'metropolitan-customers',
    name: 'Clientes Metropolitanos',
    description: 'Clientes en áreas metropolitanas principales',
    criteria: {
      cities: ['Asunción', 'Ciudad del Este', 'San Lorenzo', 'Luque', 'Capiatá']
    },
    color: '#3498DB',
    icon: 'map-pin',
    category: 'geographic',
    estimatedSize: '40-50%',
    useCase: 'Campañas localizadas y entrega express',
    priority: 3,
    tags: ['metropolitano', 'urbano'],
    businessImpact: 'Medio - Concentración de mercado urbano',
    recommendedActions: [
      'Ofertas de entrega el mismo día',
      'Eventos locales y pop-ups',
      'Partnerships con negocios locales',
      'Campañas geo-localizadas'
    ]
  },

  // Segmentos Demográficos
  {
    id: 'business-customers',
    name: 'Clientes Empresariales',
    description: 'Clientes que compran para uso empresarial',
    criteria: {
      customerType: ['empresa'],
      avgOrderValue: { min: 1000 },
      orderCount: { min: 3 }
    },
    color: '#2C3E50',
    icon: 'briefcase',
    category: 'demographic',
    estimatedSize: '8-12%',
    useCase: 'Soluciones B2B y facturación empresarial',
    priority: 2,
    tags: ['empresarial', 'b2b'],
    businessImpact: 'Alto - Pedidos de mayor volumen y valor',
    recommendedActions: [
      'Descuentos por volumen',
      'Términos de pago extendidos',
      'Catálogos empresariales',
      'Soporte técnico especializado'
    ]
  },

  // Segmentos Especializados
  {
    id: 'price-sensitive',
    name: 'Sensibles al Precio',
    description: 'Clientes que responden fuertemente a ofertas y descuentos',
    criteria: {
      avgOrderValue: { max: 300 },
      orderCount: { min: 3 },
      // Simulamos que compran principalmente cuando hay ofertas
      purchaseFrequency: ['medium', 'low']
    },
    color: '#E67E22',
    icon: 'tag',
    category: 'behavior',
    estimatedSize: '25-30%',
    useCase: 'Campañas de descuentos y ofertas especiales',
    priority: 3,
    tags: ['precio', 'ofertas', 'descuentos'],
    businessImpact: 'Medio - Volumen alto pero margen bajo',
    recommendedActions: [
      'Alertas de ofertas y descuentos',
      'Programas de cashback',
      'Comparativas de precios',
      'Ofertas de liquidación'
    ]
  },

  {
    id: 'mobile-first',
    name: 'Mobile-First',
    description: 'Clientes que prefieren interactuar vía móvil',
    criteria: {
      preferredContact: ['whatsapp', 'sms'],
      engagementScore: { min: 0.5 }
    },
    color: '#1ABC9C',
    icon: 'smartphone',
    category: 'behavior',
    estimatedSize: '35-45%',
    useCase: 'Experiencias optimizadas para móvil',
    priority: 2,
    tags: ['móvil', 'digital', 'whatsapp'],
    businessImpact: 'Alto - Tendencia creciente en el mercado',
    recommendedActions: [
      'Optimizar experiencia móvil',
      'Campañas vía WhatsApp Business',
      'Notificaciones push personalizadas',
      'Checkout simplificado móvil'
    ]
  }
]

// Función para obtener templates por categoría
export function getTemplatesByCategory(category: SegmentTemplate['category']): SegmentTemplate[] {
  return segmentationTemplates.filter(template => template.category === category)
}

// Función para obtener templates recomendados basados en el tamaño de la base de clientes
export function getRecommendedTemplates(customerCount: number): SegmentTemplate[] {
  if (customerCount < 100) {
    // Para bases pequeñas, enfocarse en segmentos básicos
    return segmentationTemplates.filter(t => 
      ['new-customers', 'high-value-customers', 'frequent-buyers'].includes(t.id)
    )
  } else if (customerCount < 1000) {
    // Para bases medianas, agregar segmentos de riesgo
    return segmentationTemplates.filter(t => 
      t.priority <= 2
    )
  } else {
    // Para bases grandes, usar todos los segmentos
    return segmentationTemplates.sort((a, b) => a.priority - b.priority)
  }
}

// Función para estimar el tamaño de un segmento
export function estimateSegmentSize(template: SegmentTemplate, customerCount: number): number {
  const sizeRange = template.estimatedSize.replace('%', '').split('-')
  const minPercent = parseInt(sizeRange[0])
  const maxPercent = parseInt(sizeRange[1] || sizeRange[0])
  const avgPercent = (minPercent + maxPercent) / 2
  
  return Math.round((customerCount * avgPercent) / 100)
}