import { normalizeText } from '@/lib/text/normalize'
import type { GuideSection } from './types'

export interface AssistantAnswer {
  query: string
  title: string
  directAnswer: string
  steps: string[]
  actionHref?: string
  actionLabel?: string
  sectionId?: string
  sectionTitle?: string
  proTip?: string
  caution?: string
}

export interface AssistantPresetTopic {
  id: string
  category: 'inicio' | 'ventas' | 'taller' | 'stock' | 'cierre' | 'equipo'
  categoryLabel: string
  icon: string
  question: string
  keywords: string[]
  answer: AssistantAnswer
}

/** Base de conocimiento contextual de intenciones frecuentes para el asistente */
export const ASSISTANT_PRESETS: AssistantPresetTopic[] = [
  {
    id: 'abrir-caja',
    category: 'inicio',
    categoryLabel: 'Apertura de local',
    icon: 'Sunrise',
    question: '¿Cómo abro la caja al iniciar la jornada?',
    keywords: ['abrir', 'apertura', 'caja', 'saldo inicial', 'efectivo', 'empezar dia', 'fondo'],
    answer: {
      query: '¿Cómo abro la caja al iniciar la jornada?',
      title: 'Apertura de Caja Diaria',
      directAnswer: 'La caja se abre al iniciar el turno ingresando el fondo de cambio físico con el que arranca el local.',
      steps: [
        'Ingresá a Punto de Venta > Caja (/dashboard/pos/caja).',
        'Si la caja está cerrada, hacé clic en «Abrir caja».',
        'Ingresá el monto de cambio inicial en efectivo y seleccioná tu turno de trabajo.',
        'Confirmá la apertura. A partir de ese momento, todas las ventas en efectivo sumarán a este turno.',
      ],
      actionHref: '/dashboard/pos/caja',
      actionLabel: 'Ir a Caja',
      sectionId: 'caja',
      sectionTitle: 'Cajas y Arqueos Diarios',
      proTip: 'Contá bien el cambio antes de abrir: el sistema calculará las diferencias al cerrar comparando este monto con tus ventas.',
    },
  },
  {
    id: 'crear-presupuesto',
    category: 'ventas',
    categoryLabel: 'Ventas y Clientes',
    icon: 'FileText',
    question: '¿Cómo armo un presupuesto y lo paso a venta?',
    keywords: ['presupuesto', 'cotizacion', 'cotizar', 'whatsapp', 'facturar presupuesto', 'convertir a venta'],
    answer: {
      query: '¿Cómo armo un presupuesto y lo paso a venta?',
      title: 'Presupuestos y Facturación en 1 Clic',
      directAnswer: 'Podés armar presupuestos con productos de tu stock o mano de obra libre, enviarlos por WhatsApp y facturarlos en el POS con 1 solo clic cuando el cliente acepte.',
      steps: [
        'Entrá en Presupuestos (/dashboard/quotes) y pulsá «Nuevo presupuesto».',
        'Paso 1 (Azul): Buscá el cliente o cargalo rápidamente.',
        'Paso 2 (Índigo): Agregá repuestos/productos de tu catálogo o escribí conceptos libres (ej. «Mano de obra especializada»).',
        'Paso 3 (Ámbar): Definí la validez comercial (ej. 7 o 15 días) y forma de pago.',
        'Guardá y hacé clic en «Compartir por WhatsApp» para enviarle el resumen profesional con enlace o PDF.',
        'Cuando el cliente apruebe, presioná «Facturar en POS»: todos los ítems pasarán al carrito listos para cobrar.',
      ],
      actionHref: '/dashboard/quotes',
      actionLabel: 'Ir a Presupuestos',
      sectionId: 'quotes',
      sectionTitle: 'Presupuestos y Cotizaciones',
      proTip: 'Los presupuestos respetan la reserva de precios hasta la fecha de validez configurada sin alterar el stock hasta su venta.',
    },
  },
  {
    id: 'cerrar-caja',
    category: 'cierre',
    categoryLabel: 'Cierre del día',
    icon: 'Sunset',
    question: '¿Cómo hago el arqueo y cierre de caja?',
    keywords: ['cerrar caja', 'cierre', 'arqueo', 'contar billetes', 'sobrante', 'faltante', 'diferencia'],
    answer: {
      query: '¿Cómo hago el arqueo y cierre de caja?',
      title: 'Arqueo Físico y Cierre de Caja',
      directAnswer: 'El cierre de caja compara el dinero real contado en el cajón con los registros teóricos del sistema.',
      steps: [
        'En Punto de Venta > Caja, seleccioná «Cerrar caja».',
        'El sistema solicitará el conteo a ciegas: ingresá la cantidad de billetes y monedas que tenés físicamente en el cajón.',
        'El sistema contrastará el dinero contado contra: Fondo inicial + Ventas en efectivo + Entradas de efectivo - Salidas/Gastos.',
        'Si hay diferencia (sobrante o faltante), colocá una breve observación explicativa y confirmá el cierre.',
        'Se generará un ticket de cierre con el balance total y las alertas registradas en el Monitor de Cajas del Administrador.',
      ],
      actionHref: '/dashboard/pos/caja',
      actionLabel: 'Ir a Caja',
      sectionId: 'caja',
      sectionTitle: 'Cajas y Arqueos Diarios',
      caution: 'No cierres la caja sin haber registrado antes los retiros de efectivo o gastos de caja chica del día.',
    },
  },
  {
    id: 'orden-reparacion',
    category: 'taller',
    categoryLabel: 'Taller y Servicios',
    icon: 'Wrench',
    question: '¿Cómo recibo un equipo para reparación?',
    keywords: ['reparacion', 'taller', 'orden de servicio', 'recibir equipo', 'patron', 'falla', 'tecnico'],
    answer: {
      query: '¿Cómo recibo un equipo para reparación?',
      title: 'Recepción y Órdenes de Servicio Técnico',
      directAnswer: 'Al recibir un equipo registrás la marca, modelo, número de serie/IMEI, patrón de desbloqueo y la falla declarada por el cliente.',
      steps: [
        'Ingresá a Reparaciones (/dashboard/repairs) y tocá «Nueva orden».',
        'Asigná el cliente o crealo al momento con su número de WhatsApp.',
        'Seleccioná la marca y modelo del equipo (el catálogo inteligente sugiere variantes automáticamente).',
        'Detallá la falla, contraseña o patrón gráfico y observaciones de estado estético (rayas, golpes previos).',
        'Si dejó una seña o anticipo de dinero, marcalo para que ingrese automáticamente a tu caja del día.',
        'Al guardar, imprimí el comprobante con código de barras y enviá el aviso automático al WhatsApp del cliente.',
      ],
      actionHref: '/dashboard/repairs',
      actionLabel: 'Ir a Reparaciones',
      sectionId: 'repairs',
      sectionTitle: 'Reparaciones y Servicio Técnico',
      proTip: 'El cliente podrá consultar el estado en tiempo real de su equipo desde el enlace público sin tener que llamar al local.',
    },
  },
  {
    id: 'toma-inventario',
    category: 'stock',
    categoryLabel: 'Inventario y Stock',
    icon: 'ScanBarcode',
    question: '¿Cómo hago un recuento físico de inventario para ajustar stock?',
    keywords: ['inventario', 'toma de inventario', 'conteo', 'auditoria', 'recuento', 'escanear stock', 'ajuste'],
    answer: {
      query: '¿Cómo hago un recuento físico de inventario para ajustar stock?',
      title: 'Toma de Inventario y Auditoría Física',
      directAnswer: 'La toma de inventario permite contrastar las existencias reales en góndola o depósito frente al stock teórico y ajustar diferencias.',
      steps: [
        'Andá a Inventario > Toma de inventario (/dashboard/inventory-count).',
        'Hacé clic en «Nueva toma de inventario» y elegí si querés contar una categoría particular o todo el catálogo.',
        'Conectá tu lector de código de barras o buscá manualmente los artículos mientras contás las unidades en estantería.',
        'El sistema mostrará una tabla con el stock teórico, el stock contado y la diferencia (sobrante en verde, faltante en rojo).',
        'Al terminar la auditoría, hacé clic en «Aplicar ajuste de stock»: el catálogo se actualizará con el valor real y quedará el registro de auditoría.',
      ],
      actionHref: '/dashboard/inventory-count',
      actionLabel: 'Ir a Toma de Inventario',
      sectionId: 'inventory-count',
      sectionTitle: 'Toma de Inventario y Auditoría Física',
      proTip: 'Hacé tomas periódicas por categoría (ej. accesorios los lunes, repuestos los miércoles) en lugar de frenar todo el local.',
    },
  },
  {
    id: 'invitar-usuarios',
    category: 'equipo',
    categoryLabel: 'Equipo y Roles',
    icon: 'Users',
    question: '¿Cómo agrego un vendedor o técnico a mi equipo?',
    keywords: ['usuario', 'invitar', 'crear usuario', 'vendedor', 'tecnico', 'empleado', 'permisos'],
    answer: {
      query: '¿Cómo agrego un vendedor o técnico a mi equipo?',
      title: 'Gestión de Usuarios y Roles de Equipo',
      directAnswer: 'Podés invitar miembros a tu equipo con roles específicos (Vendedor, Técnico, Administrador) y configurar permisos individuales.',
      steps: [
        'Entrá a Administración > Usuarios (/admin/users).',
        'Pulsá en «Nuevo usuario» e ingresá su nombre y correo electrónico.',
        'Elegí el rol base: «Vendedor» para el mostrador y POS, «Técnico» para reparaciones o «Administrador» para control total.',
        'Configurá los casilleros de permisos según su nivel de confianza: podés habilitar o deshabilitar ver costos, aplicar descuentos o ver reportes.',
        'Guardá el usuario. Podrá iniciar sesión con su correo de inmediato.',
      ],
      actionHref: '/admin/users',
      actionLabel: 'Ir a Usuarios',
      sectionId: 'users',
      sectionTitle: 'Usuarios y Equipo',
      caution: 'Nunca borres un usuario que dejó de trabajar en el local: pasalo a estado «Inactivo» para que no pueda ingresar pero se conserve todo su historial de ventas.',
    },
  },
  {
    id: 'transferir-propiedad',
    category: 'equipo',
    categoryLabel: 'Equipo y Roles',
    icon: 'ShieldCheck',
    question: '¿Cómo transfiero la propiedad de la cuenta a otra persona?',
    keywords: ['transferir propiedad', 'propietario', 'dueno', 'ceder cuenta', 'cambiar dueno'],
    answer: {
      query: '¿Cómo transfiero la propiedad de la cuenta a otra persona?',
      title: 'Transferencia Segura de Propiedad',
      directAnswer: 'La cuenta solo puede tener un único Propietario. La propiedad no se cambia editando el rol, sino mediante un proceso formal de transferencia.',
      steps: [
        'En Administración > Usuarios (/admin/users), asegurate de que la persona a la que le transferirás la cuenta ya exista como usuario activo.',
        'Hacé clic en los tres puntos del usuario receptor y elegí «Transferir propiedad».',
        'El sistema solicitará una confirmación explícita con tu clave actual de Propietario.',
        'Una vez confirmada, esa persona pasará a ser el nuevo Propietario y vos pasarás automáticamente a Administrador.',
      ],
      actionHref: '/admin/users',
      actionLabel: 'Ir a Usuarios',
      sectionId: 'roles',
      sectionTitle: 'Roles y Permisos',
      caution: 'Esta acción es irreversible por vos mismo; solo el nuevo propietario podrá volver a transferir la cuenta.',
    },
  },
  {
    id: 'configurar-agenda',
    category: 'inicio',
    categoryLabel: 'Apertura de local',
    icon: 'CalendarClock',
    question: '¿Cómo configuro la agenda de turnos y profesionales?',
    keywords: ['agenda', 'turnos', 'profesionales', 'citas', 'horarios', 'barberia', 'peluqueria', 'servicio tecnico'],
    answer: {
      query: '¿Cómo configuro la agenda de turnos y profesionales?',
      title: 'Configuración de Agenda y Turnos Online',
      directAnswer: 'Permite que tus clientes reserven citas por la web o que registres turnos asignados a cada profesional de tu equipo.',
      steps: [
        'Andá a Agenda > Configuración (/dashboard/agenda/configuracion).',
        'Creá tus profesionales o especialistas indicando su nombre, especialidad y su horario semanal de atención.',
        'Asociá los servicios que realiza cada uno desde el catálogo de Productos (marcando la casilla «Es un servicio con turnos» y su duración en minutos).',
        'En tu tienda pública se habilitará automáticamente la pestaña «Reservar turno» donde los clientes elegirán fecha, hora y profesional sin superposiciones.',
      ],
      actionHref: '/dashboard/agenda/configuracion',
      actionLabel: 'Ir a Configuración de Agenda',
      sectionId: 'agenda',
      sectionTitle: 'Agenda y Reservas de Turnos',
      proTip: 'Podés bloquear franjas de almuerzo o descansos para que no figuren disponibles en la reserva online.',
    },
  },
  {
    id: 'garantia-posventa',
    category: 'ventas',
    categoryLabel: 'Ventas y Clientes',
    icon: 'RotateCcw',
    question: '¿Cómo gestiono una garantía o cambio en posventa?',
    keywords: ['garantia', 'cambio', 'devolucion', 'falla de fabrica', 'nota de credito', 'posventa', 'rma'],
    answer: {
      query: '¿Cómo gestiono una garantía o cambio en posventa?',
      title: 'Garantías, Cambios y Devoluciones',
      directAnswer: 'Gestioná reclamos de clientes localizando la venta por teléfono o comprobante para validar la vigencia de garantía y procesar el reemplazo.',
      steps: [
        'Entrá a Posventa (/dashboard/after-sales).',
        'Buscá la compra original ingresando el número de ticket o el WhatsApp del cliente.',
        'Verificá el plazo de garantía y seleccioná el motivo del reclamo (falla de fábrica, rotura o cambio de modelo).',
        'Elegí la resolución: cambio directo por producto idéntico, emisión de nota de crédito o derivación al servicio técnico.',
        'El stock defectuoso se separará automáticamente del inventario disponible para evitar que vuelva a venderse.',
      ],
      actionHref: '/dashboard/after-sales',
      actionLabel: 'Ir a Posventa',
      sectionId: 'after-sales',
      sectionTitle: 'Posventa y Garantías',
      proTip: 'Si el cliente elige un producto de mayor valor, podés pasar la diferencia al Punto de Venta para cobrar el saldo restante.',
    },
  },
  {
    id: 'control-vencimientos',
    category: 'stock',
    categoryLabel: 'Inventario y Stock',
    icon: 'CalendarX2',
    question: '¿Cómo controlo los productos por vencer para no perder stock?',
    keywords: ['vencimiento', 'vencimientos', 'caducidad', 'lote', 'perecedero', 'merma', 'por vencer'],
    answer: {
      query: '¿Cómo controlo los productos por vencer para no perder stock?',
      title: 'Tablero de Control de Vencimientos',
      directAnswer: 'Monitoreá los lotes según su fecha de expiración para activar promociones de liquidación preventiva.',
      steps: [
        'Ingresá a Vencimientos (/dashboard/vencimientos).',
        'Revisá las tres columnas de alerta: productos vencidos, por vencer en los próximos 15 a 30 días, y en rango seguro.',
        'Para los artículos próximos a caducar, creá un combo o descuento temporal desde Promociones (/dashboard/promotions).',
        'Si un lote ya está vencido, registralo como baja por merma para ajustar el stock contable.',
      ],
      actionHref: '/dashboard/vencimientos',
      actionLabel: 'Ir a Vencimientos',
      sectionId: 'vencimientos',
      sectionTitle: 'Control de Vencimientos y Lotes',
      proTip: 'Cargá siempre el número de lote y fecha de vencimiento al ingresar facturas de proveedores para contar con alertas tempranas.',
    },
  },
  {
    id: 'panel-tecnico',
    category: 'taller',
    categoryLabel: 'Taller y Servicios',
    icon: 'ClipboardCheck',
    question: '¿Cómo trabaja el técnico desde su panel de taller?',
    keywords: ['tecnico', 'panel tecnico', 'banco de trabajo', 'reparacion rapida', 'checklist taller'],
    answer: {
      query: '¿Cómo trabaja el técnico desde su panel de taller?',
      title: 'Panel Especializado del Técnico',
      directAnswer: 'Una vista optimizada para la mesa de trabajo donde el técnico ve solo sus órdenes asignadas, carga repuestos y valida el checklist de calidad.',
      steps: [
        'El técnico inicia sesión y accede directamente a /dashboard/technician.',
        'Selecciona el equipo asignado y revisa los datos de ingreso, falla y patrón de desbloqueo.',
        'Agrega los repuestos necesarios del catálogo y cambia el estado a «En Reparación».',
        'Al finalizar, completa el checklist de control (cámara, audio, carga, pantalla) y pulsa «Listo para Entrega».',
        'El sistema notifica automáticamente al cliente vía WhatsApp para coordinar el retiro.',
      ],
      actionHref: '/dashboard/technician',
      actionLabel: 'Ir a Panel Técnico',
      sectionId: 'technician',
      sectionTitle: 'Panel del Técnico de Taller',
      proTip: 'Esta pantalla está diseñada para utilizarse con pantalla táctil o tablet en el banco de trabajo sin distracciones comerciales.',
    },
  },
]

/**
 * Resuelve una consulta del usuario buscando primero en las respuestas pre-entrenadas
 * y, como fallback, buscando en los pasos y FAQs de las secciones de la guía.
 */
export function resolveAssistantQuery(
  rawQuery: string,
  availableSections: GuideSection[],
): AssistantAnswer | null {
  const query = normalizeText(rawQuery).trim()
  if (!query || query.length < 2) return null

  const queryWords = query.split(/\s+/).filter((w) => w.length > 1)

  // 1. Evaluar coincidencias con presets
  let bestPreset: AssistantPresetTopic | null = null
  let bestPresetScore = 0

  for (const preset of ASSISTANT_PRESETS) {
    let score = 0
    const qNorm = normalizeText(preset.question)

    if (qNorm.includes(query) || query.includes(qNorm)) score += 50

    for (const kw of preset.keywords) {
      const kwNorm = normalizeText(kw)
      if (query.includes(kwNorm)) score += 20
    }

    for (const word of queryWords) {
      if (preset.keywords.some((k) => normalizeText(k).includes(word))) score += 8
      if (qNorm.includes(word)) score += 6
    }

    if (score > bestPresetScore) {
      bestPresetScore = score
      bestPreset = preset
    }
  }

  if (bestPreset && bestPresetScore >= 18) {
    return bestPreset.answer
  }

  // 2. Fallback: buscar en las secciones activas de la guía
  for (const section of availableSections) {
    const titleNorm = normalizeText(section.title)
    const keywordsNorm = section.keywords.map(normalizeText)

    const matchesSection =
      titleNorm.includes(query) ||
      keywordsNorm.some((k) => query.includes(k) || k.includes(query)) ||
      queryWords.filter((w) => keywordsNorm.some((k) => k.includes(w))).length >= 2

    if (matchesSection) {
      const stepTexts = section.steps.map((s) => `${s.title}: ${s.description}`)
      return {
        query: rawQuery,
        title: section.title,
        directAnswer: section.summary,
        steps: stepTexts.slice(0, 4),
        actionHref: section.href,
        actionLabel: section.href ? `Ir a ${section.title}` : undefined,
        sectionId: section.id,
        sectionTitle: section.title,
        proTip: section.tips?.[0],
      }
    }
  }

  // 3. Fallback en FAQs
  for (const section of availableSections) {
    for (const faq of section.faq ?? []) {
      const qNorm = normalizeText(faq.question)
      if (queryWords.some((w) => qNorm.includes(w) && w.length >= 4)) {
        return {
          query: rawQuery,
          title: faq.question,
          directAnswer: faq.answer,
          steps: section.steps.slice(0, 3).map((s) => `${s.title}: ${s.description}`),
          actionHref: section.href,
          actionLabel: section.href ? `Ir a ${section.title}` : undefined,
          sectionId: section.id,
          sectionTitle: section.title,
          proTip: section.tips?.[0],
        }
      }
    }
  }

  return null
}
