import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { normalizeAfterSalesCase } from './compat'

type DatabaseError = { code?: string; message?: string }
const ERRORS: Record<string, { status: number; message: string }> = {
  AFTER_SALES_FORBIDDEN: { status: 403, message: 'No tenés permiso para realizar esta operación en la sucursal.' },
  AFTER_SALES_NOT_FOUND: { status: 404, message: 'Caso no encontrado.' },
  AFTER_SALES_ALREADY_RESOLVED: { status: 409, message: 'El caso ya fue procesado con otros datos. Actualizá la lista.' },
  AFTER_SALES_INVALID_TRANSITION: { status: 409, message: 'El estado del caso cambió. Actualizá la lista antes de continuar.' },
  AFTER_SALES_OPEN_CASE_EXISTS: { status: 409, message: 'Ya existe un reclamo abierto para ese producto o reparación.' },
  AFTER_SALES_REFUND_EXCEEDS_CAP: { status: 400, message: 'El reintegro supera lo que corresponde a las unidades reclamadas y al total de la venta.' },
  AFTER_SALES_REFUND_METHOD_REQUIRED: { status: 400, message: 'Indicá cómo se devuelve el dinero: por caja o como saldo a favor.' },
  AFTER_SALES_LINE_REQUIRED: { status: 400, message: 'Seleccioná la línea de venta reclamada para validar el importe y las unidades.' },
  AFTER_SALES_INVALID_SOURCE: { status: 400, message: 'Los datos del cliente, venta o reparación no coinciden. Revisá el comprobante de origen.' },
  AFTER_SALES_INVALID_PRODUCT: { status: 400, message: 'El producto no pertenece a esta organización o no admite el movimiento.' },
  AFTER_SALES_QUANTITY_EXCEEDED: { status: 409, message: 'La cantidad reclamada supera las unidades de la venta disponibles para reclamar.' },
  AFTER_SALES_CUSTOMER_REQUIRED: { status: 400, message: 'Asociá un cliente al caso antes de acreditar saldo a favor.' },
  AFTER_SALES_VARIANT_REQUIRED: { status: 400, message: 'El reemplazo requiere una variante específica. Elegí un producto sin variantes para este caso.' },
  AFTER_SALES_INSUFFICIENT_STOCK: { status: 409, message: 'No hay stock suficiente para entregar el reemplazo.' },
  AFTER_SALES_INVALID_NOTES: { status: 400, message: 'Revisá la nota. Para rechazar se requiere un motivo de al menos cinco caracteres.' },
  AFTER_SALES_INVALID_REQUEST: { status: 400, message: 'Revisá el importe, las cantidades y los datos del caso.' },
  OPEN_CASH_SESSION_NOT_FOUND: { status: 409, message: 'No hay una caja abierta en la sucursal. Abrila o elegí saldo a favor.' },
}

/** No fallback to separate writes: partial effects would make a retry unsafe. */
export function afterSalesMutationError(error: DatabaseError) {
  if (['PGRST202', '42883', '42P01'].includes(error.code ?? '')) {
    return NextResponse.json({ success: false, code: 'AFTER_SALES_UNAVAILABLE', error: 'Posventa está temporalmente no disponible. Contactá a administración.' }, { status: 503 })
  }
  const entry = Object.entries(ERRORS).find(([code]) => error.message?.includes(code))?.[1]
  const status = entry?.status ?? (error.code === '42501' ? 403 : error.code === '23505' ? 409 : ['23503', '23514', '22P02'].includes(error.code ?? '') ? 400 : 500)
  return NextResponse.json({ success: false, error: entry?.message ?? 'No se pudo procesar el caso de posventa.' }, { status })
}

export async function mutateAfterSalesCase(
  actorId: string,
  organizationId: string,
  input: Record<string, unknown>,
  caseId?: string,
) {
  const { data, error } = await createAdminSupabase().rpc(
    caseId ? 'server_resolve_after_sales_case_atomic' : 'server_create_after_sales_case_atomic',
    { p_actor_user_id: actorId, p_organization_id: organizationId, ...(caseId ? { p_case_id: caseId } : {}), p_input: input },
  )
  if (error) return afterSalesMutationError(error)
  if (!data || typeof data !== 'object' || !data.data || typeof data.data !== 'object') {
    return NextResponse.json({ success: false, error: 'No se pudo confirmar el resultado de posventa. Actualizá la lista antes de reintentar.' }, { status: 500 })
  }
  return NextResponse.json({ ...data, success: true, data: normalizeAfterSalesCase(data.data) }, { status: caseId ? 200 : 201 })
}
