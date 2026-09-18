import type { BusinessVertical } from '@/lib/organization/business-profile'

export interface VerticalRecommendation {
  id: BusinessVertical
  title: string
  subtitle: string
  badge: string
  description: string
  startingSteps: {
    step: number
    title: string
    description: string
    actionLabel: string
    actionHref: string
  }[]
  dailyRoutine: {
    opening: string
    sales: string
    midday: string
    closing: string
  }
  keySettings: {
    title: string
    reason: string
    href: string
  }[]
  pitfallsToAvoid: string[]
  proTip: string
}

export const VERTICAL_RECOMMENDATIONS: Record<string, VerticalRecommendation> = {
  electronics: {
    id: 'electronics',
    title: 'Tecnología, Celulares y Servicio Técnico',
    subtitle: 'Venta de equipos, accesorios con alta rotación y gestión de taller',
    badge: 'Equipos y Reparaciones',
    description:
      'Ideal para locales de celulares, informática y electrónica. Requiere control riguroso de números de serie/IMEI, gestión de garantías y seguimiento de órdenes de servicio técnico.',
    startingSteps: [
      {
        step: 1,
        title: 'Cargar marcas y categorías base',
        description: 'Organizá tu catálogo en: Equipos Nuevos, Usados/Seminuevos, Accesorios (fundas, cables, cargadores) y Repuestos de taller.',
        actionLabel: 'Ir al Catálogo',
        actionHref: '/dashboard/products',
      },
      {
        step: 2,
        title: 'Configurar productos con variantes y seriales',
        description: 'Usá variantes para capacidades (128GB, 256GB) y colores. Anotá los números de serie o IMEI para responder garantías sin confusiones.',
        actionLabel: 'Cargar Productos',
        actionHref: '/dashboard/products',
      },
      {
        step: 3,
        title: 'Activar el módulo de Reparaciones',
        description: 'Creá los estados de tus órdenes (Ingresado, En Diagnóstico, Presupuestado, Listo, Entregado). Podés imprimir el ticket de ingreso con QR para el cliente.',
        actionLabel: 'Ver Reparaciones',
        actionHref: '/dashboard/repairs',
      },
      {
        step: 4,
        title: 'Configurar la caja y formas de cobro',
        description: 'Definí medios de pago: Efectivo, Transferencia Bancaria, QR y Tarjetas. En tecnología muchas ventas son mixtas (parte transferencia, parte efectivo).',
        actionLabel: 'Configurar Cajas',
        actionHref: '/dashboard/pos/caja',
      },
    ],
    dailyRoutine: {
      opening: 'Apertura de caja con fondo fijo de cambio (Gs. 100.000 a 200.000) y revisión de equipos pendientes en el taller.',
      sales: 'Cobro rápido de accesorios con código de barras en POS. Al vender celulares, verificar siempre el IMEI en el ticket.',
      midday: 'Actualizar presupuestos y repuestos en las órdenes de reparación para notificar a los clientes vía WhatsApp.',
      closing: 'Arqueo ciego de caja en el POS separando transferencias bancarias de efectivo físico. Ningún equipo sale del local sin ticket.',
    },
    keySettings: [
      {
        title: 'Módulo de Reparaciones y Taller',
        reason: 'Permite presupuestar repuestos + mano de obra y enviar avisos automáticos por WhatsApp al cliente.',
        href: '/dashboard/repairs',
      },
      {
        title: 'Monitor de Cajas en Vivo',
        reason: 'Permite auditar en tiempo real los cobros y cierres de cada vendedor para evitar diferencias.',
        href: '/admin/cash-monitor',
      },
      {
        title: 'Tienda Web con Catálogo Público',
        reason: 'Mostrá tus celulares y accesorios disponibles con stock actualizado para que te compren por WhatsApp.',
        href: '/admin/website',
      },
    ],
    pitfallsToAvoid: [
      'Entregar un equipo reparado sin registrar el costo del repuesto usado: distorsiona la ganancia real en el informe financiero.',
      'No anotar el IMEI o número de serie al vender un equipo: complica validar si la garantía corresponde a tu negocio.',
      'Retirar dinero de caja para compras urgentes sin anotarlo como egreso de caja en el sistema.',
    ],
    proTip: 'Publicá en tu tienda web los accesorios de mayor margen (vidrios templados, cargadores de carga rápida). Son compras impulsivas que cierran rápido.',
  },

  clothing: {
    id: 'clothing',
    title: 'Indumentaria, Calzado y Moda',
    subtitle: 'Control por talles y colores, promociones por temporada y catálogo visual',
    badge: 'Moda y Calzado',
    description:
      'Enfocado en tiendas de ropa, calzados y boutiques. La clave del éxito es la matriz de talles y colores, las liquidaciones por temporada y la tienda virtual con fotos claras.',
    startingSteps: [
      {
        step: 1,
        title: 'Crear categorías y atributos de talles',
        description: 'Definí categorías (Remeras, Pantalones, Vestidos, Calzados) y atributos (Talles: S, M, L, XL / Calzados: 36 al 44).',
        actionLabel: 'Organizar Catálogo',
        actionHref: '/dashboard/products',
      },
      {
        step: 2,
        title: 'Cargar prendas con su matriz de variantes',
        description: 'Un solo producto «Remera Básica» contiene sus combinaciones de talle y color con su stock individual.',
        actionLabel: 'Cargar Prendas',
        actionHref: '/dashboard/products',
      },
      {
        step: 3,
        title: 'Subir fotos reales y publicar la Tienda Web',
        description: 'La ropa se vende por los ojos. Subí fotos claras y activá la tienda para que tus clientas hagan pedidos directo por WhatsApp.',
        actionLabel: 'Configurar Tienda',
        actionHref: '/admin/website',
      },
      {
        step: 4,
        title: 'Configurar promociones y liquidaciones',
        description: 'Prepará descuentos por fin de temporada, 2x1 o combos para liquidar el stock de menor rotación.',
        actionLabel: 'Ver Promociones',
        actionHref: '/dashboard/promotions',
      },
    ],
    dailyRoutine: {
      opening: 'Apertura de caja con fondo suficiente para cambio. Reponer prendas en percheros según el reporte de stock bajo.',
      sales: 'En el POS, buscar por código de barras o nombre y seleccionar el talle exacto para que el inventario no se desincronice.',
      midday: 'Responder pedidos web recibidos por WhatsApp y separar las prendas antes de que se vendan en el local físico.',
      closing: 'Arqueo de caja al cierre. Revisar qué talles quedaron en cero para encargar reposición al taller o proveedor.',
    },
    keySettings: [
      {
        title: 'Variantes de Productos (Talle y Color)',
        reason: 'Evita crear un producto separado por cada color o talle; mantiene tu stock limpio y ordenado.',
        href: '/dashboard/products',
      },
      {
        title: 'Tienda Web con Fotos y WhatsApp',
        reason: 'Tus clientas pueden ver la colección completa desde el celular y pedirte directo al WhatsApp del local.',
        href: '/admin/website',
      },
      {
        title: 'Reportes de Ventas por Producto',
        reason: 'Identificá qué modelos y talles se venden más rápido para concentrar tus compras en lo rentable.',
        href: '/admin/reports',
      },
    ],
    pitfallsToAvoid: [
      'Cobrar un talle distinto al que se lleva la clienta: genera falsos sobrantes y faltantes de stock en el inventario.',
      'No actualizar las fotos de la tienda online cuando entra mercadería nueva.',
      'Hacer descuentos manuales en el mostrador sin registrarlos formalmente en el punto de venta.',
    ],
    proTip: 'Creá combos de prendas (ej: «Remera + Short por Gs. 120.000»). Aumenta el ticket promedio y rota las prendas que tienen menor salida.',
  },

  food: {
    id: 'food',
    title: 'Gastronomía, Cafeterías y Alimentos',
    subtitle: 'Venta ágil en mostrador/mesas, arqueo diario estricto y control de insumos',
    badge: 'Alimentos y Bebidas',
    description:
      'Diseñado para cafeterías, locales de comida rápida, panaderías y delivery. Prioriza la velocidad de cobro en mostrador, el ticket rápido y el arqueo diario riguroso.',
    startingSteps: [
      {
        step: 1,
        title: 'Cargar menú por categorías rápidas',
        description: 'Categorías claras: Desayunos, Sandwiches, Bebidas, Postres, Combos. Usá nombres cortos para cobro rápido.',
        actionLabel: 'Cargar Menú',
        actionHref: '/dashboard/products',
      },
      {
        step: 2,
        title: 'Configurar productos con adiciones o combos',
        description: 'Ejemplo: «Hamburguesa Completa» con opción de papas o bebida extra para agilizar el pedido.',
        actionLabel: 'Configurar Combos',
        actionHref: '/dashboard/products',
      },
      {
        step: 3,
        title: 'Definir turnos y fondo de caja',
        description: 'La gastronomía tiene alta rotación de efectivo: creá cajas separadas por turno (mañana / tarde-noche).',
        actionLabel: 'Abrir Caja',
        actionHref: '/dashboard/pos/caja',
      },
      {
        step: 4,
        title: 'Cargar datos del ticket y WhatsApp para delivery',
        description: 'Configurá tu dirección y número de WhatsApp en Empresa para que los clientes hagan pedidos directos.',
        actionLabel: 'Datos del Negocio',
        actionHref: '/admin/website',
      },
    ],
    dailyRoutine: {
      opening: 'Apertura de caja con fondo abundante en billetes chicos y monedas para cambio rápido en horas pico.',
      sales: 'Cobro ágil en POS con pantalla táctil o atajos. Impresión inmediata de comanda o ticket.',
      midday: 'Cambio de turno de cajero: cierre parcial con arqueo ciego antes de entregar la caja al siguiente turno.',
      closing: 'Arqueo de cierre final. Registro inmediato de compras de insumos diarios (pan, verduras, hielo) en Gastos.',
    },
    keySettings: [
      {
        title: 'Punto de Venta POS Rápido',
        reason: 'Permite registrar pedidos en segundos con búsqueda veloz y cobro con código QR o efectivo.',
        href: '/dashboard/pos',
      },
      {
        title: 'Control de Gastos Operativos',
        reason: 'En gastronomía los insumos diarios se compran al contado: anotalos al instante para saber tu utilidad real.',
        href: '/admin/finances',
      },
      {
        title: 'Monitor de Cajas por Turno',
        reason: 'Controlá las diferencias de caja de cada cajero entre el turno mañana y el turno noche.',
        href: '/admin/cash-monitor',
      },
    ],
    pitfallsToAvoid: [
      'Pagar proveedores de mercadería con dinero de la caja sin cargar el comprobante de gasto en el sistema.',
      'No hacer arqueo ciego al cambiar de turno: cuando falta dinero al final de la noche nadie sabe en qué turno ocurrió.',
      'Dejar productos fuera de stock en el POS que los cocineros ya no pueden preparar.',
    ],
    proTip: 'Ofrecé pago inmediato con código QR en el mostrador: reduce las colas a la mitad en los momentos pico.',
  },

  hardware: {
    id: 'hardware',
    title: 'Ferretería, Repuestos y Bazar',
    subtitle: 'Gran volumen de referencias, código de barras, precios por mayor y stock mínimo',
    badge: 'Gran Catálogo y Mayorista',
    description:
      'Para ferreterías, repuesteras y corralones con miles de códigos. Lo esencial es la búsqueda rápida por código de barras/SKU, el control de stock mínimo y los precios mayoristas.',
    startingSteps: [
      {
        step: 1,
        title: 'Carga masiva o por código de barras',
        description: 'Aprovechá los códigos de barras de los fabricantes o asigná códigos SKU cortos y memorizables.',
        actionLabel: 'Ver Catálogo',
        actionHref: '/dashboard/products',
      },
      {
        step: 2,
        title: 'Definir stock mínimo de reposición',
        description: 'Marcá el punto de pedido para que el sistema te alerte antes de quedarte sin tornillos, discos o piezas clave.',
        actionLabel: 'Configurar Alertas',
        actionHref: '/admin/inventory',
      },
      {
        step: 3,
        title: 'Configurar precios mayoristas y profesionales',
        description: 'Asigná precios especiales para herreros, mecánicos o clientes frecuentes que compran por cantidad.',
        actionLabel: 'Precios de Productos',
        actionHref: '/dashboard/products',
      },
      {
        step: 4,
        title: 'Asignar permisos a vendedores de mostrador',
        description: 'Permití a tus vendedores buscar artículos y cobrar sin que puedan modificar los costos de compra.',
        actionLabel: 'Gestionar Usuarios',
        actionHref: '/admin/users',
      },
    ],
    dailyRoutine: {
      opening: 'Revisar la lista de productos con alerta de stock bajo para confeccionar los pedidos a proveedores.',
      sales: 'Atención en mostrador con pistola lectora de código de barras. Búsqueda por palabras clave o medidas.',
      midday: 'Recepción de mercadería: cargar los ingresos de stock inmediatamente para actualizar costos y cantidades.',
      closing: 'Cierre de caja y verificación de remitos o pedidos pendientes de entrega.',
    },
    keySettings: [
      {
        title: 'Alertas de Stock Bajo',
        reason: 'Te avisa automáticamente qué productos están por debajo del mínimo para que nunca pierdas una venta por falta de stock.',
        href: '/admin/inventory',
      },
      {
        title: 'Gestión de Permisos de Equipo',
        reason: 'Tus empleados pueden vender con agilidad sin ver tus márgenes ni tus costos confidenciales de compra.',
        href: '/admin/users',
      },
      {
        title: 'Reportes de Inventario Valorizado',
        reason: 'Calcula exactamente cuánto dinero tenés invertido en tus estanterías a costo y a precio de venta.',
        href: '/admin/reports',
      },
    ],
    pitfallsToAvoid: [
      'Vender piezas fraccionadas (ej: metros de cable o tornillos sueltos) sin definir una unidad de medida clara.',
      'Dejar mercadería nueva guardada en el depósito sin registrar el ingreso en el sistema.',
      'No auditar periódicamente los productos de mayor valor monetario.',
    ],
    proTip: 'Configurá alertas de stock en los 50 artículos de mayor rotación. En ferretería, tener siempre lo básico fideliza a los profesionales del barrio.',
  },

  cosmetics: {
    id: 'cosmetics',
    title: 'Cosmética, Belleza y Cuidado Personal',
    subtitle: 'Venta por marcas, líneas de tratamiento, combos de regalo y tienda visual',
    badge: 'Belleza y Cuidado',
    description:
      'Ideal para tiendas de cosméticos, perfumerías y estéticas. Enfocado en la recomendación de productos, combos de regalo y fidelización de clientas recurrentes.',
    startingSteps: [
      {
        step: 1,
        title: 'Organizar catálogo por Marca y Línea',
        description: 'Categorizá por: Skincare, Maquillaje, Capilar, Perfumes y Accesorios de belleza.',
        actionLabel: 'Crear Categorías',
        actionHref: '/dashboard/products',
      },
      {
        step: 2,
        title: 'Cargar productos con imágenes de calidad',
        description: 'En cosmética el packaging importa: subí fotos claras que resalten tonos y presentaciones.',
        actionLabel: 'Cargar Productos',
        actionHref: '/dashboard/products',
      },
      {
        step: 3,
        title: 'Armar combos de regalo y rutinas',
        description: 'Creá kits completos (ej: «Rutina Antiedad Día + Noche») para aumentar el valor de cada ticket.',
        actionLabel: 'Ver Promociones',
        actionHref: '/dashboard/promotions',
      },
      {
        step: 4,
        title: 'Publicar la tienda online con catálogo público',
        description: 'Tus clientas pueden ver tonos, comparar productos y pedir su delivery por WhatsApp.',
        actionLabel: 'Configurar Tienda',
        actionHref: '/admin/website',
      },
    ],
    dailyRoutine: {
      opening: 'Verificar vidriera y exhibición de productos destacados del mes. Abrir caja en el POS.',
      sales: 'Asesorar a la clienta y registrar la venta asociándola a su número de teléfono para su historial.',
      midday: 'Actualizar historias o catálogo web con productos en tendencia y contestar consultas de WhatsApp.',
      closing: 'Cierre de caja y arqueo. Comprobar qué tonos o referencias populares necesitan reposición.',
    },
    keySettings: [
      {
        title: 'Catálogo Web Público para Clientes',
        reason: 'Permite a tus clientas hojear todos los tonos y productos disponibles desde su casa antes de ir al local.',
        href: '/admin/website',
      },
      {
        title: 'Historial de Clientes y CRM',
        reason: 'Sabés qué tono de base o crema compró tu clienta hace dos meses para recomendarle la reposición exacta.',
        href: '/dashboard/clients',
      },
      {
        title: 'Reportes de Productos Estrella',
        reason: 'Identificá las marcas que te dejan mayor margen de ganancia para promocionarlas con prioridad.',
        href: '/admin/reports',
      },
    ],
    pitfallsToAvoid: [
      'No anotar el tono o variante exacta al vender un labial o base (desincroniza los probadores con el stock real).',
      'No registrar los datos de contacto de las clientas para avisarles cuando vuelve a entrar su producto favorito.',
      'Dejar productos con fecha de vencimiento próxima sin rotación ni oferta especial.',
    ],
    proTip: 'Creá «Sets de Regalo» para fechas especiales (Día de la Madre, San Valentín, Navidad). Son las temporadas de mayor facturación del año.',
  },

  general: {
    id: 'general',
    title: 'Comercio General y Multirrubro',
    subtitle: 'Puesta en marcha ágil para cualquier negocio de compra y venta',
    badge: 'Comercio General',
    description:
      'Guía universal para cualquier negocio que comercialice productos o servicios. Se enfoca en las 4 etapas fundamentales para estar 100% operativo desde el primer día.',
    startingSteps: [
      {
        step: 1,
        title: 'Completar datos de la empresa',
        description: 'Cargá nombre, dirección y WhatsApp de contacto. Aparecerán en los tickets impresos y en tu tienda.',
        actionLabel: 'Configurar Negocio',
        actionHref: '/admin/website',
      },
      {
        step: 2,
        title: 'Cargar tus primeros 10 a 20 productos',
        description: 'Empezá por tus artículos más vendidos con su precio de venta al público y stock inicial.',
        actionLabel: 'Ir al Catálogo',
        actionHref: '/dashboard/products',
      },
      {
        step: 3,
        title: 'Abrir tu primera caja en el POS',
        description: 'Establecé un fondo fijo en efectivo y realizá una venta de prueba para verificar el flujo de cobro.',
        actionLabel: 'Abrir Caja',
        actionHref: '/dashboard/pos/caja',
      },
      {
        step: 4,
        title: 'Invitar a tu equipo con sus roles',
        description: 'Creá usuarios para tus vendedores con permisos adecuados para que cada venta quede registrada a su nombre.',
        actionLabel: 'Gestionar Usuarios',
        actionHref: '/admin/users',
      },
    ],
    dailyRoutine: {
      opening: 'Apertura de caja con fondo inicial en el POS y chequeo rápido de stock disponible para la jornada.',
      sales: 'Cobro de ventas en el POS buscando por nombre o código. Entrega de ticket al cliente.',
      midday: 'Registro inmediato de cualquier salida de dinero de la caja para gastos o pagos menores.',
      closing: 'Arqueo ciego de caja en el POS, comparación de valores reales vs sistema y cierre oficial de turno.',
    },
    keySettings: [
      {
        title: 'Punto de Venta POS',
        reason: 'Es la herramienta principal para registrar ventas, cobrar con múltiples métodos e imprimir comprobantes.',
        href: '/dashboard/pos',
      },
      {
        title: 'Catálogo de Productos',
        reason: 'Administra tus precios, costos, variantes y existencias en cada sucursal de tu negocio.',
        href: '/dashboard/products',
      },
      {
        title: 'Reportes de Ventas y Finanzas',
        reason: 'Conocé tu facturación total, ganancia bruta y rendimiento de tus vendedores mes a mes.',
        href: '/admin/reports',
      },
    ],
    pitfallsToAvoid: [
      'Empezar a vender sin abrir caja: impide registrar cobros y cuadrar el dinero al final del día.',
      'Usar un único usuario genérico para varios vendedores: hace imposible saber quién cometió un error o cerró una venta.',
      'Dejar el inventario sin actualizar cuando ingresa mercadería del proveedor.',
    ],
    proTip: 'Cargá primero tus 20 productos de mayor rotación. Con eso ya podés empezar a vender en el POS hoy mismo sin esperar a cargar todo el inventario.',
  },
}

export function getVerticalRecommendation(vertical?: string | null): VerticalRecommendation {
  if (!vertical) return VERTICAL_RECOMMENDATIONS.general
  return VERTICAL_RECOMMENDATIONS[vertical] ?? VERTICAL_RECOMMENDATIONS.general
}
