import type { NotificationType } from '../types'

export interface NotificationContent {
  title: string
  body: string
  defaultResourceType?: string
}

type ContentGenerator = {
  title: string
  defaultBody: string
  defaultResourceType?: string
  formatBody?: (data?: Record<string, unknown>) => string
}

/**
 * Catálogo centralizado de presentación y redacción de notificaciones operativas.
 * Genera textos seguros para pantallas de bloqueo sin exponer datos sensibles de clientes.
 */
const NOTIFICATION_PRESENTATION_MAP: Record<NotificationType, ContentGenerator> = {
  // Ventas (POS)
  SALE_CREATED: {
    title: 'Nueva venta',
    defaultBody: 'Se registró una nueva venta.',
    defaultResourceType: 'sale',
    formatBody: (data) => {
      if (typeof data?.totalFormatted === 'string') {
        return `Se registró una venta de ${data.totalFormatted}.`
      }
      return 'Se registró una nueva venta.'
    },
  },
  SALE_VOIDED: {
    title: 'Venta anulada',
    defaultBody: 'Se anuló un comprobante de venta.',
    defaultResourceType: 'sale',
  },
  SALE_RETURNED: {
    title: 'Devolución registrada',
    defaultBody: 'Se registró una devolución de venta.',
    defaultResourceType: 'sale',
  },
  LARGE_SALE: {
    title: 'Venta destacada',
    defaultBody: 'Se registró una venta por un monto relevante.',
    defaultResourceType: 'sale',
    formatBody: (data) => {
      if (typeof data?.totalFormatted === 'string') {
        return `Venta destacada registrada: ${data.totalFormatted}.`
      }
      return 'Se registró una venta por un monto relevante.'
    },
  },

  // Pedidos
  ORDER_CREATED: {
    title: 'Nuevo pedido',
    defaultBody: 'Se ingresó un nuevo pedido.',
    defaultResourceType: 'order',
  },
  ORDER_CONFIRMED: {
    title: 'Pedido confirmado',
    defaultBody: 'Un pedido fue confirmado.',
    defaultResourceType: 'order',
  },
  ORDER_READY: {
    title: 'Pedido listo',
    defaultBody: 'El pedido está listo para entrega o retiro.',
    defaultResourceType: 'order',
  },
  ORDER_CANCELLED: {
    title: 'Pedido cancelado',
    defaultBody: 'Un pedido fue cancelado.',
    defaultResourceType: 'order',
  },
  ORDER_OVERDUE: {
    title: 'Pedido demorado',
    defaultBody: 'Un pedido ha superado la fecha límite de entrega.',
    defaultResourceType: 'order',
  },
  NEW_ONLINE_ORDER: {
    title: 'Nuevo pedido online',
    defaultBody: 'Se recibió un pedido desde la tienda online.',
    defaultResourceType: 'order',
  },

  // Taller y Reparaciones
  REPAIR_CREATED: {
    title: 'Nueva orden de reparación',
    defaultBody: 'Se ingresó un nuevo equipo al taller.',
    defaultResourceType: 'repair',
  },
  REPAIR_ASSIGNED: {
    title: 'Reparación asignada',
    defaultBody: 'Te asignaron una orden de servicio técnico.',
    defaultResourceType: 'repair',
    formatBody: (data) => {
      if (typeof data?.ticketNumber === 'string') {
        return `Te asignaron la orden de reparación #${data.ticketNumber}.`
      }
      return 'Te asignaron una orden de servicio técnico.'
    },
  },
  REPAIR_STATUS_CHANGED: {
    title: 'Actualización de reparación',
    defaultBody: 'Cambió el estado de una reparación en el taller.',
    defaultResourceType: 'repair',
  },
  REPAIR_READY: {
    title: 'Reparación lista',
    defaultBody: 'Un equipo en el taller está listo para ser entregado.',
    defaultResourceType: 'repair',
  },
  REPAIR_OVERDUE: {
    title: 'Reparación demorada',
    defaultBody: 'Una orden de reparación superó el tiempo estimado de entrega.',
    defaultResourceType: 'repair',
  },
  REPAIR_NOTE_ADDED: {
    title: 'Nueva nota de reparación',
    defaultBody: 'Se agregó una nota técnica a una orden de reparación.',
    defaultResourceType: 'repair',
  },

  // Reservas y Turnos
  BOOKING_CREATED: {
    title: 'Nueva reserva',
    defaultBody: 'Se agendó un nuevo turno o reserva de servicio.',
    defaultResourceType: 'booking',
  },
  BOOKING_CONFIRMED: {
    title: 'Reserva confirmada',
    defaultBody: 'Una reserva fue confirmada.',
    defaultResourceType: 'booking',
  },
  BOOKING_CANCELLED: {
    title: 'Reserva cancelada',
    defaultBody: 'Una reserva fue cancelada.',
    defaultResourceType: 'booking',
  },
  BOOKING_RESCHEDULED: {
    title: 'Reserva reprogramada',
    defaultBody: 'Se modificó el horario o fecha de una reserva.',
    defaultResourceType: 'booking',
  },
  BOOKING_REMINDER: {
    title: 'Recordatorio de reserva',
    defaultBody: 'Tenés una reserva programada próximamente.',
    defaultResourceType: 'booking',
  },
  BOOKING_NO_SHOW: {
    title: 'Reserva no asistida',
    defaultBody: 'Un cliente no se presentó a su turno agendado.',
    defaultResourceType: 'booking',
  },

  // Inventario y Stock
  LOW_STOCK: {
    title: 'Stock bajo',
    defaultBody: 'Uno o más productos alcanzaron el nivel mínimo de existencias.',
    defaultResourceType: 'product',
    formatBody: (data) => {
      if (typeof data?.productName === 'string') {
        return `El producto "${data.productName}" alcanzó el stock mínimo.`
      }
      return 'Uno o más productos alcanzaron el nivel mínimo de existencias.'
    },
  },
  OUT_OF_STOCK: {
    title: 'Producto agotado',
    defaultBody: 'Un producto se ha quedado sin stock.',
    defaultResourceType: 'product',
  },
  VARIANT_LOW_STOCK: {
    title: 'Variante con stock bajo',
    defaultBody: 'Una variante específica alcanzó el nivel mínimo de existencias.',
    defaultResourceType: 'product',
  },
  STOCK_ADJUSTMENT: {
    title: 'Ajuste de inventario',
    defaultBody: 'Se registró un ajuste manual de stock en el inventario.',
    defaultResourceType: 'product',
  },

  // Caja y Tesorería
  CASH_REGISTER_OPENED: {
    title: 'Caja abierta',
    defaultBody: 'Se realizó la apertura de una caja registradora.',
    defaultResourceType: 'cash_register',
  },
  CASH_REGISTER_CLOSED: {
    title: 'Caja cerrada',
    defaultBody: 'Se realizó el cierre de una caja registradora.',
    defaultResourceType: 'cash_register',
  },
  CASH_DIFFERENCE: {
    title: 'Diferencia en arqueo de caja',
    defaultBody: 'Se detectó una discrepancia en el cierre de caja.',
    defaultResourceType: 'cash_register',
  },

  // Créditos y Cobranzas
  CREDIT_PAYMENT_DUE: {
    title: 'Cuota por vencer',
    defaultBody: 'Hay cuotas de crédito próximas a su vencimiento.',
    defaultResourceType: 'credit',
  },
  CREDIT_OVERDUE: {
    title: 'Crédito vencido',
    defaultBody: 'Se detectó un crédito con cuotas vencidas impagas.',
    defaultResourceType: 'credit',
  },
  PAYMENT_RECEIVED: {
    title: 'Cobro registrado',
    defaultBody: 'Se registró un nuevo pago o cobranza.',
    defaultResourceType: 'payment',
  },
  PAYMENT_FAILED: {
    title: 'Pago rechazado',
    defaultBody: 'No se pudo procesar una transacción de pago.',
    defaultResourceType: 'payment',
  },

  // Compras y Proveedores
  PURCHASE_ORDER_RECEIVED: {
    title: 'Mercadería recibida',
    defaultBody: 'Ingresaron productos correspondientes a una orden de compra.',
    defaultResourceType: 'purchase_order',
  },
  PURCHASE_ORDER_DELAYED: {
    title: 'Orden de compra demorada',
    defaultBody: 'Un pedido a proveedor no ha llegado en la fecha estimada.',
    defaultResourceType: 'purchase_order',
  },
  SUPPLIER_ORDER_STATUS_CHANGED: {
    title: 'Estado de pedido a proveedor',
    defaultBody: 'Se actualizó el estado de un pedido a proveedor.',
    defaultResourceType: 'purchase_order',
  },

  // Empleados y Equipo
  EMPLOYEE_INVITED: {
    title: 'Nuevo miembro invitado',
    defaultBody: 'Se envió una invitación para sumarse al equipo.',
    defaultResourceType: 'member',
  },
  ROLE_CHANGED: {
    title: 'Rol actualizado',
    defaultBody: 'Se modificó el rol de un miembro del equipo.',
    defaultResourceType: 'member',
  },
  PERMISSION_CHANGED: {
    title: 'Permisos actualizados',
    defaultBody: 'Se modificaron permisos de acceso a la organización.',
    defaultResourceType: 'member',
  },

  // Seguridad
  NEW_LOGIN: {
    title: 'Nuevo inicio de sesión',
    defaultBody: 'Se registró un acceso a tu cuenta desde un nuevo dispositivo.',
    defaultResourceType: 'security',
  },
  PASSWORD_CHANGED: {
    title: 'Contraseña actualizada',
    defaultBody: 'Se cambió la contraseña de tu cuenta con éxito.',
    defaultResourceType: 'security',
  },

  // Suscripción y Sistema
  SUBSCRIPTION_EXPIRING: {
    title: 'Suscripción por vencer',
    defaultBody: 'Tu plan de MiTiendaPy está próximo a su fecha de renovación.',
    defaultResourceType: 'subscription',
  },
  SUBSCRIPTION_PAYMENT_FAILED: {
    title: 'Problema con el pago del plan',
    defaultBody: 'No se pudo procesar el pago de renovación de tu suscripción.',
    defaultResourceType: 'subscription',
  },
  PLAN_CHANGED: {
    title: 'Plan actualizado',
    defaultBody: 'Se actualizó el plan de suscripción de tu negocio.',
    defaultResourceType: 'subscription',
  },
  IMPORTANT_SYSTEM_MESSAGE: {
    title: 'Comunicado del sistema',
    defaultBody: 'Hay un comunicado importante sobre el funcionamiento de la plataforma.',
    defaultResourceType: 'system',
  },
}

/**
 * Resuelve el título y cuerpo formalmente para un tipo de evento dado.
 * Si se incluye metadata adicional, puede enriquecer el cuerpo manteniendo
 * la seguridad para notificaciones emergentes.
 */
export function formatNotificationContent(
  type: NotificationType,
  data?: Record<string, unknown>
): NotificationContent {
  const template = NOTIFICATION_PRESENTATION_MAP[type]
  if (!template) {
    return {
      title: 'Notificación del sistema',
      body: 'Tenés una nueva notificación.',
    }
  }

  const body = template.formatBody ? template.formatBody(data) : template.defaultBody

  return {
    title: template.title,
    body,
    defaultResourceType: template.defaultResourceType,
  }
}
