import type { GuideSection } from './types'

/**
 * La guía del sistema: qué hace cada sección, con un ejemplo de cada una.
 *
 * Todo lo que se afirma acá tiene que ser verdad en el código. Los textos
 * viejos hablaban de un rol «Solo lectura» inexistente y de permisos
 * granulares «de la versión Enterprise» que hoy se marcan con un casillero en
 * Usuarios; por eso hay un test que cruza esta guía con el menú y las rutas.
 */

export const GUIDE_SECTIONS: GuideSection[] = [
  // ── Cómo funciona el sistema ──────────────────────────────────────────────
  {
    id: 'plataforma',
    title: 'Qué es y cómo está organizado',
    summary: 'Una cuenta por empresa, con sus sucursales, su equipo y su tienda pública. Nada se mezcla con otra empresa.',
    group: 'sistema',
    keywords: ['plataforma', 'empresa', 'organizacion', 'sucursal', 'multiempresa', 'que es', 'como funciona'],
    steps: [
      {
        title: 'Tu empresa es una organización',
        description: 'Todo lo que cargás —productos, ventas, clientes, usuarios— queda dentro de tu organización. Ninguna otra empresa del sistema ve tus datos, y vos no ves los de ellas.',
      },
      {
        title: 'Dentro de la empresa están las sucursales',
        description: 'Cada sucursal tiene su propio stock y sus propias cajas. Si tenés un solo local, trabajás con la sucursal principal y no necesitás tocar nada más.',
      },
      {
        title: 'Hay dos paneles y conviene no confundirlos',
        description: 'El panel de operación es el día a día: vender, cargar productos, atender clientes, pedidos y reparaciones. El panel de administración es para configurar y controlar: equipo, tienda, plan, reportes y seguridad.',
      },
      {
        title: 'Tu tienda pública es la cara al cliente',
        description: 'La misma información que cargás adentro alimenta tu tienda con enlace propio. Además podés aparecer en el Marketplace, el directorio donde los clientes descubren tiendas.',
      },
    ],
    examples: [
      {
        goal: 'Tengo dos locales y quiero saber cuánto vendió cada uno sin mezclar el stock',
        setup: [
          'Creás la segunda sucursal en Sucursales, con su dirección y teléfono.',
          'Asignás a cada vendedor a su sucursal desde Usuarios.',
          'Cada local abre su propia caja al empezar el día.',
        ],
        result: 'El stock se descuenta del local donde se vendió, y en Reportes podés ver las ventas de cada sucursal por separado.',
      },
    ],
    tips: [
      'Si una sección no aparece en tu menú, casi siempre es por el plan o por tus permisos, no por un error.',
    ],
  },
  {
    id: 'roles',
    title: 'Roles y permisos',
    summary: 'Quién puede hacer qué. El rol da el acceso base y los permisos por casillero lo ajustan persona por persona.',
    group: 'sistema',
    href: '/admin/users',
    keywords: ['rol', 'roles', 'permisos', 'propietario', 'administrador', 'vendedor', 'tecnico', 'acceso'],
    steps: [
      {
        title: 'Los roles que existen',
        description: 'Propietario: dueño de la cuenta, no se puede editar ni desactivar desde Usuarios. Administrador: entra al panel de administración completo. Vendedor: vende en el POS y trabaja con catálogo y clientes. Técnico: trabaja las reparaciones asignadas. Cliente: es quien compra en tu tienda, no tiene acceso al panel.',
      },
      {
        title: 'La propiedad se transfiere, no se asigna',
        description: 'No se puede poner a alguien como Propietario cambiándole el rol: hay que hacer una transferencia de propiedad. Es a propósito, para que nadie se quede afuera de su propia cuenta por un cambio de rol apurado.',
      },
      {
        title: 'Los permisos afinan el rol',
        description: 'Al editar una persona podés marcar permisos sueltos: ver costos, ver precios mayoristas, manejar promociones, cerrar caja, ver reportes. Sirve para el caso típico de un vendedor de confianza que además necesita una cosa más.',
      },
      {
        title: 'Los estados cortan el acceso sin borrar nada',
        description: 'Activo entra normalmente; inactivo y suspendido no pueden entrar, pero su historial de ventas y movimientos queda intacto. Es lo que corresponde cuando alguien deja el equipo: no se borra el usuario.',
      },
    ],
    examples: [
      {
        goal: 'Quiero que mi encargada vea los reportes de ventas pero no los costos de compra',
        setup: [
          'En Usuarios, la editás y le dejás el rol Vendedor.',
          'Le marcás el permiso de ver reportes.',
          'No le marcás el permiso de ver costos.',
        ],
        result: 'Ve cuánto se vendió y con qué margen de venta trabaja, sin ver a qué precio compraste la mercadería.',
      },
      {
        goal: 'Un vendedor dejó de trabajar conmigo',
        setup: [
          'En Usuarios lo buscás y lo pasás a inactivo.',
          'No lo elimines: sus ventas del año tienen que seguir figurando.',
        ],
        result: 'Deja de poder entrar al sistema desde ese momento, y los reportes siguen mostrando lo que vendió mientras estuvo.',
      },
    ],
    faq: [
      {
        question: '¿Por qué no puedo cambiarle el rol al Propietario?',
        answer: 'Porque perderías el control de la cuenta si te equivocás. El cambio se hace con una transferencia de propiedad, que es un paso aparte y explícito.',
      },
      {
        question: '¿Un técnico ve las ventas?',
        answer: 'No. Ve las reparaciones que tiene asignadas y su propio panel. Las ventas y la caja son del vendedor y del administrador.',
      },
    ],
  },
  {
    id: 'plan',
    title: 'Plan y módulos',
    summary: 'El plan define qué módulos tenés disponibles, y tu empresa puede apagar los que no usa para simplificar el menú.',
    group: 'sistema',
    href: '/admin/subscriptions',
    keywords: ['plan', 'modulo', 'modulos', 'suscripcion', 'no aparece', 'falta seccion', 'prueba'],
    steps: [
      {
        title: 'Un módulo es una parte del sistema',
        description: 'Inventario, POS, clientes, pedidos, tienda, reparaciones, servicios, promociones, créditos, analítica y seguridad son módulos. Tu plan incluye algunos.',
      },
      {
        title: 'Lo que el plan no trae no se muestra',
        description: 'Si el plan no incluye un módulo, su sección no aparece en el menú. No es que esté escondida: todavía no está contratada.',
      },
      {
        title: 'Tu empresa también puede apagar módulos',
        description: 'En la configuración del negocio podés desactivar módulos que sí tenés pero no usás. El menú queda más corto y nadie se pierde entre pantallas que no necesita.',
      },
    ],
    examples: [
      {
        goal: 'No aparece Analytics en mi menú y sé que existe',
        setup: [
          'Entrás a Suscripción y mirás qué plan tenés activo.',
          'Si el plan no incluye analítica, ahí mismo podés ver los planes que sí la traen.',
          'Si el plan la incluye, revisás la configuración del negocio: puede estar apagada.',
        ],
        result: 'Sabés si te falta plan o si simplemente está desactivada, sin tener que escribirle a nadie.',
      },
    ],
  },

  // ── Análisis ──────────────────────────────────────────────────────────────
  {
    id: 'overview',
    navKey: 'overview',
    title: 'Resumen',
    summary: 'La primera pantalla del panel: cómo viene el día y qué necesita atención ahora.',
    group: 'analytics',
    href: '/admin',
    keywords: ['resumen', 'inicio', 'panel', 'dashboard', 'hoy', 'metricas del dia'],
    steps: [
      {
        title: 'Lo de hoy, arriba',
        description: 'Ventas del día en monto y en cantidad de tickets, cajas abiertas, productos por debajo del stock mínimo y usuarios activos.',
      },
      {
        title: 'Los accesos rápidos',
        description: 'Desde el resumen entrás directo a las secciones que más se usan, sin recorrer el menú.',
      },
      {
        title: 'Los avisos se cuentan solos',
        description: 'Cuando el monitor de cajas tiene alertas sin resolver, el número aparece al lado de la sección en el menú.',
      },
    ],
    examples: [
      {
        goal: 'Abro el panel a la mañana y quiero saber en 10 segundos si algo anda mal',
        setup: [
          'Mirás si quedó alguna caja abierta de ayer.',
          'Mirás el número de alertas del monitor de cajas.',
          'Mirás los productos bajo stock mínimo.',
        ],
        result: 'Con esas tres cosas sabés si tenés que intervenir antes de abrir el local.',
      },
    ],
  },
  {
    id: 'finances',
    navKey: 'finances',
    title: 'Finanzas',
    summary: 'Gastos, nómina y rentabilidad: no solo lo que entró, también lo que salió y lo que queda.',
    group: 'analytics',
    href: '/admin/finances',
    permissions: ['finances.read'],
    keywords: ['finanzas', 'gastos', 'nomina', 'sueldos', 'rentabilidad', 'ganancia', 'devengado', 'caja'],
    steps: [
      {
        title: 'Cargás los gastos del negocio',
        description: 'Alquiler, servicios, mercadería, comisiones. Cada gasto queda con su fecha, su categoría y su comprobante.',
      },
      {
        title: 'La nómina va aparte',
        description: 'Los sueldos y los pagos al equipo se registran en su propio panel, para que el costo de personal no se pierda entre los gastos generales.',
      },
      {
        title: 'Dos miradas del mismo mes',
        description: 'Devengado muestra lo que corresponde al período, aunque todavía no se haya cobrado o pagado. Caja muestra la plata que efectivamente entró y salió. Las dos sirven, pero responden preguntas distintas.',
      },
    ],
    examples: [
      {
        goal: 'Vendí bien el mes pasado pero no me quedó plata y no entiendo por qué',
        setup: [
          'Entrás a Finanzas y mirás el mes en la vista de Caja.',
          'Comparás el total cobrado con los gastos y la nómina del mismo período.',
          'Revisás si hay ventas a crédito todavía sin cobrar.',
        ],
        result: 'Ves la diferencia entre lo que facturaste y lo que realmente entró, que es casi siempre de dónde viene esa sensación.',
      },
    ],
    tips: [
      'Cargá los gastos en el momento. Un mes reconstruido de memoria no sirve para decidir precios.',
    ],
  },
  {
    id: 'analytics',
    navKey: 'analytics',
    title: 'Analytics',
    summary: 'Análisis más profundo: tendencias, comparaciones entre períodos y rankings de productos y clientes.',
    group: 'analytics',
    href: '/admin/analytics',
    permissions: ['analytics.read'],
    module: 'analytics',
    keywords: ['analytics', 'analitica', 'tendencia', 'ranking', 'comparar', 'grafico'],
    steps: [
      {
        title: 'Mirá la tendencia, no el día',
        description: 'Un día flojo no dice nada; una tendencia de tres meses sí. Acá se ven los períodos comparados entre sí.',
      },
      {
        title: 'Rankings para decidir compras',
        description: 'Qué productos se mueven, cuáles quedan quietos y quiénes son tus mejores clientes.',
      },
    ],
    examples: [
      {
        goal: 'Quiero saber qué comprar para la próxima temporada',
        setup: [
          'Comparás los últimos tres meses contra los tres anteriores.',
          'Mirás el ranking de productos más vendidos.',
          'Cruzás con lo que hoy tenés bajo stock mínimo en Inventario.',
        ],
        result: 'Una lista de compra basada en lo que se vende de verdad, no en lo que parece que se vende.',
      },
    ],
  },

  // ── Operaciones ───────────────────────────────────────────────────────────
  {
    id: 'cash-monitor',
    navKey: 'cash-monitor',
    title: 'Monitor de cajas',
    summary: 'Qué está pasando en las cajas ahora y qué pasó en cada turno, con las diferencias marcadas.',
    group: 'operations',
    href: '/admin/cash-monitor',
    keywords: ['caja', 'cajas', 'turno', 'arqueo', 'cierre', 'diferencia', 'faltante', 'alerta', 'auditoria'],
    steps: [
      {
        title: 'Turnos',
        description: 'Cada apertura y cierre de caja queda registrada con quién la abrió, cuánto declaró al cerrar y qué diferencia hubo contra lo que el sistema esperaba.',
      },
      {
        title: 'En vivo',
        description: 'Las cajas abiertas en este momento, con su saldo. Sirve para ver si alguien se olvidó de cerrar.',
      },
      {
        title: 'Alertas',
        description: 'Las situaciones que hay que mirar: diferencias de arqueo, cajas abiertas demasiado tiempo, movimientos fuera de lo normal. El número de alertas sin resolver se ve en el menú.',
      },
      {
        title: 'Auditoría',
        description: 'El detalle de quién hizo cada movimiento sensible. Cuando hay un faltante, esto es lo que se revisa.',
      },
    ],
    examples: [
      {
        goal: 'Al cerrar faltaron Gs. 50.000 y quiero saber qué pasó',
        setup: [
          'Entrás al turno de esa caja en Turnos.',
          'Comparás el efectivo declarado con lo que registró el sistema.',
          'Revisás los movimientos del turno en Auditoría: retiros, anulaciones y descuentos.',
        ],
        result: 'Identificás si fue un retiro sin registrar, una anulación o un error de conteo, con nombre y hora.',
      },
    ],
    tips: [
      'Una caja que queda abierta de un día para el otro arrastra el error al día siguiente: cerrala siempre.',
    ],
  },
  {
    id: 'inventory',
    navKey: 'inventory',
    title: 'Inventario',
    summary: 'El catálogo y el stock: productos, variantes, movimientos, alertas de reposición y proveedores.',
    group: 'operations',
    href: '/admin/inventory',
    permissions: ['products.read'],
    module: 'inventory_admin',
    keywords: ['inventario', 'stock', 'producto', 'productos', 'variantes', 'talles', 'colores', 'proveedor', 'movimiento', 'reposicion'],
    steps: [
      {
        title: 'Un producto, sus precios y su stock',
        description: 'Cada producto tiene código de barras, categoría, marca, precio de compra, precio de venta y stock mínimo. El stock mínimo es el que dispara la alerta de reposición.',
      },
      {
        title: 'Variantes para lo que viene en versiones',
        description: 'Cuando el mismo producto se vende en talles, colores o capacidades, se cargan como variantes: el stock se controla por variante, no por producto suelto.',
      },
      {
        title: 'Movimientos: todo cambio queda anotado',
        description: 'Entradas por compra, salidas por venta, ajustes por conteo y transferencias entre sucursales. Si el stock no cuadra, la respuesta está en los movimientos.',
      },
      {
        title: 'Alertas de stock',
        description: 'La lista de lo que está por agotarse, que es la que conviene mirar antes de hacer un pedido al proveedor.',
      },
    ],
    examples: [
      {
        goal: 'Vendo remeras en cuatro talles y tres colores sin volverme loco',
        setup: [
          'Cargás un producto «Remera básica» con su precio.',
          'Definís los atributos talle y color.',
          'Generás las variantes y le pones el stock que tenés de cada combinación.',
        ],
        result: 'En el POS buscás una vez la remera y elegís talle y color; el stock se descuenta de esa combinación exacta.',
        vertical: 'clothing',
      },
      {
        goal: 'Cargar celulares con IMEI y controlar los accesorios por cantidad',
        setup: [
          'Los celulares se cargan como productos con su código, y el IMEI queda en la venta.',
          'Los accesorios se cargan con stock por cantidad y su stock mínimo.',
          'Ponés stock mínimo 3 en los cargadores que más rotan.',
        ],
        result: 'Los accesorios que se agotan aparecen solos en la lista de reposición, antes de quedarte sin nada para vender.',
        vertical: 'electronics',
      },
      {
        goal: 'Hice un conteo físico y el sistema dice otra cosa',
        setup: [
          'Cargás un ajuste de inventario con la cantidad real contada.',
          'Escribís el motivo: rotura, pérdida o error de carga.',
        ],
        result: 'El stock queda igual al del depósito, y el ajuste queda registrado con motivo, fecha y responsable.',
      },
    ],
  },
  {
    id: 'reports',
    navKey: 'reports',
    title: 'Reportes',
    summary: 'Lo que pasó, en listas que se pueden exportar: ventas, productos, clientes, cajeros, técnicos y rentabilidad.',
    group: 'operations',
    href: '/admin/reports',
    permissions: ['reports.read'],
    keywords: ['reporte', 'reportes', 'exportar', 'pdf', 'ventas', 'rentabilidad', 'cajeros', 'clientes', 'tecnicos'],
    steps: [
      {
        title: 'Elegís el período y el reporte',
        description: 'Ventas por día o por vendedor, productos más vendidos, clientes que más compran, cierres por cajero, trabajo por técnico, rentabilidad y movimientos de inventario.',
      },
      {
        title: 'Se exporta para compartir',
        description: 'Cada reporte se puede bajar en PDF, que es lo que sirve para el contador o para una reunión.',
      },
    ],
    examples: [
      {
        goal: 'El contador me pide las ventas del mes',
        setup: [
          'Entrás a Reportes y elegís el reporte de ventas.',
          'Seleccionás el mes cerrado.',
          'Exportás el PDF.',
        ],
        result: 'Un archivo con el detalle del mes, listo para enviar, sin armar nada a mano.',
      },
    ],
  },

  // ── Administración ────────────────────────────────────────────────────────
  {
    id: 'users',
    navKey: 'users',
    title: 'Usuarios',
    summary: 'Tu equipo y los clientes de la tienda, separados: a cada uno le corresponde ver una cosa distinta.',
    group: 'administration',
    href: '/admin/users',
    permissions: ['users.read'],
    keywords: ['usuario', 'usuarios', 'equipo', 'invitar', 'cliente', 'clientes', 'contacto', 'ultimo acceso', 'ultima compra'],
    steps: [
      {
        title: 'Invitás a alguien con su rol',
        description: 'Cargás el correo, elegís el rol y la persona recibe la invitación. Cuando entra por primera vez, ya tiene los accesos de ese rol.',
      },
      {
        title: 'La pestaña de clientes es otra cosa',
        description: 'Ahí están las personas que compran en tu tienda, no tu equipo. Por eso el correo y el teléfono aparecen tapados: se muestran de a uno, con el botón «Mostrar», y cada consulta queda registrada.',
      },
      {
        title: 'Cada población se mide distinto',
        description: 'Del equipo interesa el último acceso al sistema; de un cliente interesa la última compra. La columna cambia según la pestaña en la que estés.',
      },
      {
        title: 'La vista por rol es del equipo',
        description: 'El árbol por rol agrupa a las personas con acceso al panel. Los clientes no aparecen ahí, aunque sean cientos.',
      },
    ],
    examples: [
      {
        goal: 'Un cliente me escribe reclamando y quiero su teléfono para llamarlo',
        setup: [
          'Lo buscás en la pestaña Clientes.',
          'Toca «Mostrar» en su contacto.',
        ],
        result: 'Ves el teléfono completo para llamarlo, y queda registrado que vos lo consultaste, con fecha y hora.',
      },
      {
        goal: 'Sumo una vendedora nueva y no quiero que vea los costos',
        setup: [
          'La invitás con el rol Vendedor.',
          'Al editarla, dejás sin marcar el permiso de ver costos.',
          'Si tenés más de un local, la asignás a su sucursal.',
        ],
        result: 'Puede vender y consultar el catálogo con precios de venta, sin ver a cuánto compraste.',
      },
    ],
    faq: [
      {
        question: '¿Por qué un cliente figura sin último acceso?',
        answer: 'Porque nunca inició sesión: compró sin crearse una cuenta, o su cuenta es solo para el seguimiento del pedido. Eso no es un error.',
      },
    ],
  },
  {
    id: 'branches',
    navKey: 'branches',
    title: 'Sucursales',
    summary: 'Cada local con su dirección, su stock, sus cajas y su gente. Con un solo local casi no hace falta tocarla.',
    group: 'administration',
    href: '/admin/branches',
    permissions: ['settings.read'],
    keywords: ['sucursal', 'sucursales', 'local', 'deposito', 'transferencia', 'cobertura'],
    steps: [
      {
        title: 'La sucursal principal ya existe',
        description: 'Tu cuenta arranca con una sucursal por defecto. Si tenés un solo local, con completarle dirección y teléfono alcanza.',
      },
      {
        title: 'Cada sucursal tiene su stock',
        description: 'El mismo producto puede tener 5 unidades en un local y ninguna en el otro. Las transferencias mueven stock de una a otra y quedan registradas.',
      },
      {
        title: 'La gente se asigna a su local',
        description: 'Un vendedor asignado a una sucursal trabaja con el stock y la caja de esa sucursal, y así los reportes por local tienen sentido.',
      },
    ],
    examples: [
      {
        goal: 'Abro un segundo local y quiero pasarle mercadería del primero',
        setup: [
          'Creás la sucursal nueva con su dirección y teléfono.',
          'Hacés una transferencia de stock del local viejo al nuevo.',
          'Asignás al vendedor del local nuevo a esa sucursal.',
        ],
        result: 'El stock queda donde está la mercadería de verdad, y cada local vende de lo suyo.',
      },
    ],
  },
  {
    id: 'website',
    navKey: 'website',
    title: 'Sitio web público',
    summary: 'Tu tienda: los datos de la empresa, la portada, las formas de pago y entrega, y si está publicada o no.',
    group: 'administration',
    href: '/admin/website',
    permissions: ['settings.read'],
    keywords: ['tienda', 'sitio web', 'publicar', 'marketplace', 'whatsapp', 'carrito', 'portada', 'logo', 'pagos', 'delivery'],
    steps: [
      {
        title: 'Empezá por Empresa',
        description: 'Nombre, logo, teléfono, WhatsApp con código de país, dirección y horarios. Es lo que el cliente usa para ubicarte y escribirte.',
      },
      {
        title: 'Después, pagos y entregas',
        description: 'Qué medios de pago aceptás y si entregás a domicilio o el cliente retira. Si activás transferencia o billetera, cargá los datos: sin eso el cliente no sabe a dónde pagar.',
      },
      {
        title: 'Elegí cómo compran',
        description: 'Por consulta de WhatsApp, que abre un mensaje sobre el producto, o con carrito. Las cuentas nuevas arrancan por WhatsApp, que es lo que casi siempre funciona mejor al principio.',
      },
      {
        title: 'Publicar es una decisión aparte',
        description: '«Publicar tienda» habilita tu enlace propio. La visibilidad en el Marketplace es otro interruptor: además te hace aparecer en el directorio general. Si ocultás la tienda, se apaga también el Marketplace y los enlaces públicos, pero no se borra nada.',
      },
    ],
    examples: [
      {
        goal: 'Quiero que mis clientes vean el catálogo y me escriban por WhatsApp',
        setup: [
          'En Empresa completás nombre, teléfono y WhatsApp con el 595.',
          'En Pagos y entregas elegís la modalidad de consulta por WhatsApp.',
          'Activás «Publicar tienda» y guardás.',
        ],
        result: 'Tenés un enlace para compartir en tu perfil de Instagram; cada producto abre un mensaje de WhatsApp con la consulta ya escrita.',
      },
      {
        goal: 'Estoy rearmando la tienda y no quiero que nadie la vea así',
        setup: [
          'Desactivás «Publicar tienda» y guardás.',
        ],
        result: 'El enlace deja de estar accesible y sale del Marketplace. Tus productos, pedidos y datos siguen intactos, y podés seguir trabajando adentro.',
      },
    ],
    tips: [
      'Una portada llena no publica la tienda: la publicación es ese interruptor y nada más.',
    ],
  },
  {
    id: 'reviews',
    navKey: 'reviews',
    title: 'Reseñas',
    summary: 'Lo que los clientes opinan de tus productos, y qué se muestra en la tienda.',
    group: 'administration',
    href: '/admin/reviews',
    permissions: ['settings.read'],
    keywords: ['reseña', 'reseñas', 'opinion', 'calificacion', 'estrellas', 'moderar', 'reportada'],
    steps: [
      {
        title: 'Primero pasan por pendientes',
        description: 'Una reseña nueva no sale publicada sola: queda esperando que la revises.',
      },
      {
        title: 'Publicás, ocultás o rechazás',
        description: 'Publicada se ve en la tienda; oculta se guarda sin mostrarse; rechazada queda descartada. Las reportadas son las que alguien marcó como problemáticas.',
      },
    ],
    examples: [
      {
        goal: 'Me dejaron una reseña de 2 estrellas por una demora en el envío',
        setup: [
          'La leés en Pendientes.',
          'Si el reclamo es real, la publicás y resolvés el problema con el cliente.',
        ],
        result: 'Tu tienda muestra opiniones creíbles en lugar de un cinco perfecto que nadie cree, y el cliente ve que lo escuchaste.',
      },
    ],
  },
  {
    id: 'subscriptions',
    navKey: 'subscriptions',
    title: 'Suscripción',
    summary: 'Tu plan, lo que incluye, los límites y los pagos.',
    group: 'administration',
    href: '/admin/subscriptions',
    permissions: ['billing.manage'],
    keywords: ['plan', 'suscripcion', 'pago', 'factura', 'limite', 'cambiar plan', 'prueba'],
    steps: [
      {
        title: 'Qué plan tenés y hasta cuándo',
        description: 'El estado de la suscripción, los días que quedan del período y los módulos que incluye.',
      },
      {
        title: 'Los límites del plan',
        description: 'Cada plan tiene un techo de usuarios y de productos. Cuando estás cerca conviene saberlo antes de chocar con el límite en medio de una carga.',
      },
      {
        title: 'Los pagos quedan registrados',
        description: 'El historial de pagos y comprobantes está en la misma sección, para no tener que buscarlo en el chat.',
      },
    ],
    examples: [
      {
        goal: 'Quiero sumar dos vendedores y no sé si mi plan me deja',
        setup: [
          'Entrás a Suscripción y mirás el límite de usuarios contra los que ya tenés.',
          'Si no alcanza, comparás los planes ahí mismo.',
        ],
        result: 'Sabés si podés invitarlos ahora o si primero te conviene cambiar de plan.',
      },
    ],
  },
  {
    id: 'security',
    navKey: 'security',
    title: 'Seguridad',
    summary: 'Quién entró, desde dónde y qué acciones sensibles se hicieron en tu cuenta.',
    group: 'administration',
    href: '/admin/security',
    permissions: ['settings.read'],
    module: 'security',
    keywords: ['seguridad', 'auditoria', 'log', 'acceso', 'sospechoso', 'historial'],
    steps: [
      {
        title: 'Registro de accesos',
        description: 'Los ingresos al sistema y los intentos fallidos, con fecha y hora.',
      },
      {
        title: 'Acciones administrativas',
        description: 'Cambios de rol, bajas de usuario, consultas de contacto de clientes y otras acciones que conviene poder reconstruir después.',
      },
    ],
    examples: [
      {
        goal: 'Alguien cambió un precio y nadie sabe quién',
        setup: [
          'Entrás a Seguridad y filtrás por la fecha en que apareció el cambio.',
          'Buscás las acciones sobre ese producto.',
        ],
        result: 'Sale el usuario y la hora exacta, y la conversación deja de ser sobre suposiciones.',
      },
    ],
  },
  {
    id: 'settings',
    navKey: 'settings',
    title: 'Configuración',
    summary: 'Los datos de la empresa, cómo opera y cómo se ve el panel.',
    group: 'administration',
    href: '/admin/settings',
    permissions: ['settings.read'],
    keywords: ['configuracion', 'ajustes', 'empresa', 'moneda', 'impuesto', 'apariencia', 'ticket'],
    steps: [
      {
        title: 'Empresa',
        description: 'Razón social, RUC, datos de contacto y lo que sale impreso en los tickets.',
      },
      {
        title: 'Operación',
        description: 'Moneda, zona horaria e impuestos: definen cómo se calcula y cómo se muestra cada monto del sistema.',
      },
      {
        title: 'Apariencia',
        description: 'Tema claro u oscuro y preferencias de la interfaz para quien usa el panel todo el día.',
      },
    ],
    examples: [
      {
        goal: 'Los tickets salen sin mi RUC',
        setup: [
          'Entrás a Configuración, pestaña Empresa.',
          'Cargás el RUC y la razón social y guardás.',
        ],
        result: 'Los tickets nuevos salen con los datos fiscales completos.',
      },
    ],
  },
  {
    id: 'business-profile',
    navKey: 'business-profile',
    title: 'Configuración del negocio',
    summary: 'El rubro, el modelo de operación y los módulos activos. Es lo primero que se completa y lo que ordena el resto.',
    group: 'administration',
    href: '/dashboard/onboarding',
    permissions: ['settings.read'],
    keywords: ['onboarding', 'rubro', 'primeros pasos', 'configuracion inicial', 'modelo', 'modulos', 'moneda'],
    steps: [
      {
        title: 'El rubro define los valores por defecto',
        description: 'Elegir bien el rubro —ropa, electrónica, alimentos, ferretería— hace que arranques con categorías y textos de tienda que tienen sentido para tu negocio en lugar de genéricos.',
      },
      {
        title: 'El modelo de operación enciende los módulos',
        description: 'Venta al público, mayorista, servicios, taller o mixto. Según eso el sistema propone los módulos que vas a usar de verdad.',
      },
      {
        title: 'Se puede volver a entrar cuando quieras',
        description: 'No es un formulario de una sola vez: si cambiás de rubro o sumás un módulo, entrás de nuevo y lo ajustás.',
      },
    ],
    examples: [
      {
        goal: 'Empecé vendiendo accesorios y ahora también hago reparaciones',
        setup: [
          'Entrás a Configuración del negocio.',
          'Cambiás el modelo de operación a mixto.',
          'Activás el módulo de reparaciones.',
        ],
        result: 'Aparecen las pantallas de órdenes de reparación y técnicos, sin tocar nada de lo que ya tenías cargado.',
      },
    ],
  },
]

/** Todas las secciones que corresponden a una pantalla del menú del admin. */
export const GUIDE_NAV_KEYS: readonly string[] = GUIDE_SECTIONS
  .map((section) => section.navKey)
  .filter((key): key is string => typeof key === 'string')

export function guideSectionById(id: string): GuideSection | undefined {
  return GUIDE_SECTIONS.find((section) => section.id === id)
}

export function guideSectionByNavKey(navKey: string): GuideSection | undefined {
  return GUIDE_SECTIONS.find((section) => section.navKey === navKey)
}
