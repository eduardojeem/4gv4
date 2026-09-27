export interface RepairStepGuide {
  number: number
  title: string
  subtitle: string
  description: string
  tips: string[]
  example: {
    title: string
    scenario: string
    data: Record<string, string>
  }
}

export interface RepairStatusGuide {
  status: string
  label: string
  badgeTone: string
  description: string
  typicalDuration: string
  actionsAllowed: string[]
  example: string
}

export interface RepairFeatureGuide {
  id: string
  title: string
  iconName: string
  summary: string
  howItWorks: string
  example: string
  proTip: string
}

// ─── 1. CICLO DE VIDA Y ESTADOS DE REPARACIÓN ──────────────────────────────
export const REPAIR_STATUSES_GUIDE: RepairStatusGuide[] = [
  {
    status: 'pending',
    label: 'Pendiente de Revisión',
    badgeTone: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    description: 'El equipo acaba de ser recepcionado en el mostrador. Está en cola esperando que un técnico lo tome en banco de trabajo para desarmar y diagnosticar.',
    typicalDuration: '2 a 6 horas',
    actionsAllowed: [
      'Asignar o reasignar técnico',
      'Registrar seña o adelanto en caja',
      'Editar falla informada o accesorios',
      'Imprimir ticket de recepción con QR',
    ],
    example: 'Samsung Galaxy A54 ingresado a las 09:30 con pantalla negra tras caída. Se cobró 50.000 Gs. de seña y quedó en la bandeja de entrada del técnico Marcos.',
  },
  {
    status: 'in_progress',
    label: 'En Diagnóstico / En Reparación',
    badgeTone: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    description: 'El técnico tiene el dispositivo desarmado en el banco de trabajo, realizando pruebas con multímetro, fuente de alimentación o ejecutando el trabajo pactado.',
    typicalDuration: '4 a 24 horas',
    actionsAllowed: [
      'Documentar diagnóstico técnico y fallas encontradas',
      'Cargar repuestos utilizados desde el stock del taller',
      'Definir o corregir precio final y mano de obra',
      'Enviar actualización por WhatsApp al cliente',
    ],
    example: 'iPhone 13 en revisión: se desmontó la placa madre y se constató pin de batería sulfatado. Se agregaron repuestos (batería original) y se actualizó el costo a 380.000 Gs.',
  },
  {
    status: 'waiting_parts',
    label: 'Esperando Repuesto',
    badgeTone: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
    description: 'El diagnóstico determinó que se necesita una pieza no disponible en stock inmediato (ej. display curvo, chip IC específico) y fue encargada a un proveedor.',
    typicalDuration: '24 a 72 horas',
    actionsAllowed: [
      'Registrar proveedor y código de seguimiento del repuesto',
      'Avisar al cliente la demora estimada por WhatsApp',
      'Aceptar o pausar el presupuesto pactado',
    ],
    example: 'Xiaomi Redmi Note 12 Pro: módulo AMOLED original solicitado a importador central. Entrega de la pieza prevista para mañana a las 14:00.',
  },
  {
    status: 'completed',
    label: 'Listo para Retirar',
    badgeTone: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    description: 'El trabajo técnico fue concluido con éxito y superó el control de calidad (táctil, cámaras, audio, carga). El cliente ya fue notificado para pasar a retirar.',
    typicalDuration: 'A la espera del cliente',
    actionsAllowed: [
      'Notificar retiro por WhatsApp con un solo clic',
      'Ver saldo pendiente por cobrar en el mostrador',
      'Iniciar proceso de entrega y cobro final',
      'Generar comprobante final de servicio',
    ],
    example: 'Motorola G84 probado al 100%. Se notificó al cliente que su equipo está listo con saldo pendiente de 180.000 Gs.',
  },
  {
    status: 'delivered',
    label: 'Entregado con Garantía',
    badgeTone: 'bg-slate-500/15 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-800',
    description: 'El cliente abonó el saldo restante (o lo financió en cuotas), probó el equipo en el mostrador y se retiró con su ticket de garantía activa.',
    typicalDuration: 'Orden cerrada',
    actionsAllowed: [
      'Consultar historial completo de auditoría y cobros',
      'Reimprimir ticket de entrega o factura',
      'Crear caso de postventa / garantía si el cliente reingresa dentro del plazo',
    ],
    example: 'Cliente retiró su notebook HP reparada (cambio de SSD + instalación de SO). Abonó 320.000 Gs. con tarjeta de débito. Garantía de 90 días vigente.',
  },
  {
    status: 'cancelled',
    label: 'Cancelado / Retirado sin Reparar',
    badgeTone: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
    description: 'El cliente rechazó el presupuesto final o el equipo fue declarado irreparable por daño masivo en placa. Se devuelven los repuestos al inventario.',
    typicalDuration: 'Orden cerrada',
    actionsAllowed: [
      'Cobrar costo de revisión técnica (si aplica)',
      'Devolver seña previa en efectivo o saldo a favor',
      'Reintegrar repuestos asignados al stock del taller',
    ],
    example: 'Tablet Lenovo con procesador quemado sin repuesto en el mercado. Cliente retira el equipo; se reintegró la pantalla reservada a stock.',
  },
]

// ─── 2. PASO A PASO: MODAL DE NUEVA REPARACIÓN ──────────────────────────────
export const NEW_REPAIR_MODAL_STEPS: RepairStepGuide[] = [
  {
    number: 1,
    title: 'Cliente y Canal de Notificación',
    subtitle: 'Quién deja el equipo y cómo le avisaremos los avances',
    description: 'Escribe el nombre, teléfono o documento del cliente. Si ya compró o reparó antes, sus datos se autocompletarán. Si es nuevo, puedes crearlo en 3 segundos sin salir del formulario.',
    tips: [
      'Verifica que el teléfono tenga código de país (ej.: 0981xxxxxx) para que el botón de WhatsApp funcione de inmediato.',
      'El correo electrónico es opcional pero permite enviar el comprobante digital en PDF.',
    ],
    example: {
      title: 'Ejemplo de Carga Rápida',
      scenario: 'Llega un cliente que ya tiene ficha de compras en la tienda.',
      data: {
        'Cliente': 'Rodrigo Benítez (0981 456 789)',
        'Documento': 'CI 4.234.567',
        'Canal preferido': 'WhatsApp para avisos automáticos',
      },
    },
  },
  {
    number: 2,
    title: 'Dispositivo y Trazabilidad',
    subtitle: 'Marca, modelo y número de serie / IMEI',
    description: 'Selecciona la categoría (Smartphone, Tablet, Notebook, Consola, etc.), la marca y el modelo exacto. El campo IMEI / Número de Serie es vital para evitar confusiones con equipos idénticos.',
    tips: [
      'En teléfonos puedes marcar *#06# para obtener el IMEI en pantalla.',
      'Si el equipo no enciende, el IMEI suele estar grabado en la bandeja SIM o tapa trasera.',
    ],
    example: {
      title: 'Ejemplo de Identificación Única',
      scenario: 'Se ingresa un teléfono celular común con alta rotación en el taller.',
      data: {
        'Categoría': 'Smartphone',
        'Marca': 'Samsung',
        'Modelo': 'Galaxy S21 FE 5G (G990B)',
        'IMEI': '354892109823451',
      },
    },
  },
  {
    number: 3,
    title: 'Seguridad y Desbloqueo',
    subtitle: 'Patrón táctil, PIN numérico o contraseña alfanumérica',
    description: 'Para que el técnico pruebe cámaras, micrófono, señal y pantalla táctil tras el arreglo, se debe solicitar la clave de acceso. El sistema incluye un lienzo interactivo para dibujar el patrón.',
    tips: [
      'Si es patrón táctil, dibújalo directamente en la matriz de 9 puntos en pantalla.',
      'Si el cliente tiene información confidencial, puede optar por "Sin clave" (el técnico solo podrá probar funciones de emergencia).',
    ],
    example: {
      title: 'Ejemplo de Registro de Desbloqueo',
      scenario: 'El equipo tiene bloqueo por patrón de 4 puntos.',
      data: {
        'Tipo de Clave': 'Patrón de Seguridad (Gesto)',
        'Trazo grabado': 'Puntos 1 -> 2 -> 5 -> 8 (forma de "L")',
        'PIN alternativo': '1234',
      },
    },
  },
  {
    number: 4,
    title: 'Falla Declarada y Estado Físico',
    subtitle: 'Blindaje legal y técnico ante reclamos previos',
    description: 'Documenta la queja principal del cliente y revisa el estado cosmético del equipo en el mostrador: marcas de golpes, pantalla astillada, rayones profundos o tornillos faltantes.',
    tips: [
      'Anota si el equipo ingresa apagado: evita que el cliente reclame componentes dañados previamente (ej. cámaras o lector de huellas).',
      'Usa el campo de observaciones para dejar constancia de abolladuras en el chasis.',
    ],
    example: {
      title: 'Ejemplo de Recepción Blindada',
      scenario: 'Teléfono ingresa con pantalla rota pero chasis golpeado.',
      data: {
        'Falla Informada': 'Vidrio quebrado tras caída en asfalto, no da imagen.',
        'Estado Físico': 'Golpe en esquina superior derecha, bisel plástico doblado. Tapa trasera intacta.',
        'Enciende al conectar': 'Sí, vibra y emite sonido de notificación.',
      },
    },
  },
  {
    number: 5,
    title: 'Accesorios Dejados',
    subtitle: 'Control estricto de elementos complementarios',
    description: 'Marca en el checklist cada objeto físico que acompaña al equipo: cargador original, cable USB, funda protectora (funda/case), chip SIM de telefonía o tarjeta de memoria MicroSD.',
    tips: [
      'Recomienda al cliente retirar su tarjeta SIM y memoria si no son necesarias para la prueba.',
      'Cada accesorio seleccionado aparecerá impreso en el ticket de recepción que firma el cliente.',
    ],
    example: {
      title: 'Ejemplo de Checklist',
      scenario: 'Cliente deja su teléfono con accesorios de uso diario.',
      data: {
        'Funda protectora': 'Sí (funda de silicona transparente gastada)',
        'Cargador / Cable': 'No entrega',
        'Chip SIM / SD': 'Chip Claro en bandeja 1. Sin MicroSD.',
      },
    },
  },
  {
    number: 6,
    title: 'Presupuesto, Seña e Impacto en Caja',
    subtitle: 'Valores monetarios y cobro del anticipo inicial',
    description: 'Si ya se conoce el costo, ingresa el Presupuesto Pactado. Si el cliente deja un anticipo o seña (ej. para comprar el repuesto), regístralo aquí: el dinero ingresa automáticamente a la sesión de Caja abierta.',
    tips: [
      'Para registrar una seña se requiere tener una Caja abierta en la sucursal.',
      'El comprobante imprimirá el Total, la Seña Cobrada y el Saldo Pendiente exacto.',
    ],
    example: {
      title: 'Ejemplo Financiero Inicial',
      scenario: 'Reparación con seña para asegurar el encargo de pantalla.',
      data: {
        'Presupuesto Total': '250.000 Gs.',
        'Seña Cobrada': '100.000 Gs. (Efectivo)',
        'Saldo a Pagar al Retirar': '150.000 Gs.',
        'Impacto en Caja': '+100.000 Gs. registrado en sesión de caja actual',
      },
    },
  },
  {
    number: 7,
    title: 'Prioridad y Técnico Asignado',
    subtitle: 'Organización operativa del taller',
    description: 'Establece la urgencia del trabajo (Normal, Alta o Urgente) y asigna un técnico específico o déjalo en "Por Asignar" para que el jefe de taller lo distribuya según disponibilidad.',
    tips: [
      'Las órdenes marcadas como "Urgente" se destacan con fondo rojo y encabezan la lista de prioridades.',
      'El técnico asignado puede ver inmediatamente la orden en su panel de trabajo.',
    ],
    example: {
      title: 'Ejemplo Operativo',
      scenario: 'Cliente de paso que viaja hoy por la tarde.',
      data: {
        'Prioridad': 'Urgente (Entrega en el día)',
        'Técnico Asignado': 'Carlos Méndez (Especialista en Microelectrónica)',
        'Tiempo Prometido': 'Hoy antes de las 18:00 hs',
      },
    },
  },
  {
    number: 8,
    title: 'Ticket Comprobante con Código QR',
    subtitle: 'El cliente rastrea su reparación desde su celular',
    description: 'Al confirmar el ingreso, el sistema genera automáticamente el ticket en formato térmico de 58mm/80mm o A4. Incluye un Código QR único para que el cliente consulte el avance en vivo desde su teléfono.',
    tips: [
      'El cliente solo apunta la cámara de su teléfono al QR del ticket y ve si su equipo está en revisión o listo para retirar.',
      'Reduce hasta un 70% las llamadas telefónicas de clientes preguntando "¿ya está mi equipo?".',
    ],
    example: {
      title: 'Ejemplo de Comprobante QR',
      scenario: 'Ticket impreso en comandera térmica de 80mm.',
      data: {
        'Nro. de Orden': '#REP-2026-0482',
        'Enlace de Rastreo': 'https://tutienda.com/reparaciones/REP-2026-0482',
        'Términos Legales': 'Garantía legal de 90 días sobre mano de obra.',
      },
    },
  },
]

// ─── 3. GUÍA DE FUNCIONALIDADES DEL PANEL ──────────────────────────────────
export const REPAIR_FEATURES_GUIDE: RepairFeatureGuide[] = [
  {
    id: 'views-kanban-table',
    title: 'Vistas del Taller: Tarjetas, Lista y Calendario',
    iconName: 'LayoutGrid',
    summary: 'Adapta la visualización según el volumen de trabajo del día.',
    howItWorks: 'En la parte superior puedes alternar entre Vista Tarjetas (ideal para arrastrar equipos o ver fotos y detalles rápidos), Vista Lista / Tabla (perfecta para procesar muchas órdenes, filtrar por columnas y exportar) y Vista Calendario (para ver compromisos por fecha de entrega).',
    example: 'En el mostrador usan la Vista Tarjetas para ver los equipos listos con fotos; el jefe de taller usa la Vista Tabla para auditar técnicos y prioridades.',
    proTip: 'Presiona la tecla "Ctrl + N" en cualquier momento para abrir el modal de nueva reparación inmediatamente.',
  },
  {
    id: 'smart-filters',
    title: 'Búsqueda Global y Filtros Avanzados',
    iconName: 'Filter',
    summary: 'Encuentra cualquier equipo por cliente, teléfono, IMEI, marca o falla.',
    howItWorks: 'La barra de búsqueda filtra en tiempo real sobre todos los campos. Además cuentas con filtros rápidos por Estado (Pendientes, En Proceso, Listos), Técnico Responsable, Prioridad (Urgentes) y Estado de Garantía.',
    example: 'Llega un cliente sin el ticket impreso diciendo "dejé un Moto G hace dos días". Escribes su apellido o número de celular en el buscador y el sistema lo encuentra al instante.',
    proTip: 'El filtro "Urgentes" aísla los equipos con compromiso inmediato para no retrasar entregas críticas.',
  },
  {
    id: 'parts-and-inventory',
    title: 'Gestión de Repuestos y Costos del Taller',
    iconName: 'Wrench',
    summary: 'Vínculo directo entre órdenes de trabajo y el inventario de repuestos.',
    howItWorks: 'Desde el detalle de la reparación puedes agregar repuestos físicos del inventario (pantallas, baterías, pines). El sistema descuenta el stock automáticamente y suma el precio al total de la reparación, calculando la ganancia neta en vivo.',
    example: 'Asignas un "Módulo OLED Samsung A54": el stock del inventario baja de 4 a 3 unidades; el costo interno (180.000 Gs.) y el precio al cliente (280.000 Gs.) se reflejan en la orden.',
    proTip: 'Si cancelas la reparación, los repuestos se pueden reintegrar automáticamente al inventario sin descuadre de stock.',
  },
  {
    id: 'payments-and-cash',
    title: 'Cobros Rápidos, Señas y Vinculación con Caja',
    iconName: 'Banknote',
    summary: 'Control financiero total: señas, saldos pendientes y pagos en cuotas.',
    howItWorks: 'Cada cobro (sea seña inicial o saldo al retirar) impacta directamente en la sesión de Caja abierta de la sucursal, clasificando si fue en Efectivo, Tarjeta o Transferencia. Si el cliente no puede pagar el saldo completo, se puede financiar en cuotas de Crédito.',
    example: 'Orden total 400.000 Gs.: Cliente pagó 100.000 Gs. de seña al dejar el equipo. Al retirar, abona 300.000 Gs. restantes en efectivo. El sistema emite el recibo final con saldo cero.',
    proTip: 'En cobros con efectivo, el modal calcula automáticamente el vuelto según el billete entregado por el cliente.',
  },
  {
    id: 'whatsapp-messaging',
    title: 'Notificaciones Instantáneas por WhatsApp',
    iconName: 'MessageSquare',
    summary: 'Avisa a tus clientes con un clic sin tipear números ni mensajes manuales.',
    howItWorks: 'En cada fila o tarjeta hay un botón de WhatsApp. Al hacer clic, abre WhatsApp Web o la App móvil con un mensaje prearmado personalizado con el nombre del cliente, modelo del equipo, estado actual y saldo a pagar.',
    example: 'Al pasar la orden a "Listo para Retirar", haces clic en el icono de WhatsApp y se genera: "Hola Rodrigo, tu Samsung Galaxy A54 ya está listo para retirar en la tienda central. Saldo: 150.000 Gs."',
    proTip: 'Ahorra horas de atención al cliente y evita que los equipos queden olvidados semanas en el taller.',
  },
  {
    id: 'receipts-and-print',
    title: 'Comprobantes Térmicos y Términos de Garantía',
    iconName: 'Printer',
    summary: 'Impresión optimizada para impresoras de 58mm, 80mm o formato A4.',
    howItWorks: 'Personaliza los comprobantes desde el botón "Comprobantes": agrega el logo de tu empresa, teléfono, dirección, redes sociales y las cláusulas legales de garantía (ej. "Equipos no retirados en 90 días se consideran abandonados").',
    example: 'El cliente recibe una tirilla térmica con el detalle del arreglo, el dinero entregado, las condiciones de garantía y el código QR de consulta.',
    proTip: 'Puedes reimprimir el comprobante cuantas veces sea necesario desde el botón de opciones en cualquier estado.',
  },
]

// ─── 4. VIDEO TUTORIALES Y GUÍA DE GRABACIÓN DE VIDEOS ──────────────────────
export interface RepairVideoTutorial {
  id: string
  title: string
  duration: string
  level: 'Principiante' | 'Intermedio' | 'Avanzado'
  role: 'Mostrador' | 'Técnico' | 'Administrador' | 'Todos'
  description: string
  thumbnailBg: string
  videoUrl?: string
  youtubeId?: string
  topics: string[]
}

export interface VideoCreationTip {
  step: number
  title: string
  description: string
  recommendation: string
}

export const HOW_TO_CREATE_VIDEOS_GUIDE: VideoCreationTip[] = [
  {
    step: 1,
    title: 'Elige una herramienta de grabación ligera y gratuita',
    description: 'Puedes usar Loom (extensión de navegador o app de escritorio), OBS Studio (gratuito y sin marcas de agua), Clipchamp (incluido gratis en Windows 11) o Screen Studio.',
    recommendation: 'Loom es la más rápida: graba pantalla + voz y genera un enlace web listo para compartir al instante sin tener que editar.',
  },
  {
    step: 2,
    title: 'Mantén los videos cortos y enfocados (1 a 3 minutos)',
    description: 'Graba 1 proceso específico por video: por ejemplo, "Cómo recepcionar una orden en 2 minutos", "Cómo cargar repuestos", o "Cómo cobrar el saldo en caja".',
    recommendation: 'Los videos cortos son fáciles de consumir para nuevos técnicos y recepcionistas en su primer día de trabajo.',
  },
  {
    step: 3,
    title: 'Alojamiento simple y privado (YouTube o en la nube)',
    description: 'Sube tus videos a YouTube configurándolos como "No listados" (Unlisted). De este modo, nadie que busque en YouTube los encontrará, pero tu equipo podrá reproducirlos directamente desde el sistema.',
    recommendation: 'También puedes usar Google Drive, Vimeo privado, Loom o subirlos como archivo MP4 a la nube del sistema.',
  },
  {
    step: 4,
    title: 'Integración en el Sistema 4G',
    description: 'Los enlaces o IDs de video se conectan a este centro de capacitación para que los empleados aprendan visualmente sin salir del panel.',
    recommendation: 'Te ahorra horas de capacitación repetitiva cada vez que ingresa un nuevo empleado al negocio.',
  },
]

export const REPAIR_VIDEO_TUTORIALS: RepairVideoTutorial[] = [
  {
    id: 'video-new-order',
    title: '1. Recepción rápida, cobro de seña en caja y ticket térmico QR',
    duration: '02:30 min',
    level: 'Principiante',
    role: 'Mostrador',
    description: 'Aprende a registrar una orden en menos de 2 minutos: alta rápida del cliente, captura de IMEI, dibujo del patrón táctil, checklist físico y cobro de seña en caja.',
    thumbnailBg: 'from-emerald-600 to-teal-800',
    topics: [
      'Búsqueda o alta rápida de cliente con número de WhatsApp',
      'Marca, modelo exacto y dibujo del patrón táctil de seguridad',
      'Cobro de seña inicial con ingreso automático a la sesión de caja',
      'Emisión térmica con QR único de seguimiento online',
    ],
  },
  {
    id: 'video-diagnosis-parts',
    title: '2. Banco de trabajo: diagnóstico, descuento de repuestos y costos',
    duration: '03:15 min',
    level: 'Intermedio',
    role: 'Técnico',
    description: 'Flujo del técnico: cambiar estado a En Diagnóstico, descontar repuestos del stock general o local, calcular costos y actualizar presupuesto.',
    thumbnailBg: 'from-blue-600 to-indigo-800',
    topics: [
      'Cambio de estado a "En Diagnóstico" y notas técnicas internas',
      'Asignación de repuestos con descuento automático de inventario',
      'Ajuste de mano de obra, cálculo de margen y ganancia en vivo',
      'Aviso de "Esperando Repuesto" a importadores o proveedores',
    ],
  },
  {
    id: 'video-delivery-payment',
    title: '3. Control de calidad, entrega con garantía y liquidación del saldo',
    duration: '02:45 min',
    level: 'Principiante',
    role: 'Todos',
    description: 'Paso a paso para marcar el equipo como Listo, notificar al cliente por WhatsApp con su saldo, procesar el cobro final en efectivo/tarjeta/transferencia y activar la garantía.',
    thumbnailBg: 'from-amber-600 to-orange-800',
    topics: [
      'Notificación automática de "Listo para Retirar" con saldo exacto',
      'Cobro del saldo restante en Caja con métodos combinados',
      'Entrega y activación del período de garantía (30, 60 o 90 días)',
      'Reimpresión o envío digital del comprobante final con QR',
    ],
  },
  {
    id: 'video-whatsapp-portal',
    title: '4. WhatsApp directo y portal de consulta en tiempo real para clientes',
    duration: '01:50 min',
    level: 'Principiante',
    role: 'Todos',
    description: 'Cómo tus clientes consultan el progreso de su equipo escaneando su QR o recibiendo actualizaciones instantáneas en su WhatsApp sin llamar por teléfono.',
    thumbnailBg: 'from-emerald-700 to-green-900',
    topics: [
      'Mensajes prediseñados de WhatsApp en 1 clic con variables dinámicas',
      'Visualización de la pantalla pública de consulta del cliente',
      'Reducción de llamadas y consultas reiteradas en mostrador',
    ],
  },
]

