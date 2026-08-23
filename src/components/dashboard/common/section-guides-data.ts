import { 
  Package, 
  Users, 
  Tags, 
  Layers, 
  Truck, 
  CreditCard, 
  Percent, 
  ShoppingBag, 
  BarChart3, 
  ShieldCheck, 
  Lock, 
  Store,
  Ticket,
  Sparkles,
  GalleryHorizontalEnd,
  Eye,
  CalendarClock,
  LineChart
} from 'lucide-react'
import type { SectionGuideData } from './SectionGuideModal'

export const PRODUCTS_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona el Catálogo de Productos?',
  subtitle: 'Gestiona tu inventario, códigos de barra, márgenes de ganancia y stock mínimo.',
  badgeText: 'Inventario & Catálogo',
  icon: Package,
  gradient: 'from-blue-600 via-indigo-600 to-slate-900',
  steps: [
    {
      title: 'Creación y Códigos de Barra',
      description: 'Registra artículos con su código de barra (o genera uno automático), marca, categoría, costo base y precio de venta con IVA.'
    },
    {
      title: 'Control de Stock y Alertas',
      description: 'El sistema monitorea en tiempo real las cantidades físicas. Cuando un producto baja del stock mínimo, aparece en la lista de alertas para reposición.'
    },
    {
      title: 'Venta Directa y Taller',
      description: 'Los productos se integran automáticamente con el Punto de Venta (POS) y pueden ser consumidos en órdenes de reparación con descuento automático.'
    }
  ],
  tip: 'Asigna proveedores a tus productos para agilizar la generación de órdenes de compra cuando el stock esté bajo.'
}

export const CUSTOMERS_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona la sección de Clientes (CRM)?',
  subtitle: 'Centraliza historiales de compras, cuentas corrientes, reparaciones y fidelización.',
  badgeText: 'Gestión de Clientes',
  icon: Users,
  gradient: 'from-purple-600 via-pink-600 to-slate-900',
  steps: [
    {
      title: 'Ficha Unificada del Cliente',
      description: 'Accede a los datos de contacto, RUC/CI, lista de precios asignada (minorista/mayorista) y saldo de crédito disponible.'
    },
    {
      title: 'Historial de Compras y Reparaciones',
      description: 'Visualiza en una sola línea de tiempo todas las compras realizadas en POS, presupuestos y estados de reparación de sus dispositivos.'
    },
    {
      title: 'Línea de Crédito y Cobranzas',
      description: 'Controla el saldo deudor, límites máximos de crédito y registra pagos a cuenta directamente en su cuenta corriente.'
    }
  ],
  tip: 'Mantén actualizado el número de WhatsApp para enviar comprobantes de venta y garantías en 1 clic.'
}

export const CATEGORIES_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona la Gestión de Categorías?',
  subtitle: 'Estructura tu catálogo para facilitar la búsqueda en el POS y la tienda online.',
  badgeText: 'Catálogo',
  icon: Layers,
  gradient: 'from-emerald-600 via-teal-600 to-slate-900',
  steps: [
    {
      title: 'Jerarquía y Organización',
      description: 'Crea categorías principales y subcategorías para clasificar accesorios, repuestos, telefonía y servicios.'
    },
    {
      title: 'Filtros Rápidos en POS',
      description: 'Permite a los cajeros y vendedores encontrar productos rápidamente tocando los botones de categorías en la botonera táctil del POS.'
    },
    {
      title: 'Reportes por Categoría',
      description: 'Analiza cuáles son las líneas de producto más rentables y con mayor rotación en tus reportes de analítica.'
    }
  ],
  tip: 'Usa nombres cortos y directos para que los botones táctiles del punto de venta se lean cómodamente.'
}

export const BRANDS_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona la Gestión de Marcas?',
  subtitle: 'Clasifica tus equipos y repuestos por fabricante (Apple, Samsung, Xiaomi, etc.).',
  badgeText: 'Marcas & Fabricantes',
  icon: Tags,
  gradient: 'from-amber-600 via-orange-600 to-slate-900',
  steps: [
    {
      title: 'Registro de Fabricantes',
      description: 'Agrega las marcas con las que trabajas en ventas y taller, incluyendo logos y modelos asociados.'
    },
    {
      title: 'Búsqueda Inteligente',
      description: 'Filtra repuestos y accesorios en segundos seleccionando la marca del dispositivo que ingresó a soporte.'
    },
    {
      title: 'Compatibilidad de Repuestos',
      description: 'Relaciona piezas universales con múltiples marcas y modelos para evitar duplicar inventario innecesariamente.'
    }
  ],
  tip: 'Asignar marcas a las órdenes de reparación permite generar estadísticas de los equipos que más ingresan a tu taller.'
}

export const SUPPLIERS_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona la Gestión de Proveedores?',
  subtitle: 'Administra tus contactos de compras, plazos de pago y catálogo de compras.',
  badgeText: 'Compras & Proveedores',
  icon: Truck,
  gradient: 'from-sky-600 via-blue-600 to-slate-900',
  steps: [
    {
      title: 'Directorio de Proveedores',
      description: 'Guarda datos fiscales, teléfonos de contacto, condiciones comerciales y días de crédito otorgados.'
    },
    {
      title: 'Cuentas por Pagar',
      description: 'Lleva el registro de facturas de compra pendientes de pago y concilia transferencias realizadas.'
    },
    {
      title: 'Historial de Compras',
      description: 'Audita la evolución de los costos de compra para negociar mejores precios por volumen.'
    }
  ],
  tip: 'Registra los datos bancarios de tus proveedores para agilizar los pagos desde el módulo de finanzas.'
}

export const CREDITS_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona el Módulo de Créditos?',
  subtitle: 'Gestiona ventas fiadas, cuotas pactadas, cobranzas y límites de saldo.',
  badgeText: 'Créditos & Financiación',
  icon: CreditCard,
  gradient: 'from-violet-600 via-purple-600 to-slate-900',
  steps: [
    {
      title: 'Emisión de Créditos',
      description: 'Vende a plazos desde el POS definiendo número de cuotas, fechas de vencimiento y tasa de interés o recargo.'
    },
    {
      title: 'Cobranza de Cuotas',
      description: 'Registra pagos parciales o totales de cuotas, emitiendo el correspondiente recibo de dinero que ingresa directo a caja.'
    },
    {
      title: 'Monitoreo de Morosidad',
      description: 'Identifica al instante cuotas vencidas, clientes con límite excedido y genera extractos de cuenta.'
    }
  ],
  tip: 'Revisa el límite de crédito antes de autorizar una entrega de reparación o venta a plazo.'
}

export const PROMOTIONS_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona Promociones y la página de Ofertas?',
  subtitle: 'Una promoción puede vivir en tres lugares distintos. El campo "Disponibilidad pública" decide en cuál.',
  badgeText: 'Marketing & Tienda pública',
  icon: Percent,
  gradient: 'from-rose-600 via-red-600 to-slate-900',
  steps: [
    {
      title: '1. Elegí dónde vive la promoción',
      description: 'Al crearla, "Disponibilidad pública" define todo. Solo uso interno/POS: sirve únicamente en caja. Cupón para carrito público: el cliente escribe el código al finalizar la compra. Oferta automática: baja el precio solo en la tienda, sin que nadie escriba nada.',
      icon: Ticket
    },
    {
      title: '2. Ofertas automáticas: precio rebajado sin código',
      description: 'Deben ser porcentuales y apuntar a productos concretos. La tienda calcula el precio con descuento y lo muestra tachado sobre el original. Si el producto ya tenía una oferta manual, gana la más barata. Ojo: compra mínima, tope de descuento y límite de usos NO se aplican a las automáticas.',
      icon: Sparkles
    },
    {
      title: '3. Cupones: el límite de usos sí se respeta',
      description: 'El cliente ingresa el código en el carrito. El sistema valida vigencia, compra mínima, tope y cuota de usos, y descuenta el uso dentro de la misma transacción de la compra. Por eso el contador de usos que ves acá solo se mueve con cupones, nunca con ofertas automáticas.',
      icon: CalendarClock
    },
    {
      title: '4. Controlá la sección pública de ofertas',
      description: 'Desde "Sección de ofertas" prendés o apagás la página /ofertas entera, y editás su título, bajada y color de acento. Si la apagás, quien entre a /ofertas verá un aviso y un botón al catálogo.',
      icon: Eye
    },
    {
      title: '5. Dos carruseles, distintos y separados',
      description: 'El "Carrusel de la página de ofertas" son campañas que armás a mano: imagen, texto y botón por slide, hasta 6. El otro carrusel se arma solo con tus productos rebajados, ordenados por mayor descuento. Cada uno se prende y apaga por separado, y ninguno comparte datos con el carrusel del inicio.',
      icon: GalleryHorizontalEnd
    },
    {
      title: '6. Leé los números y limpiá lo vencido',
      description: 'Las alertas avisan de promociones por vencer, activas ya vencidas y creadas que nadie usó. "Limpiar expiradas" desactiva en bloque las que siguen activas pero ya pasaron de fecha. Eliminar una promoción con usos registrados la desactiva en vez de borrarla, para no perder el historial.',
      icon: LineChart
    }
  ],
  tip: 'Si creaste una oferta automática y no aparece en la tienda, revisá tres cosas: que sea porcentual, que tenga al menos un producto seleccionado, y que el producto esté activo, visible y con stock.'
}

export const ORDERS_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona la Gestión de Pedidos Digitales?',
  subtitle: 'Administra pedidos recibidos por catálogo web, WhatsApp o ventas por preventa.',
  badgeText: 'Pedidos & Envíos',
  icon: ShoppingBag,
  gradient: 'from-blue-600 via-cyan-600 to-slate-900',
  steps: [
    {
      title: 'Recepción de Pedidos',
      description: 'Recibe órdenes de compra con detalle de productos, método de entrega (retiro en local o delivery) y datos de contacto.'
    },
    {
      title: 'Preparación y Empaque (Pick & Pack)',
      description: 'Cambia el estado a "En Preparación" para reservar el stock y verificar los ítems antes del despacho.'
    },
    {
      title: 'Facturación y Entrega',
      description: 'Convierte el pedido en una venta final en caja cuando el cliente retira o cuando el repartidor entrega el paquete.'
    }
  ],
  tip: 'Usa los enlaces de seguimiento para que el cliente conozca el estado de su pedido en tiempo real.'
}

export const AFTER_SALES_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona el flujo de Devoluciones y Garantías?',
  subtitle: 'Dónde se inician los reclamos y cómo se resuelven las devoluciones de dinero o los retrabajos.',
  badgeText: 'Posventa',
  icon: ShieldCheck,
  gradient: 'from-blue-600 via-indigo-600 to-slate-900',
  steps: [
    {
      title: '¿Dónde se inicia?',
      description: 'Desde la pestaña "Ventas y reparaciones" de esta misma sección: buscá el comprobante por número, cliente o teléfono y usá "Devolver" o "Reclamar". También podés abrirlo con el botón "Nuevo Reclamo".'
    },
    {
      title: 'Garantía de taller',
      description: 'Al aprobar una garantía de reparación se genera automáticamente una orden de retrabajo en ₲ 0, heredando equipo, cliente y técnico, con una nota interna que aclara qué cubre la garantía y qué se le puede cobrar.'
    },
    {
      title: 'Devolución de dinero y stock',
      description: 'Al completar el caso elegís si el dinero sale por caja (necesita una sesión abierta) o queda como saldo a favor del cliente. En el mismo paso definís si la mercadería vuelve al stock vendible o va a cuarentena.'
    }
  ],
  tip: 'Desde "Ventas y reparaciones" también podés ver el detalle de cualquier comprobante y reimprimir un ticket de venta, que sale marcado como REIMPRESIÓN.'
}

export const POS_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona el Punto de Venta (POS)?',
  subtitle: 'Realiza ventas rápidas, escanea códigos de barra y procesa pagos con caja abierta.',
  badgeText: 'Punto de Venta',
  icon: Store,
  gradient: 'from-blue-600 via-indigo-600 to-slate-900',
  steps: [
    {
      title: 'Búsqueda y Carrito Rápido',
      description: 'Busca productos por nombre, SKU o escaneando el código de barras con lector. Toca cualquier producto o servicio para sumarlo al carrito al instante.'
    },
    {
      title: 'Caja Abierta y Fondo de Cambio',
      description: 'Para operar en el mostrador, la caja debe estar abierta con su saldo inicial. Todas las ventas en efectivo, tarjeta o QR se sumarán a la sesión del cajero.'
    },
    {
      title: 'Cobro y Comprobante Térmico',
      description: 'Presiona "Cobrar" (F4), selecciona el cliente o consumidor final, el método de pago e imprime automáticamente el ticket en tu impresora térmica o envíalo por WhatsApp.'
    },
    {
      title: 'Encontrar productos con financiación',
      description: 'Activa el filtro "Con cuotas" y compara por cantidad de cuotas, menor tasa, menor cuota o menor total financiado. Las tarjetas muestran el plan destacado y la ficha del producto detalla todas las alternativas.'
    },
    {
      title: 'Aplicar un plan de producto',
      description: 'En la ficha selecciona "Usar este plan". El POS precarga las condiciones para el ticket completo y verifica cliente, línea de crédito disponible, stock y caja abierta antes de confirmar la venta.'
    }
  ],
  tip: 'El plan del producto es una sugerencia: revisa cuotas, tasa y total financiado en el cobro. Si cambias las condiciones, el POS las marcará como ajustadas manualmente.'
}

export const POS_DASHBOARD_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona el Dashboard y Analíticas del POS?',
  subtitle: 'Métricas en tiempo real de ventas de mostrador, reparaciones entregadas, ganancias y medios de pago.',
  badgeText: 'Analíticas POS',
  icon: BarChart3,
  gradient: 'from-indigo-600 via-blue-600 to-slate-900',
  steps: [
    {
      title: 'Vistas Especializadas por Módulo',
      description: 'Alterna entre "Vista General", "Ventas POS", "Reparaciones (Taller)" y "Ganancias & Márgenes" para auditar cada área de tu negocio.'
    },
    {
      title: 'Filtros Dinámicos de Fecha',
      description: 'Selecciona rangos rápidos (Hoy, 7 días, 30 días, Este mes) o especifica un intervalo personalizado en el calendario interactivo.'
    },
    {
      title: 'Análisis de Rentabilidad y Márgenes',
      description: 'Visualiza la facturación bruta frente al costo de mercadería para calcular tu ganancia neta y margen porcentual real.'
    },
    {
      title: 'Medios de Pago y Exportación',
      description: 'Analiza la distribución de cobros (Efectivo, Tarjetas, QR, Créditos) y descarga el informe detallado en formato CSV.'
    }
  ],
  tip: 'Utiliza los botones de rango rápido combinados con la pestaña de "Reparaciones" para auditar semanalmente la facturación del servicio técnico.'
}

export const ADMIN_ANALYTICS_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona la Analítica Avanzada?',
  subtitle: 'Informes ejecutivos de rentabilidad, ventas por período, rendimiento del taller y márgenes.',
  badgeText: 'Reportes & Métricas',
  icon: BarChart3,
  gradient: 'from-indigo-600 via-purple-600 to-slate-900',
  steps: [
    {
      title: 'Gráficos Comparativos',
      description: 'Analiza la evolución de ingresos mes a mes, comparando ventas de mostrador vs facturación del taller.'
    },
    {
      title: 'Top Productos y Servicios',
      description: 'Descubre los 10 productos con mayor margen neto y las reparaciones más frecuentes realizadas.'
    },
    {
      title: 'Desempeño del Personal',
      description: 'Revisa la productividad de técnicos y vendedores para el cálculo de comisiones e incentivos.'
    }
  ],
  tip: 'Exporta los informes en Excel o PDF al final de cada mes para tu archivo contable.'
}

export const ADMIN_CASH_MONITOR_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona el Monitor de Cajas?',
  subtitle: 'Supervisión en tiempo real de todas las cajas registradoras de tus sucursales.',
  badgeText: 'Control de Sucursales',
  icon: Store,
  gradient: 'from-slate-700 via-slate-800 to-slate-900',
  steps: [
    {
      title: 'Estado Global de Cajas',
      description: 'Visualiza qué cajas están abiertas, qué cajero está a cargo y cuánto dinero físico hay en cada gaveta.'
    },
    {
      title: 'Auditoría Remota de Arqueos',
      description: 'Detecta diferencias o descuadres de dinero en el momento exacto en que el cajero realiza su conteo.'
    },
    {
      title: 'Alertas de Límite de Efectivo',
      description: 'Recibe alertas si una caja acumula demasiado efectivo para programar retiros hacia caja fuerte.'
    }
  ],
  tip: 'Configura montos máximos por caja para obligar a retiros de seguridad automáticos.'
}

export const ADMIN_SECURITY_GUIDE: SectionGuideData = {
  title: '¿Cómo funciona la Seguridad y Permisos?',
  subtitle: 'Control de acceso granular por rol (administrador, cajero, técnico, operador).',
  badgeText: 'Seguridad',
  icon: Lock,
  gradient: 'from-slate-800 via-zinc-800 to-neutral-900',
  steps: [
    {
      title: 'Roles y Privilegios',
      description: 'Define qué usuarios pueden aplicar descuentos manuales, anular ventas, ver costos de compra o editar precios.'
    },
    {
      title: 'Registro de Auditoría (Audit Log)',
      description: 'Cada acción sensible (eliminación de ventas, modificaciones de stock, arqueos) queda registrada con fecha, hora y usuario.'
    },
    {
      title: 'Sesiones y Bloqueo',
      description: 'Configura cierre de sesión por inactividad y PIN de desbloqueo rápido para terminales compartidas.'
    }
  ],
  tip: 'Nunca compartas credenciales de administrador; asigna cuentas individuales a cada colaborador para tener trazabilidad total.'
}
