import { resolveWarrantyExpiration } from '@/lib/warranty-utils'

/** Campos de la pantalla → columnas de `repairs` que la edición puede cambiar. */
const REPAIR_FIELD_MAP: Record<string, string> = {
  brand: 'device_brand',
  model: 'device_model',
  deviceType: 'device_type',
  issue: 'problem_description',
  description: 'diagnosis',
  accessType: 'access_type',
  accessPassword: 'access_password',
  status: 'status',
  priority: 'priority',
  urgency: 'urgency',
  customer_id: 'customer_id',
  technician_id: 'technician_id',
  estimatedCost: 'estimated_cost',
  laborCost: 'labor_cost',
  finalCost: 'final_cost',
  pricingMode: 'pricing_mode',
  discountAmount: 'discount_amount',
  priceOverrideReason: 'price_override_reason',
  warrantyMonths: 'warranty_months',
  warrantyType: 'warranty_type',
  warrantyNotes: 'warranty_notes',
}

/** Lo que cambia una edición (PATCH /api/repairs/[id]); los campos ausentes no se tocan. */
export function buildRepairUpdate(
  payload: Record<string, unknown>,
  anchors: { deliveredAt?: string | null; completedAt?: string | null } = {}
) {
  const updateData: Record<string, unknown> = {}

  for (const [uiField, dbField] of Object.entries(REPAIR_FIELD_MAP)) {
    if (payload[uiField] !== undefined) {
      updateData[dbField] = payload[uiField]
    }
  }

  // IMEI / N° de serie. No estaba en REPAIR_FIELD_MAP: la edición lo mandaba y se
  // descartaba sin aviso, así que no se podía cargar ni corregir después de recibir.
  const serial = payload.serialNumber !== undefined ? payload.serialNumber : payload.serial_number
  if (serial !== undefined) {
    const value = typeof serial === 'string' ? serial.trim().slice(0, 100) : ''
    updateData.serial_number = value || null
  }

  if (payload.warrantyMonths !== undefined) {
    // La garantia corre desde que el cliente recibe el equipo. Si todavia no se
    // entrego ni finalizo, queda en null: la fecha definitiva se fija al
    // entregar (ver /api/repairs/[id]/delivery).
    updateData.warranty_expires_at = resolveWarrantyExpiration(
      Number(payload.warrantyMonths || 0),
      anchors
    )
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updated_at = new Date().toISOString()
  }

  return updateData
}
