// ─── Tipos ────────────────────────────────────────────────────────────────────
export type GuideStep = {
  question: string
  answer: string
}

export type GuideSection = {
  title: string
  icon: string
  steps: GuideStep[]
}

export type Guide = {
  title: string
  subtitle: string
  sections: GuideSection[]
}

// ─── Guía completa del sistema ────────────────────────────────────────────────
export const systemGuide: Guide = {
  title: 'Guía del sistema',
  subtitle: 'Todo lo que necesitás saber para operar la plataforma',
  sections: [
    {
      title: '¿Qué es esta plataforma?',
      icon: '🏢',
      steps: [
        {
          question: '¿Para qué sirve?',
          answer:
            'Es una plataforma de gestión multiempresa que centraliza ventas en caja (POS), inventario, órdenes de reparación, catálogo público, pedidos y reportes. Cada empresa opera en un espacio aislado con sus propios datos, usuarios y configuración.',
        },
        {
          question: '¿Cuáles son los módulos disponibles?',
          answer:
            'POS (punto de venta), Inventario, Reparaciones, Catálogo/Ecommerce, Pedidos y Delivery, Clientes y CRM, Reportes y Analytics, Marketplace global. Cada módulo se activa según el plan contratado.',
        },
        {
          question: '¿Qué son las organizaciones?',
          answer:
            'Una organización es tu empresa dentro del sistema. Podés tener múltiples sucursales dentro de una organización. Cada organización tiene usuarios propios, productos propios y datos completamente separados de otras organizaciones.',
        },
      ],
    },
    {
      title: 'Primeros pasos',
      icon: '🚀',
      steps: [
        {
          question: '¿Cómo empiezo a vender?',
          answer:
            'Primero cargá tus productos en Inventario → Productos. Luego abrí el módulo POS para hacer ventas en caja. Podés usar búsqueda rápida por nombre, código de barras o categoría.',
        },
        {
          question: '¿Cómo agrego usuarios a mi equipo?',
          answer:
            'Vas a Administración → Usuarios y enviás una invitación por email. Asignás el rol: Admin (acceso total), Vendedor (POS e inventario), Técnico (reparaciones), Solo lectura.',
        },
        {
          question: '¿Cómo configuro las sucursales?',
          answer:
            'En Administración → Sucursales creás cada local. Cada sucursal tiene su propio stock y caja. Los usuarios se asignan a una o más sucursales según su rol.',
        },
      ],
    },
    {
      title: 'POS y Caja',
      icon: '🛒',
      steps: [
        {
          question: '¿Cómo hago una venta?',
          answer:
            'Abrí el módulo POS, buscá los productos por nombre o escaneá el código de barras, agregálos al carrito, seleccioná el método de pago (efectivo, tarjeta, transferencia, mixto) y confirmá la venta.',
        },
        {
          question: '¿Cómo funciona el cierre de caja?',
          answer:
            'Al final del turno vas a POS → Caja y hacés el cierre. El sistema registra el total vendido, el efectivo declarado y calcula la diferencia. Ese reporte queda guardado en Reportes.',
        },
        {
          question: '¿Se puede hacer una venta con descuento?',
          answer:
            'Sí. En el carrito podés aplicar descuento por ítem o descuento global sobre el total. También podés usar promociones configuradas en el módulo de Promociones.',
        },
      ],
    },
    {
      title: 'Inventario',
      icon: '📦',
      steps: [
        {
          question: '¿Cómo cargo un producto?',
          answer:
            'Vas a Productos → Nuevo producto. Completás nombre, categoría, precio de costo, precio de venta y stock inicial. Podés agregar imágenes, código de barras, variantes (talle, color) y activar la publicación en el catálogo público.',
        },
        {
          question: '¿Cómo controlo el stock mínimo?',
          answer:
            'En cada producto configurás el "stock mínimo". Cuando el stock cae por debajo de ese valor el sistema genera una alerta automática en el panel. También se ve en el módulo de Alertas de inventario.',
        },
        {
          question: '¿Puedo mover stock entre sucursales?',
          answer:
            'Sí. En Inventario → Transferencias creás un movimiento desde una sucursal origen a una sucursal destino. El sistema registra el historial de cada movimiento.',
        },
      ],
    },
    {
      title: 'Reparaciones',
      icon: '🔧',
      steps: [
        {
          question: '¿Cómo funciona el flujo de una reparación?',
          answer:
            'El ciclo es: Recibido → Diagnóstico → En reparación → Listo → Entregado. Cada cambio de estado queda registrado con fecha y técnico. El cliente puede ver el estado en tiempo real con el link de seguimiento público.',
        },
        {
          question: '¿Cómo asigno un técnico?',
          answer:
            'Al crear o editar una orden de reparación, en el campo "Técnico asignado" seleccionás al usuario con rol Técnico. Desde Reparaciones → Técnicos podés ver la carga de trabajo de cada uno.',
        },
        {
          question: '¿Cómo se comunica el cliente?',
          answer:
            'Al crear la orden se puede enviar un link de seguimiento por WhatsApp o email. El cliente accede sin login y ve el estado actual, dispositivo ingresado y técnico asignado.',
        },
      ],
    },
    {
      title: 'Catálogo y Pedidos',
      icon: '🌐',
      steps: [
        {
          question: '¿Cómo publico mis productos online?',
          answer:
            'Activá la opción "Publicar en catálogo" en cada producto. Automáticamente aparecen en tu página pública. La URL es tudominio.com/[tu-empresa]. El catálogo se sincroniza en tiempo real con el stock del POS.',
        },
        {
          question: '¿Cómo recibo un pedido online?',
          answer:
            'Los pedidos llegan a Pedidos → Bandeja de entrada. Podés aceptarlos, prepararlos y marcarlos como listos para retirar o para delivery. El cliente recibe notificaciones automáticas por cada cambio de estado.',
        },
      ],
    },
    {
      title: 'Reportes',
      icon: '📊',
      steps: [
        {
          question: '¿Qué reportes están disponibles?',
          answer:
            'Ventas por período, ventas por producto, ventas por sucursal, rendimiento de técnicos, historial de caja, rotación de inventario y resumen de pedidos.',
        },
        {
          question: '¿Puedo exportar los datos?',
          answer:
            'Sí. En cada reporte hay un botón de exportar a CSV o Excel. También podés filtrar por rango de fechas, sucursal y categoría antes de exportar.',
        },
      ],
    },
    {
      title: 'Roles y permisos',
      icon: '🔐',
      steps: [
        {
          question: '¿Qué puede hacer cada rol?',
          answer:
            'Admin: acceso completo a todo el panel. Vendedor: POS, inventario y clientes. Técnico: reparaciones asignadas y panel técnico. Solo lectura: ve datos pero no puede modificar nada.',
        },
        {
          question: '¿Se pueden personalizar los permisos?',
          answer:
            'Los permisos base son por rol. En la versión Enterprise podés activar permisos granulares por módulo y sucursal. Contactá soporte para activar esta función.',
        },
      ],
    },
  ],
}

// ─── Guías por sección ────────────────────────────────────────────────────────
export const sectionGuides: Record<string, Guide> = {
  overview: {
    title: 'Panel principal',
    subtitle: 'Visión general de tu negocio en tiempo real',
    sections: [
      {
        title: 'Métricas del día',
        icon: '📈',
        steps: [
          {
            question: '¿Qué muestran las tarjetas de estadísticas?',
            answer:
              'Ventas del día, órdenes de reparación activas, productos con stock bajo y pedidos pendientes. Los valores se actualizan cada vez que entrás o recargás el panel.',
          },
          {
            question: '¿Cómo interpreto el gráfico de ventas?',
            answer:
              'El gráfico muestra la evolución de ventas de los últimos 7 días. Una barra más alta indica un día con más facturación. Pasá el mouse sobre cada barra para ver el detalle.',
          },
        ],
      },
      {
        title: 'Acceso rápido',
        icon: '⚡',
        steps: [
          {
            question: '¿Cómo navego entre secciones?',
            answer:
              'Usá el menú lateral (sidebar) para ir a cualquier módulo. En mobile lo abrís con el ícono de hamburguesa ≡ en el encabezado. También podés usar Ctrl+K para buscar cualquier sección o registro.',
          },
          {
            question: '¿Para qué sirve el buscador global?',
            answer:
              'Con Ctrl+K (o ⌘K en Mac) abrís la búsqueda global. Podés buscar productos, clientes, reparaciones o navegar directamente a cualquier sección del panel escribiendo su nombre.',
          },
        ],
      },
    ],
  },

  repairs: {
    title: 'Reparaciones',
    subtitle: 'Gestión completa del ciclo de vida de cada orden técnica',
    sections: [
      {
        title: 'Crear una orden',
        icon: '➕',
        steps: [
          {
            question: '¿Cómo registro una nueva reparación?',
            answer:
              'Hacé clic en "Nueva reparación". Completá los datos del cliente (podés buscarlo si ya existe), el dispositivo (marca, modelo, problema), el técnico asignado y la prioridad. Guardá para generar el ticket.',
          },
          {
            question: '¿Qué datos son obligatorios?',
            answer:
              'Cliente, tipo de dispositivo y descripción del problema. El resto (técnico, costo estimado, número de serie) es opcional pero recomendado para un seguimiento completo.',
          },
          {
            question: '¿Puedo agregar fotos o archivos?',
            answer:
              'Sí. En el formulario de reparación hay una sección para adjuntar imágenes del estado del equipo al ingreso. Esto queda registrado en el historial de la orden.',
          },
        ],
      },
      {
        title: 'Estados del flujo',
        icon: '🔄',
        steps: [
          {
            question: '¿Cuáles son los estados posibles?',
            answer:
              'Recibido → Diagnóstico → En reparación → Pausado → Listo → Entregado → Cancelado. Cada estado tiene un color distinto en la lista para identificarlo rápidamente.',
          },
          {
            question: '¿Cómo cambio el estado de una orden?',
            answer:
              'Abrí la orden y usá el botón de cambio de estado en la parte superior. El sistema registra automáticamente la fecha y hora de cada transición.',
          },
          {
            question: '¿Qué significa "Pausado"?',
            answer:
              'Una reparación se pausa cuando está esperando un repuesto o falta información del cliente. No cuenta como atrasada mientras esté en este estado.',
          },
        ],
      },
      {
        title: 'Prioridades y urgencias',
        icon: '🚨',
        steps: [
          {
            question: '¿Cuál es la diferencia entre prioridad y urgencia?',
            answer:
              'La prioridad (Alta / Media / Baja) la define el técnico o admin según el tipo de trabajo. La urgencia es una bandera especial que resalta la orden en rojo y la lleva al tope de la lista.',
          },
          {
            question: '¿Qué pasa con las órdenes atrasadas?',
            answer:
              'Una orden se marca como "Atrasada" cuando lleva más de 7 días en estado activo sin ser entregada. Aparece con borde naranja en la lista y en el panel del técnico.',
          },
        ],
      },
      {
        title: 'Comunicación con el cliente',
        icon: '💬',
        steps: [
          {
            question: '¿Cómo comparte el cliente el link de seguimiento?',
            answer:
              'En la orden hay un botón "Compartir seguimiento". Genera un link único que el cliente puede abrir sin login y ver el estado actual, el técnico asignado y las notas visibles.',
          },
          {
            question: '¿Puedo enviar el link por WhatsApp?',
            answer:
              'Sí. El botón de WhatsApp genera un mensaje pre-armado con el link de seguimiento y el estado actual. Solo necesitás tener el número del cliente cargado en la orden.',
          },
        ],
      },
    ],
  },

  technicians: {
    title: 'Técnicos',
    subtitle: 'Vista de carga de trabajo y rendimiento del equipo técnico',
    sections: [
      {
        title: 'Lista de técnicos',
        icon: '👷',
        steps: [
          {
            question: '¿Qué indica el indicador de carga?',
            answer:
              'El círculo de color junto al avatar indica el nivel de carga: Verde = sin carga, Azul = carga normal, Naranja = carga alta, Rojo = sobrecargado. Se calcula en base a las reparaciones activas asignadas.',
          },
          {
            question: '¿Qué significa la eficiencia?',
            answer:
              'La eficiencia combina la tasa de completado (% de reparaciones terminadas sobre el total) y la tasa de entrega a tiempo (% entregadas dentro de los plazos). 100% es la eficiencia máxima.',
          },
          {
            question: '¿Cómo filtro la lista?',
            answer:
              'Podés filtrar por nivel de carga (sin carga, normal, alta, sobrecargado) y ordenar por nombre, trabajos activos o trabajos completados. También hay búsqueda por nombre o especialidad.',
          },
        ],
      },
      {
        title: 'Vista de detalle',
        icon: '🔍',
        steps: [
          {
            question: '¿Qué información muestra el detalle de un técnico?',
            answer:
              'Header con métricas clave (total de trabajos, activos, tasa a tiempo, valor entregado), tab de Trabajos Activos con filtros, tab de Historial con tabla de completados, y tab de Analytics con gráficos de tendencia.',
          },
          {
            question: '¿Cómo asigno un trabajo desde el detalle?',
            answer:
              'Usá el botón "Asignar" en el encabezado. Te lleva directamente al formulario de nueva reparación con ese técnico pre-seleccionado.',
          },
          {
            question: '¿Qué muestra el tab Analytics?',
            answer:
              'Gráfico de tendencia semanal (completados y valor entregado), distribución por estado, análisis por prioridad (cantidad y tiempo promedio) y resumen de rendimiento con métricas de eficiencia.',
          },
        ],
      },
    ],
  },

  products: {
    title: 'Productos e inventario',
    subtitle: 'Control de stock, precios y catálogo de tu empresa',
    sections: [
      {
        title: 'Alta de productos',
        icon: '➕',
        steps: [
          {
            question: '¿Cómo agrego un producto nuevo?',
            answer:
              'Hacé clic en "Nuevo producto". Completá nombre, categoría, precio de costo y precio de venta. El campo "Stock inicial" define la cantidad disponible al crear. Podés agregar código de barras para escanearlo en el POS.',
          },
          {
            question: '¿Qué son las variantes?',
            answer:
              'Las variantes te permiten tener un mismo producto en distintas versiones (ej: iPhone 14 en colores negro, blanco, azul). Cada variante tiene su propio stock y precio.',
          },
          {
            question: '¿Cómo publico un producto en el catálogo?',
            answer:
              'En el formulario del producto activá el switch "Publicar en catálogo público". Inmediatamente aparece en tu página de empresa. Podés ocultarlo sin borrarlo desactivando ese switch.',
          },
        ],
      },
      {
        title: 'Stock y alertas',
        icon: '⚠️',
        steps: [
          {
            question: '¿Cómo configuro el stock mínimo?',
            answer:
              'En cada producto hay un campo "Stock mínimo". Cuando el stock cae por debajo de ese número el sistema genera una alerta. Lo ves en el ícono de campana del header y en el módulo de Alertas de inventario.',
          },
          {
            question: '¿Cómo ajusto el stock manualmente?',
            answer:
              'En la lista de productos, hacé clic en el ícono de editar stock. Podés sumar o restar unidades e indicar el motivo (compra, pérdida, ajuste). El historial de movimientos queda registrado.',
          },
        ],
      },
    ],
  },

  pos: {
    title: 'Punto de Venta (POS)',
    subtitle: 'Ventas rápidas, pagos y gestión de caja',
    sections: [
      {
        title: 'Hacer una venta',
        icon: '💳',
        steps: [
          {
            question: '¿Cómo agrego productos al carrito?',
            answer:
              'Buscá el producto por nombre en el buscador o escaneá el código de barras. También podés navegar por categorías. Hacé clic en el producto para agregarlo al carrito. Podés ajustar la cantidad directamente en el carrito.',
          },
          {
            question: '¿Cómo proceso el pago?',
            answer:
              'Una vez armado el carrito, hacé clic en "Cobrar". Seleccioná el método de pago: Efectivo (el sistema calcula el vuelto), Tarjeta, Transferencia o una combinación de métodos. Confirmá para finalizar la venta.',
          },
          {
            question: '¿Puedo aplicar descuentos?',
            answer:
              'Sí. En el carrito hay un campo de descuento por porcentaje o monto fijo. Podés aplicarlo al total de la venta o a ítems específicos. El descuento queda registrado en el reporte de la venta.',
          },
        ],
      },
      {
        title: 'Gestión de caja',
        icon: '🏦',
        steps: [
          {
            question: '¿Cómo abro la caja al inicio del día?',
            answer:
              'En POS → Caja hacés la apertura declarando el efectivo inicial (fondo de caja). A partir de ahí todas las ventas en efectivo se suman a ese fondo.',
          },
          {
            question: '¿Cómo hago el cierre de caja?',
            answer:
              'Al final del turno vas a POS → Caja → Cerrar. Declarás el efectivo que hay físicamente en la caja. El sistema calcula la diferencia entre lo declarado y lo esperado según las ventas registradas.',
          },
        ],
      },
    ],
  },

  reports: {
    title: 'Reportes y Analytics',
    subtitle: 'Métricas para tomar decisiones informadas',
    sections: [
      {
        title: 'Reportes de ventas',
        icon: '📊',
        steps: [
          {
            question: '¿Cómo veo las ventas de un período?',
            answer:
              'En Reportes seleccionás el tipo "Ventas", elegís el rango de fechas y la sucursal. El gráfico muestra la evolución diaria y la tabla lista cada venta con detalle de productos, monto y método de pago.',
          },
          {
            question: '¿Puedo comparar períodos?',
            answer:
              'Sí. En el selector de fechas podés activar "Comparar con período anterior" para ver el crecimiento o caída respecto a la semana, mes o año anterior.',
          },
        ],
      },
      {
        title: 'Exportar datos',
        icon: '⬇️',
        steps: [
          {
            question: '¿Cómo exporto un reporte?',
            answer:
              'Cada reporte tiene un botón "Exportar" en la esquina superior derecha. Podés elegir formato CSV (para Excel) o PDF. El archivo se descarga directamente.',
          },
        ],
      },
    ],
  },
}
