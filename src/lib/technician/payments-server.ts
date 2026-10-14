import { NextResponse } from 'next/server'

export function technicianPaymentError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message :
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
  const known: Record<string, [number, string]> = {
    TECHNICIAN_FORBIDDEN: [403, 'No tenés permiso para operar pagos en esta sucursal.'],
    TECHNICIAN_PAYMENT_NOT_FOUND: [404, 'No se encontró el pago de este técnico.'],
    TECHNICIAN_INVALID_REQUEST: [400, 'Revisá el importe y el período del pago.'],
    TECHNICIAN_INVALID_PERIOD: [400, 'Seleccioná un período válido.'],
    TECHNICIAN_INVALID_TRANSITION: [409, 'El estado del pago cambió. Actualizá antes de continuar.'],
    TECHNICIAN_IDEMPOTENCY_CONFLICT: [409, 'La solicitud ya existe con otros datos.'],
    TECHNICIAN_USE_PAYROLL: [409, 'Este pago o período ya pertenece a Nómina. Gestioná la liquidación en Finanzas.'],
    TECHNICIAN_FINANCE_CONFIG_CONFLICT: [409, 'Hay condiciones manuales en Finanzas. Revisalas antes de sincronizar para no duplicar remuneraciones.'],
    TECHNICIAN_VERSION_DATE_CONFLICT: [409, 'Ya existen condiciones para esa fecha o una posterior. Elegí una vigencia posterior para conservar el historial.'],
    TECHNICIAN_FUTURE_DATE_REQUIRED: [409, 'Las reglas aprobadas conservan la vigencia de hoy. Elegí una fecha desde mañana para las nuevas condiciones.'],
    PAYROLL_APPROVED_COMMISSION_RULE_IS_IMMUTABLE: [409, 'Ya hay comisiones calculadas con esas condiciones. Elegí una vigencia posterior a los períodos calculados.'],
    PAYROLL_USED_COMPENSATION_IS_IMMUTABLE: [409, 'El sueldo ya se utilizó en una liquidación. Elegí una fecha posterior al último período liquidado.'],
    TECHNICIAN_CASH_CLOSED: [409, 'Abrí una caja en la sucursal seleccionada antes de operar efectivo.'],
    OPEN_CASH_SESSION_NOT_FOUND: [409, 'La caja seleccionada está cerrada o no está activa.'],
    TECHNICIAN_LEGACY_BRANCH_REQUIRED: [409, 'Este pago histórico requiere reconciliar su sucursal en Finanzas.'],
    TECHNICIAN_LEGACY_CASH_REQUIRED: [409, 'Este pago histórico no tiene un egreso verificable. Reconciliar en Finanzas.'],
  }
  const code = Object.keys(known).find(key => message.includes(key))
  if (code) return NextResponse.json({ error: code, message: known[code][1] }, { status: known[code][0] })
  console.error('[technician-payment] operación fallida', message)
  return NextResponse.json({ error: 'payment_failed', message: 'No se pudo completar la operación. Verificá el resultado antes de registrar otro pago.' }, { status: 500 })
}

export function validPaymentRequestKey(key: string | null): key is string {
  return Boolean(key && /^[a-zA-Z0-9:_-]{8,120}$/.test(key))
}
