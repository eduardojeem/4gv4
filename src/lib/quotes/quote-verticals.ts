/**
 * Configuración y adaptación contextual de Presupuestos según el Rubro del Negocio (Business Vertical).
 *
 * Cada rubro de negocio en 4G cuenta con:
 * - Terminología y conceptos adaptados (técnico, moda, ferretería, gastronomía, belleza, etc.).
 * - Paquetes / combos iniciales listos para presupuestar con 1 clic.
 * - Líneas rápidas de 1 clic para conceptos frecuentes (mano de obra, flete, corte, bordado, servicio).
 * - Plantillas de notas y condiciones comerciales típicas (garantías, señas, validez, flete).
 * - Período de validez sugerido según volatilidad de precios del sector.
 */

import type { BusinessVertical } from '@/lib/organization/business-profile'

export type QuoteQuickLine = {
  label: string
  description: string
  defaultPrice?: number
  iconName?: string
}

export type QuoteNotePreset = {
  title: string
  text: string
}

export type QuoteStarterPackage = {
  id: string
  title: string
  badge: string
  description: string
  lines: Array<{
    description: string
    quantity: number
    unitPrice: number
  }>
  suggestedNotes?: string
}

export type QuoteVerticalMeta = {
  vertical: BusinessVertical
  name: string
  badgeText: string
  tagline: string
  accentColor: string
  badgeColorClass: string
  defaultValidityDays: number
  quickLines: QuoteQuickLine[]
  notePresets: QuoteNotePreset[]
  starterPackages: QuoteStarterPackage[]
  whatsappIntro: string
}

export const QUOTE_VERTICALS_CONFIG: Record<BusinessVertical, QuoteVerticalMeta> = {
  electronics: {
    vertical: 'electronics',
    name: 'Tecnología & Reparaciones',
    badgeText: 'Tecnología & Taller',
    tagline: 'Equipos, repuestos certificados y mano de obra técnica garantizada',
    accentColor: 'blue',
    badgeColorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    defaultValidityDays: 5,
    starterPackages: [
      {
        id: 'tech-preventive',
        title: 'Mantenimiento Preventivo & Puesta a Punto',
        badge: 'Popular',
        description: 'Limpieza ultrasónica, cambio de pasta térmica de alto rendimiento y chequeo de estabilidad.',
        lines: [
          { description: 'Mantenimiento preventivo completo, limpieza ultrasónica y desoxido', quantity: 1, unitPrice: 120000 },
          { description: 'Reemplazo de pasta térmica de alta conductividad', quantity: 1, unitPrice: 40000 },
          { description: 'Diagnóstico técnico de componentes y pruebas de carga', quantity: 1, unitPrice: 50000 },
        ],
        suggestedNotes: '• Garantía de 90 días en mano de obra técnica.\n• No incluye repuestos dañados detectados durante el desarme.',
      },
      {
        id: 'tech-format',
        title: 'Formateo, Sistema & Utilidades',
        badge: 'Rápido',
        description: 'Instalación limpia de sistema operativo, utilitarios esenciales, respaldo y optimización.',
        lines: [
          { description: 'Instalación de sistema operativo, utilitarios y puesta a punto', quantity: 1, unitPrice: 70000 },
          { description: 'Copia de seguridad y migración de datos de usuario', quantity: 1, unitPrice: 60000 },
          { description: 'Mano de obra técnica de instalación y configuración', quantity: 1, unitPrice: 50000 },
        ],
        suggestedNotes: '• Los archivos son resguardados conforme a las carpetas estándar de usuario.',
      },
    ],
    quickLines: [
      { label: 'Mano de obra técnica', description: 'Mano de obra de diagnóstico e instalación técnica especializada', defaultPrice: 80000 },
      { label: 'Mantenimiento preventivo', description: 'Mantenimiento preventivo completo, limpieza ultrasónica y pasta térmica', defaultPrice: 120000 },
      { label: 'Diagnóstico & revisión', description: 'Revisión técnica de componentes, pruebas de carga y diagnóstico', defaultPrice: 50000 },
      { label: 'Instalación de software', description: 'Instalación de sistema operativo, utilitarios y puesta a punto', defaultPrice: 70000 },
      { label: 'Garantía extendida', description: 'Garantía extendida de servicio y repuestos (90 días adicionales)', defaultPrice: 45000 },
    ],
    notePresets: [
      {
        title: 'Garantía técnica 90 días',
        text: '• Garantía de 90 días en mano de obra y repuestos instalados.\n• La garantía no cubre daños por golpes, caídas, sobretensión eléctrica o derrame de líquidos.\n• Validez de la cotización: 5 días hábiles debido a variación en componentes importados.',
      },
      {
        title: 'Retiro y entrega de equipos',
        text: '• Los equipos no retirados dentro de los 60 días posteriores a la notificación se considerarán en abandono conforme a términos de servicio.\n• Se requiere presentar la orden de servicio o comprobante para el retiro.',
      },
      {
        title: 'Condición de pago y seña',
        text: '• Pago: 50% de seña al confirmar el presupuesto y saldo contra entrega del equipo reparado.\n• Medios de pago: Efectivo, transferencia bancaria y tarjetas.',
      },
    ],
    whatsappIntro: 'Hola {cliente}! Te paso el presupuesto técnico {numero} de {empresa} para tu equipo:',
  },

  clothing: {
    vertical: 'clothing',
    name: 'Moda & Indumentaria',
    badgeText: 'Moda & Prendas',
    tagline: 'Prendas, pedidos por curva/talles y confecciones personalizadas',
    accentColor: 'rose',
    badgeColorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    defaultValidityDays: 10,
    starterPackages: [
      {
        id: 'cloth-custom',
        title: 'Confección & Bordado Personalizado',
        badge: 'A medida',
        description: 'Confección artesanal sobre pedido con bordado matrizado y presentación para entrega.',
        lines: [
          { description: 'Confección sobre pedido con medidas personalizadas', quantity: 1, unitPrice: 90000 },
          { description: 'Personalización de prendas con bordado o estampado de alta definición', quantity: 1, unitPrice: 35000 },
          { description: 'Caja rígida de presentación exclusiva con papel seda y moño', quantity: 1, unitPrice: 15000 },
        ],
        suggestedNotes: '• Requiere seña del 50% para congelar telas e iniciar confección.\n• Plazo de entrega: 5 a 7 días hábiles.',
      },
      {
        id: 'cloth-pack6',
        title: 'Curva Mayorista Estándar (6 prendas)',
        badge: 'Mayorista',
        description: 'Pack de 6 unidades surtidas con precio preferencial y flete asegurado.',
        lines: [
          { description: 'Prendas surtidas por curva de talles seleccionados (precio por prenda)', quantity: 6, unitPrice: 48000 },
          { description: 'Envío express asegurado en puerta con seguro de prendas', quantity: 1, unitPrice: 25000 },
        ],
        suggestedNotes: '• Consultar disponibilidad de colores antes de girar la seña.',
      },
    ],
    quickLines: [
      { label: 'Bordado / Estampado', description: 'Personalización de prendas con bordado o estampado de alta definición', defaultPrice: 35000 },
      { label: 'Ajuste de sastrería', description: 'Servicio de ajuste de talle, dobladillo y entalle a medida', defaultPrice: 30000 },
      { label: 'Packaging de regalo', description: 'Caja rígida de presentación exclusiva con papel seda y moño', defaultPrice: 15000 },
      { label: 'Envío express asegurado', description: 'Entrega en puerta en 24hs con seguro de prendas', defaultPrice: 25000 },
      { label: 'Confección especial', description: 'Confección sobre pedido con medidas personalizadas', defaultPrice: 90000 },
    ],
    notePresets: [
      {
        title: 'Condiciones de reserva y confección',
        text: '• Para pedidos especiales o prendas por encargo se requiere una seña del 50% para congelar stock y fecha de confección.\n• Cambios disponibles dentro de los 15 días con etiqueta original y ticket de compra.',
      },
      {
        title: 'Descuento por volumen',
        text: '• Precios mayoristas aplicables a partir de 6 prendas surtidas de la misma colección.\n• Consultá disponibilidad de curva de talles y colores antes de confirmar.',
      },
      {
        title: 'Envíos y entregas',
        text: '• Envíos a todo el país vía encomienda o delivery express.\n• Plazo de entrega estimado: 48 a 72 horas hábiles tras confirmación del pago.',
      },
    ],
    whatsappIntro: 'Hola {cliente}! Te comparto la cotización de prendas {numero} de {empresa}:',
  },

  hardware: {
    vertical: 'hardware',
    name: 'Ferretería & Construcción',
    badgeText: 'Ferretería & Obra',
    tagline: 'Materiales, herramientas, cálculo por volumen y entrega en obra',
    accentColor: 'amber',
    badgeColorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    defaultValidityDays: 3,
    starterPackages: [
      {
        id: 'hard-freight',
        title: 'Entrega en Obra con Descarga',
        badge: 'Logística',
        description: 'Servicio de transporte con camión y estiba a pie de obra.',
        lines: [
          { description: 'Flete de materiales con entrega directa en obra', quantity: 1, unitPrice: 150000 },
          { description: 'Servicio de descarga y acopio en pie de obra', quantity: 1, unitPrice: 70000 },
          { description: 'Palletizado plástico reforzado para transporte de materiales', quantity: 1, unitPrice: 40000 },
        ],
        suggestedNotes: '• Descarga a pie de camión. Sujeto a transitabilidad de la calle en días de lluvia.\n• Cotización válida por 72hs.',
      },
      {
        id: 'hard-cutting',
        title: 'Corte y Preparación de Materiales',
        badge: 'Taller',
        description: 'Corte a medida y preparación lista para colocación inmediata.',
        lines: [
          { description: 'Corte fraccionado de perfiles, caños, varillas o maderas', quantity: 1, unitPrice: 35000 },
          { description: 'Servicio técnico de colocación y fijación en obra', quantity: 1, unitPrice: 160000 },
        ],
        suggestedNotes: '• Los cortes a medida no admiten devolución.',
      },
    ],
    quickLines: [
      { label: 'Flete y descarga en obra', description: 'Flete con camión grúa y descarga a pie de obra', defaultPrice: 150000 },
      { label: 'Corte a medida', description: 'Corte fraccionado de perfiles, caños, varillas o maderas', defaultPrice: 25000 },
      { label: 'Colocación / Instalación', description: 'Servicio técnico de colocación y fijación en obra', defaultPrice: 180000 },
      { label: 'Embalaje palletizado', description: 'Palletizado plástico reforzado para transporte de materiales', defaultPrice: 40000 },
      { label: 'Asesoramiento técnico en obra', description: 'Cálculo de cómputo métrico y visita técnica en obra', defaultPrice: 100000 },
    ],
    notePresets: [
      {
        title: 'Validez y stock en corralón',
        text: '• Precios sujetos a variación y stock disponible en corralón.\n• Cotización válida por 72 horas hábiles a partir de la fecha de emisión.\n• No se reservan materiales sin confirmación de anticipo.',
      },
      {
        title: 'Condiciones de entrega en obra',
        text: '• Entrega a pie de camión en obra. La descarga está sujeta a accesibilidad del terreno y tránsito habilitado.\n• En caso de caminos de tierra o lluvia intensa, se reprogramará la entrega.',
      },
      {
        title: 'Forma de pago de materiales',
        text: '• Pago: 50% de anticipo al confirmar pedido y saldo contra entrega previa descarga.\n• Aceptamos cheques al día, transferencias bancarias y tarjetas corporativas.',
      },
    ],
    whatsappIntro: 'Estimado/a {cliente}: Le envío el presupuesto de materiales {numero} de {empresa}:',
  },

  food: {
    vertical: 'food',
    name: 'Alimentos & Gastronomía',
    badgeText: 'Gastronomía & Catering',
    tagline: 'Menús, eventos, combos gastronómicos y cálculo por comensal',
    accentColor: 'emerald',
    badgeColorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    defaultValidityDays: 4,
    starterPackages: [
      {
        id: 'food-catering10',
        title: 'Catering Integral para Eventos (10 personas)',
        badge: 'Eventos',
        description: 'Propuesta completa con menú gourmet, vajilla fina y atención durante el evento.',
        lines: [
          { description: 'Menú gastronómico completo por comensal con entrada y plato principal', quantity: 10, unitPrice: 75000 },
          { description: 'Personal de atención y servicio durante evento (jornada 4hs)', quantity: 1, unitPrice: 200000 },
          { description: 'Juego de vajilla completa, copas y mantelería fina por comensal', quantity: 10, unitPrice: 20000 },
          { description: 'Traslado con cadena de frío garantizada hasta el lugar del evento', quantity: 1, unitPrice: 80000 },
        ],
        suggestedNotes: '• Reserva con 50% de seña. Confirmación final de comensales 72hs antes.',
      },
      {
        id: 'food-coffeebreak',
        title: 'Coffee Break Corporativo (15 personas)',
        badge: 'Empresas',
        description: 'Variedad de bocados salados y dulces con estación de café y jugos.',
        lines: [
          { description: 'Coffee break completo con opciones saladas, dulces y cafetería', quantity: 15, unitPrice: 38000 },
          { description: 'Flete refrigerado y montaje previo en sala', quantity: 1, unitPrice: 70000 },
        ],
        suggestedNotes: '• Incluye montaje 30 minutos antes del inicio del evento.',
      },
    ],
    quickLines: [
      { label: 'Servicio de mozos y atención', description: 'Personal de atención y servicio durante evento (jornada 4hs)', defaultPrice: 200000 },
      { label: 'Alquiler de vajilla y mantelería', description: 'Juego de vajilla completa, copas y mantelería fina por comensal', defaultPrice: 35000 },
      { label: 'Flete refrigerado', description: 'Traslado con cadena de frío garantizada hasta el lugar del evento', defaultPrice: 80000 },
      { label: 'Opción vegetariana / celíaca', description: 'Menú especial adaptado con preparación en cocina aislada', defaultPrice: 45000 },
      { label: 'Mesa de postres & café', description: 'Isla de postres artesanales, café espresso y petit fours', defaultPrice: 120000 },
    ],
    notePresets: [
      {
        title: 'Reserva de fecha y confirmación',
        text: '• Reserva de fecha con el 50% de seña. El saldo restante debe cancelarse 48 horas antes del evento.\n• Confirmación definitiva de comensales hasta 4 días hábiles antes de la fecha.',
      },
      {
        title: 'Condiciones de servicio',
        text: '• El servicio incluye traslado, mise en place y personal con uniforme reglamentario.\n• Tiempo de permanencia estándar: 4 horas a partir del horario pactado.',
      },
      {
        title: 'Conservación y calidad',
        text: '• Todos nuestros alimentos son elaborados con insumos de primera calidad bajo estrictas normas de bromatología.\n• Transporte con cadena de frío monitoreada.',
      },
    ],
    whatsappIntro: 'Hola {cliente}! Te acercamos la propuesta gastronómica {numero} de {empresa}:',
  },

  cosmetics: {
    vertical: 'cosmetics',
    name: 'Cosmética & Belleza',
    badgeText: 'Belleza & Estética',
    tagline: 'Tratamientos, kits para el cuidado de la piel y asesoría personalizada',
    accentColor: 'purple',
    badgeColorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    defaultValidityDays: 7,
    starterPackages: [
      {
        id: 'cosm-treatment',
        title: 'Ritual Facial & Asesoramiento',
        badge: 'Cuidado',
        description: 'Diagnóstico de biotipo cutáneo, sesión en gabinete y kit de apoyo domiciliario.',
        lines: [
          { description: 'Diagnóstico de piel y asesoría personalizada de rutina facial', quantity: 1, unitPrice: 60000 },
          { description: 'Aplicación en gabinete de tratamiento regenerador y mascarilla', quantity: 1, unitPrice: 110000 },
          { description: 'Kit de cuidado en casa para potenciar resultados', quantity: 1, unitPrice: 130000 },
        ],
        suggestedNotes: '• Citas con reserva previa y tolerancia de 15 minutos.\n• Productos hipoalergénicos certificados.',
      },
      {
        id: 'cosm-gift',
        title: 'Cofre de Regalo Exclusivo',
        badge: 'Regalo',
        description: 'Set de productos premium en caja rígida con fragancia y tarjeta.',
        lines: [
          { description: 'Kit de cuidado facial y corporal de alta gama', quantity: 1, unitPrice: 180000 },
          { description: 'Cofre rígido de regalo con lazo de satén y dedicatoria', quantity: 1, unitPrice: 20000 },
          { description: 'Envío delicado con fragancia corporativa', quantity: 1, unitPrice: 25000 },
        ],
        suggestedNotes: '• Presentación lista para obsequiar.',
      },
    ],
    quickLines: [
      { label: 'Sesión de asesoramiento', description: 'Diagnóstico de piel y asesoría personalizada de rutina facial', defaultPrice: 60000 },
      { label: 'Aplicación profesional', description: 'Aplicación en gabinete de tratamiento regenerador y mascarilla', defaultPrice: 110000 },
      { label: 'Kit de cuidado en casa', description: 'Kit de mantenimiento domiciliario para potenciar resultados', defaultPrice: 150000 },
      { label: 'Presentación de regalo premium', description: 'Cofre rígido de regalo con lazo de satén y dedicatoria', defaultPrice: 20000 },
      { label: 'Envío delicado a domicilio', description: 'Entrega con protección térmica y fragancia de la marca', defaultPrice: 25000 },
    ],
    notePresets: [
      {
        title: 'Turnos y reservas',
        text: '• Las citas se reservan con tolerancia de 15 minutos.\n• Cancelaciones o reprogramaciones con un mínimo de 24 horas de antelación.',
      },
      {
        title: 'Garantía de productos',
        text: '• Productos 100% originales, hipoalergénicos y dermatológicamente testeados.\n• Sin crueldad animal (cruelty free).',
      },
      {
        title: 'Recomendaciones de uso',
        text: '• Para obtener los máximos beneficios, se recomienda seguir la rutina indicada en la ficha de tratamiento.',
      },
    ],
    whatsappIntro: 'Hola {cliente}! Te comparto el presupuesto de cuidado personal {numero} de {empresa}:',
  },

  barbershop: {
    vertical: 'barbershop',
    name: 'Barbería & Estilo',
    badgeText: 'Barbería & Salón',
    tagline: 'Cortes, perfilados, combos de barbería y paquetes especiales',
    accentColor: 'slate',
    badgeColorClass: 'bg-slate-700/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
    defaultValidityDays: 7,
    starterPackages: [
      {
        id: 'barber-groom',
        title: 'Combo Ritual Clásico (Corte + Barba + Masaje)',
        badge: 'Más pedido',
        description: 'Servicio completo de corte personalizado, barba con toalla caliente y tratamiento capilar.',
        lines: [
          { description: 'Corte de autor con diseño y peinado', quantity: 1, unitPrice: 50000 },
          { description: 'Ritual de barba con toalla caliente, aceites esenciales y navaja', quantity: 1, unitPrice: 45000 },
          { description: 'Lavado exfoliante, masaje capilar y ampolla revitalizante', quantity: 1, unitPrice: 45000 },
        ],
        suggestedNotes: '• Duración estimada del servicio: 60 minutos.\n• Agendamiento previo vía WhatsApp.',
      },
      {
        id: 'barber-special',
        title: 'Pack Especial Novio / Graduado',
        badge: 'Exclusivo',
        description: 'Atención personalizada para eventos importantes con peinado y fijación.',
        lines: [
          { description: 'Corte de autor, ritual de barba, limpieza facial y peinado', quantity: 1, unitPrice: 150000 },
          { description: 'Pomada o cera mate profesional de larga fijación', quantity: 1, unitPrice: 65000 },
        ],
        suggestedNotes: '• Incluye café y bebida de cortesía en el salón.',
      },
    ],
    quickLines: [
      { label: 'Perfilado & Toalla caliente', description: 'Ritual de barba con toalla caliente, aceites esenciales y navaja', defaultPrice: 45000 },
      { label: 'Tratamiento capilar', description: 'Lavado exfoliante, masaje capilar y ampolla revitalizante', defaultPrice: 55000 },
      { label: 'Pack Novio / Especial', description: 'Corte de autor, ritual de barba, limpieza facial y peinado', defaultPrice: 160000 },
      { label: 'Pomada / Cera de peinado', description: 'Producto de fijación mate profesional de larga duración', defaultPrice: 65000 },
      { label: 'Coloración / Camuflaje de canas', description: 'Tonalización sutil de canas en barba y cabello', defaultPrice: 70000 },
    ],
    notePresets: [
      {
        title: 'Horarios y agendamiento',
        text: '• Los turnos se confirman por WhatsApp con 2 horas de anticipación.\n• Tolerancia máxima de espera: 10 minutos para garantizar el tiempo de cada cliente.',
      },
      {
        title: 'Paquetes de novio y grupos',
        text: '• Para paquetes de novio y comitivas se requiere una seña del 50% para reserva exclusiva del salón.',
      },
    ],
    whatsappIntro: 'Hola {cliente}! Te paso la cotización de servicios {numero} de {empresa}:',
  },

  general: {
    vertical: 'general',
    name: 'Comercio General',
    badgeText: 'Comercial & Servicios',
    tagline: 'Venta de productos, servicios comerciales y cotizaciones a medida',
    accentColor: 'indigo',
    badgeColorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    defaultValidityDays: 7,
    starterPackages: [
      {
        id: 'gen-fullservice',
        title: 'Combo Integral (Producto + Flete + Armado)',
        badge: 'Completo',
        description: 'Servicio de entrega puerta a puerta, desembalaje y montaje profesional.',
        lines: [
          { description: 'Servicio de montaje, colocación y puesta en marcha', quantity: 1, unitPrice: 90000 },
          { description: 'Entrega a domicilio con seguro de transporte', quantity: 1, unitPrice: 35000 },
          { description: 'Embalaje de seguridad para envíos de alta protección', quantity: 1, unitPrice: 15000 },
        ],
        suggestedNotes: '• Entrega dentro de las 24/48 horas hábiles tras la confirmación.',
      },
      {
        id: 'gen-warranty',
        title: 'Garantía Extendida & Mantenimiento',
        badge: 'Tranquilidad',
        description: 'Cobertura ampliada de respaldo técnico de fábrica.',
        lines: [
          { description: 'Garantía extendida de fábrica por 6 meses adicionales', quantity: 1, unitPrice: 55000 },
          { description: 'Atención técnica y asesoramiento profesional prioritario', quantity: 1, unitPrice: 45000 },
        ],
        suggestedNotes: '• Incluye asistencia remota y cobertura de fallas de fábrica.',
      },
    ],
    quickLines: [
      { label: 'Servicio de entrega / Flete', description: 'Entrega a domicilio con seguro de transporte', defaultPrice: 30000 },
      { label: 'Mano de obra / Instalación', description: 'Servicio de montaje, colocación y puesta en marcha', defaultPrice: 90000 },
      { label: 'Embalaje y protección', description: 'Embalaje de seguridad para envíos al interior', defaultPrice: 15000 },
      { label: 'Servicio técnico especializado', description: 'Atención técnica y asesoramiento profesional', defaultPrice: 80000 },
      { label: 'Extensión de garantía', description: 'Garantía extendida de fábrica por 6 meses adicionales', defaultPrice: 50000 },
    ],
    notePresets: [
      {
        title: 'Términos de validez y stock',
        text: '• Precios sujetos a disponibilidad de stock al momento de la confirmación.\n• Presupuesto válido por 7 días hábiles a partir de la fecha de emisión.',
      },
      {
        title: 'Medios de pago disponibles',
        text: '• Medios de pago: Transferencia bancaria, tarjeta de débito/crédito y efectivo.\n• En caso de transferencia, enviar comprobante para agilizar el despacho.',
      },
      {
        title: 'Plazos de entrega',
        text: '• Productos en stock: Entrega inmediata o en 24 horas hábiles.\n• Pedidos especiales o por encargo: 3 a 5 días hábiles.',
      },
    ],
    whatsappIntro: 'Hola {cliente}! Te comparto el presupuesto {numero} de {empresa}:',
  },

  other: {
    vertical: 'other',
    name: 'Servicios Profesionales',
    badgeText: 'Servicios & Venta',
    tagline: 'Presupuestos y cotizaciones adaptados a tu actividad comercial',
    accentColor: 'indigo',
    badgeColorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    defaultValidityDays: 7,
    starterPackages: [
      {
        id: 'other-consulting',
        title: 'Propuesta de Consultoría & Informe Final',
        badge: 'Profesional',
        description: 'Honorarios por desarrollo de proyecto, relevamiento, informe y soporte.',
        lines: [
          { description: 'Honorarios profesionales y servicio de asesoramiento especializado', quantity: 1, unitPrice: 280000 },
          { description: 'Preparación de informes, entrega final y certificación', quantity: 1, unitPrice: 80000 },
          { description: 'Mesa de ayuda y seguimiento post-entrega (30 días)', quantity: 1, unitPrice: 60000 },
        ],
        suggestedNotes: '• 50% de anticipo al inicio y 50% contra entrega de la documentación final.',
      },
      {
        id: 'other-operational',
        title: 'Servicio Operativo & Soporte en Terreno',
        badge: 'En Terreno',
        description: 'Jornada técnica con viáticos y logística de materiales incluida.',
        lines: [
          { description: 'Servicio profesional y asesoramiento especializado en terreno', quantity: 1, unitPrice: 180000 },
          { description: 'Traslado, viáticos y materiales de soporte operativo', quantity: 1, unitPrice: 50000 },
        ],
        suggestedNotes: '• Plazo de ejecución coordinado en cronograma.',
      },
    ],
    quickLines: [
      { label: 'Honorarios profesionales', description: 'Servicio profesional y asesoramiento especializado', defaultPrice: 120000 },
      { label: 'Gastos operativos y logística', description: 'Traslado, viáticos y materiales de soporte', defaultPrice: 40000 },
      { label: 'Entrega y documentación', description: 'Preparación de informes, entrega final y certificación', defaultPrice: 60000 },
      { label: 'Soporte y seguimiento', description: 'Mesa de ayuda y seguimiento post-entrega (30 días)', defaultPrice: 50000 },
    ],
    notePresets: [
      {
        title: 'Condiciones de contratación',
        text: '• Presupuesto válido por 7 días corridos.\n• 50% de anticipo al inicio y saldo contra entrega del trabajo o mercadería.',
      },
      {
        title: 'Formas de pago',
        text: '• Aceptamos transferencias bancarias, cheques y medios electrónicos de pago.',
      },
    ],
    whatsappIntro: 'Hola {cliente}! Te envío el presupuesto {numero} de {empresa}:',
  },
}

/**
 * Obtiene la configuración de presupuestos para el rubro especificado con fallback a 'general'.
 */
export function getQuoteVerticalConfig(vertical?: string | null): QuoteVerticalMeta {
  if (vertical && vertical in QUOTE_VERTICALS_CONFIG) {
    return QUOTE_VERTICALS_CONFIG[vertical as BusinessVertical]
  }
  return QUOTE_VERTICALS_CONFIG.general
}
