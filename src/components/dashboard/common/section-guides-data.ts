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
  LineChart,
  ShoppingCart,
  Store as StoreIcon,
  Megaphone,
  Coins,
  Gift,
  Trophy,
  ShieldAlert,
  History,
  Dices,
  Wallet,
  Receipt,
  BadgeDollarSign,
  MessageCircle,
  AlertTriangle,
  FileText,
  CheckCircle2,
  TrendingUp,
  Clock
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
  title: '¿Cómo funciona el Módulo de Créditos y Financiación?',
  subtitle: 'Guía integral para otorgar créditos, cobrar cuotas en caja, controlar vencimientos y gestionar la cartera de clientes.',
  badgeText: 'Créditos, Cobranzas & Cartera',
  icon: CreditCard,
  gradient: 'from-violet-600 via-indigo-600 to-slate-900',
  steps: [
    {
      title: '1. Otorgamiento y Financiación (POS o Manual)',
      description: 'Al realizar una venta en el POS o desde el panel de créditos, seleccioná el cliente y elegí el plan de cuotas (semanal, quincenal o mensual). El sistema calcula el recargo de financiación o interés y programa las fechas de vencimiento de cada cuota.',
      icon: Wallet
    },
    {
      title: '2. Cobranza de Cuotas y Registro en Caja',
      description: 'Cobrá cuotas completas o entregas parciales en efectivo, tarjeta o transferencia. Cada pago ingresa automáticamente a la sesión de caja abierta y emite un comprobante/recibo térmico (58mm/80mm) o PDF A4 con el saldo restante.',
      icon: Receipt
    },
    {
      title: '3. Amortización Inteligente de Saldos',
      description: 'Cuando un cliente entrega un monto global de dinero, el sistema distribuye el pago de forma inteligente cancelando primero las cuotas más antiguas o vencidas para reducir su mora de forma óptima.',
      icon: BadgeDollarSign
    },
    {
      title: '4. Semáforo de Vencimientos y Control de Mora',
      description: 'Monitoreá el estado de la cartera en tiempo real: cuotas Al Día (verde), Próximas a Vencer en 7 días (azul), Vencidas Hoy (naranja) y En Mora (rojo). Podés filtrar y priorizar cobranzas fácilmente.',
      icon: Clock
    },
    {
      title: '5. Extracto Consolidado y WhatsApp',
      description: 'Generá el Estado de Cuenta consolidado del cliente que unifica todas sus compras a crédito activas. Podés imprimir el extracto o enviar un recordatorio formal con el detalle de cuotas por WhatsApp en un clic.',
      icon: MessageCircle
    },
    {
      title: '6. Límites de Crédito y Seguridad Financiera',
      description: 'Configurá el límite máximo de crédito por cliente en el CRM. Si el cliente supera su saldo asignado, el sistema emite una alerta visual antes de autorizar nuevas ventas a plazo o entregas de taller.',
      icon: ShieldCheck
    }
  ],
  examples: [
    {
      goal: 'Financiar una venta en 6 cuotas con entrega inicial',
      setup: [
        'Venta en POS por valor de 1.800.000 Gs.',
        'Seleccionar cliente registrado y método de pago "Crédito / Cuenta Corriente".',
        'Ingresar Entrega Inicial al Contado de 300.000 Gs.',
        'Configurar 5 cuotas restantes de 300.000 Gs. con vencimiento cada 30 días.'
      ],
      result: 'Se imprime el ticket de venta con el calendario de pagos. Las 5 cuotas quedan agendadas en el sistema y se monitorean mes a mes.',
      icon: ShoppingBag
    },
    {
      goal: 'Registrar un pago parcial de cuotas atrasadas',
      setup: [
        'Cliente adeuda 2 cuotas vencidas de 150.000 Gs. cada una (Total: 300.000 Gs.).',
        'El cliente se acerca y entrega 200.000 Gs. en efectivo.',
        'Hacer clic en "Cobrar" > Ingresar 200.000 Gs. > Confirmar pago.'
      ],
      result: 'El sistema cancela al 100% la cuota #1 (150.000 Gs.) y abona 50.000 Gs. a la cuota #2 (saldo restante de 100.000 Gs.). El dinero ingresa a caja y se emite el recibo.',
      icon: CheckCircle2
    },
    {
      goal: 'Enviar recordatorio de pago y Estado de Cuenta por WhatsApp',
      setup: [
        'Ingresar a la lista de Créditos o a la pestaña "Próximos Vencimientos".',
        'Abrir el detalle del crédito del cliente.',
        'Hacer clic en "Estado de Cuenta" > "Compartir por WhatsApp" o "Descargar PDF".'
      ],
      result: 'El cliente recibe un mensaje profesional con el desglose de su cuenta, saldo total pendiente y fechas de vencimiento para facilitar su pago.',
      icon: MessageCircle
    }
  ],
  tip: 'Mantené una sesión de caja abierta durante el cobro de cuotas para que cada pago genere su recibo y quede contabilizado en el arqueo del día.'
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
  examples: [
    {
      goal: 'Quiero 20% de descuento en fundas todo el fin de semana, en la tienda online, sin que el cliente escriba nada',
      icon: Sparkles,
      setup: [
        'Nueva promoción → Tipo: Porcentaje, Valor: 20',
        'Disponibilidad pública: Oferta automática',
        'Productos: elegí las fundas una por una (las automáticas no aceptan "todo el catálogo")',
        'Vigencia: viernes 00:00 a domingo 23:59',
      ],
      result: 'La tienda muestra las fundas con el precio viejo tachado y el nuevo al lado, y aparecen solas en /ofertas. El contador de usos queda en cero: las automáticas no cuentan usos.',
    },
    {
      goal: 'Quiero dar 50.000 Gs de descuento a quien compre más de 500.000 Gs, pero solo a los primeros 100',
      icon: ShoppingCart,
      setup: [
        'Nueva promoción → Tipo: Monto fijo, Valor: 50000',
        'Disponibilidad pública: Cupón para carrito público',
        'Código: escribí uno fácil de dictar, por ejemplo AHORRA50',
        'Compra mínima: 500000 · Límite de usos: 100',
      ],
      result: 'El cliente escribe AHORRA50 al finalizar la compra. El sistema valida vigencia, mínimo y cupo en la misma transacción, así que nunca se pasa de 100 aunque dos personas compren a la vez.',
    },
    {
      goal: 'Quiero un descuento que solo pueda dar el cajero, a criterio, y que no se vea en la web',
      icon: Ticket,
      setup: [
        'Nueva promoción → Tipo: Porcentaje, Valor: 10',
        'Disponibilidad pública: Solo uso interno / POS',
        'No hace falta código ni productos',
      ],
      result: 'Aparece en la lista de descuentos de la caja y en ningún lado de la tienda pública. Útil para clientes conocidos o para destrabar una venta.',
    },
    {
      goal: 'Quiero anunciar "Semana del celular" con una imagen grande arriba de la página de ofertas',
      icon: Megaphone,
      setup: [
        'Pestaña Página pública → Carrusel de campañas',
        'Activalo y agregá una diapositiva: imagen, título, bajada y botón',
        'Podés cargar hasta 6 diapositivas y ordenarlas',
      ],
      result: 'Se ve un banner arriba de /ofertas, con el mismo diseño del carrusel del inicio pero con contenido propio. No comparte diapositivas con el del inicio: son dos carruseles separados.',
    },
    {
      goal: 'Quiero apagar la página de ofertas mientras preparo la próxima campaña',
      icon: StoreIcon,
      setup: [
        'Pestaña Página pública → Sección de ofertas',
        'Apagá el interruptor de visibilidad',
      ],
      result: 'Quien entre a /ofertas ve un aviso y un botón al catálogo. Tus promociones siguen existiendo y los cupones se siguen pudiendo canjear en el carrito: solo se oculta la página.',
    },
  ],
  tip: 'Si creaste una oferta automática y no aparece en la tienda, revisá tres cosas: que sea porcentual, que tenga al menos un producto seleccionado, y que el producto esté activo, visible y con stock.'
}

export const LOYALTY_GUIDE: SectionGuideData = {
  title: '¿Cómo funcionan los Puntos y los Sorteos?',
  subtitle: 'El cliente acumula puntos comprando y los canjea por números de sorteo. El saldo lo lleva la base de datos, no el mostrador.',
  badgeText: 'Fidelización & Sorteos',
  icon: Coins,
  gradient: 'from-amber-600 via-orange-600 to-slate-900',
  steps: [
    {
      title: '1. Definí cuánto vale una compra',
      description: 'En "Acumulación de puntos" elegís cuánta moneda hace falta por punto. Con 10.000 Gs por punto, una compra de 150.000 deja 15 puntos. Podés truncar o redondear las fracciones, ponerle un techo diario por cliente y hacer que los puntos venzan a los X meses.',
      icon: Coins
    },
    {
      title: '2. Los puntos se acreditan solos al cobrar',
      description: 'No hay que hacer nada en la caja: al cerrar una venta con cliente asignado, el sistema acredita los puntos. Si la venta se reintenta, no se acredita dos veces — cada venta tiene una sola acreditación posible.',
      icon: ShoppingCart
    },
    {
      title: '3. Campañas para dar puntos extra',
      description: 'Una promoción temporal multiplica los puntos (x2, x3) o suma una cantidad fija, durante un período. Podés ponerle compra mínima, tope por cliente y tope total. Si hay varias vigentes se aplica una sola: la que más le conviene al cliente.',
      icon: CalendarClock
    },
    {
      title: '4. Sorteos: el cliente canjea puntos por números',
      description: 'Creás el sorteo con premios, fechas, cuánto cuesta cada número y cuántos puede llevar cada persona. Nace como borrador; recién cuando lo publicás el mostrador puede vender números. Una persona puede llevar varios números del mismo sorteo.',
      icon: Gift
    },
    {
      title: '5. Los números salen al azar, no en orden',
      description: 'Cada número se toma al azar de los que quedan libres. Se hace así para que nadie pueda deducir cuántos participantes hay ni reservar el próximo. Si dos personas compran en el mismo instante, la base garantiza que no se repita ninguno.',
      icon: Dices
    },
    {
      title: '6. El sorteo se corre una sola vez',
      description: 'Cerrás el sorteo y apretás "Sortear": se elige un ganador por premio, una misma persona no se lleva dos premios, y el sorteo queda marcado como realizado. No se puede repetir hasta que salga el resultado deseado. La semilla usada queda guardada para que cualquiera pueda verificar el resultado.',
      icon: Trophy
    },
    {
      title: '7. Cada cliente ve su historial',
      description: 'En la ficha del cliente están el saldo, todos los movimientos (qué compra los sumó, qué canje los restó, el saldo después de cada uno), los números que tiene y los premios que ganó.',
      icon: History
    },
    {
      title: '8. Nadie puede tocar los saldos a mano',
      description: 'Las tablas de puntos no aceptan escritura directa: ni desde el navegador ni desde la API. Todo pasa por funciones de la base que validan permiso, saldo y topes. El historial es inmutable: un error se corrige con un ajuste compensatorio, que queda registrado con motivo y autor.',
      icon: ShieldAlert
    }
  ],
  examples: [
    {
      goal: 'Quiero que cada 10.000 Gs de compra den 1 punto',
      icon: Coins,
      setup: [
        'Pestaña Puntos y sorteos → Acumulación de puntos',
        'Moneda necesaria por punto: 10000 · Puntos que otorga: 1',
        'Fracciones: Truncar (una compra de 19.999 da 1 punto, no 2)',
        'Prendé el interruptor y guardá'
      ],
      result: 'Desde ese momento, toda venta con cliente asignado acredita puntos sola. La tarjeta te muestra el ejemplo en vivo: una compra de 150.000 deja 15 puntos.'
    },
    {
      goal: 'Quiero doble puntos el fin de semana, pero sin regalar más de 500 puntos en total',
      icon: CalendarClock,
      setup: [
        'Promociones temporales de puntos → Nueva',
        'Tipo: Multiplicador · Multiplicador: 2',
        'Desde el viernes 00:00 hasta el domingo 23:59',
        'Tope total: 500'
      ],
      result: 'Una compra que daba 15 puntos ahora da 30. La tarjeta muestra una barra con cuánta bonificación se entregó; al llegar a 500 la promoción deja de sumar extra, pero las compras siguen sumando sus puntos base.'
    },
    {
      goal: 'Quiero sortear un celular entre quienes junten puntos, máximo 10 números por persona',
      icon: Gift,
      setup: [
        'Sorteos → Nuevo sorteo',
        'Premios: 1º Celular, 2º Auricular (agregá los que quieras)',
        'Puntos por número: 50 · Máx. por cliente: 10 · Números totales: 1000',
        'Cargá las fechas y creá. Después apretá Publicar'
      ],
      result: 'El mostrador ya puede canjear puntos por números. Un cliente con 500 puntos puede llevar 10 números: el sistema le descuenta 500 puntos y le asigna 10 números al azar entre el 1 y el 1000, sin repetir.'
    },
    {
      goal: 'Llegó el día: quiero elegir al ganador y poder demostrar que fue limpio',
      icon: Trophy,
      setup: [
        'Sorteos → Cerrar (deja de vender números)',
        'Después Sortear y confirmá'
      ],
      result: 'Sale un ganador por premio. Queda guardada la semilla usada: con ese dato el sorteo se puede volver a correr y verificar que salió lo mismo. Una misma persona no se lleva dos premios, y el sorteo no se puede repetir.'
    },
    {
      goal: 'Un cliente dice que le faltan puntos de una compra',
      icon: History,
      setup: [
        'Abrí la ficha del cliente → historial de puntos',
        'Revisá los movimientos: cada uno dice de dónde salió y con qué saldo quedó',
        'Si falta, cargá un ajuste con el motivo'
      ],
      result: 'El ajuste suma los puntos y queda registrado con quién lo hizo y por qué. El movimiento original no se edita nunca: el historial es inmutable, así que siempre se puede reconstruir qué pasó.'
    },
    {
      goal: 'Un cliente me pide que no lo dejemos participar más en sorteos',
      icon: ShieldAlert,
      setup: [
        'Abrí la ficha del cliente → historial de puntos',
        'Apretá "Registrar autoexclusión": queda excluido por un año'
      ],
      result: 'Mientras esté vigente, el sistema rechaza cualquier canje de esa persona aunque tenga saldo de sobra y el sorteo esté abierto. Sigue acumulando puntos por sus compras: lo único bloqueado es participar.'
    }
  ],
  tip: 'Si un cliente compró y no ve los puntos, revisá tres cosas: que la acumulación esté prendida, que la venta tenga el cliente asignado (sin cliente no hay a quién acreditarle), y que la compra supere la tasa de conversión — una compra de 9.999 con tasa de 10.000 da cero puntos.'
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
