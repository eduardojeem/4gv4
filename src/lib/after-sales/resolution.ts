import type { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Efectos de resolver un caso de posventa.
 *
 * Aprobar una garantia de reparacion crea el retrabajo; completar una
 * devolucion mueve el dinero. Antes ambas cosas se hacian a mano y por fuera
 * del sistema, asi que no quedaba rastro de que una venia de la otra.
 */

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type WarrantyType = 'labor' | 'parts' | 'full'
export type RefundMethod = 'cash' | 'store_credit'

/** Que cubre la organizacion segun la garantia original de la reparacion. */
const COVERAGE_NOTE: Record<WarrantyType, string> = {
  full: 'Garantía completa: no se le cobra nada al cliente.',
  labor: 'Garantía de mano de obra: la mano de obra no se cobra, los repuestos sí.',
  parts: 'Garantía de repuestos: los repuestos no se cobran, la mano de obra sí.',
}

interface ParentRepair {
  id: string
  organization_id: string | null
  branch_id: string | null
  customer_id: string | null
  device_type: string | null
  device_brand: string | null
  device_model: string | null
  problem_description: string | null
  technician_id: string | null
  priority: string | null
  urgency: string | null
  warranty_months: number | null
  warranty_type: string | null
  ticket_number: string | null
}

const PARENT_REPAIR_COLUMNS =
  'id, organization_id, branch_id, customer_id, device_type, device_brand, device_model, problem_description, technician_id, priority, urgency, warranty_months, warranty_type, ticket_number'

export class AfterSalesResolutionError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AfterSalesResolutionError'
    this.status = status
  }
}

/**
 * Crea la reparacion de retrabajo a partir de la original.
 *
 * Los costos arrancan en cero a proposito: al abrirla todavia no se sabe que
 * repuestos va a necesitar, asi que se deja el detalle de la cobertura como
 * nota y quien la cierre carga lo que corresponda cobrar.
 *
 * La garantia se copia en meses, no en fecha de vencimiento: al entregarla,
 * `/api/repairs/[id]/delivery` la recalcula desde la segunda entrega, que es
 * cuando el cliente vuelve a tener el equipo.
 */
export async function createWarrantyRepair(params: {
  supabase: SupabaseServerClient
  organizationId: string
  userId: string
  caseId: string
  parentRepairId: string
  reason: string
}): Promise<{ repairId: string; ticketNumber: string | null }> {
  const { supabase, organizationId, userId, caseId, parentRepairId, reason } = params

  const { data: parent, error: parentError } = await supabase
    .from('repairs')
    .select(PARENT_REPAIR_COLUMNS)
    .eq('id', parentRepairId)
    .eq('organization_id', organizationId)
    .maybeSingle<ParentRepair>()

  if (parentError) throw parentError
  if (!parent) {
    throw new AfterSalesResolutionError('La reparación original no existe o no pertenece a tu organización.', 404)
  }

  // Un caso ya resuelto no puede volver a generar retrabajo, pero si la
  // aprobacion se reintenta tras un fallo parcial no queremos duplicar.
  const { data: existing } = await supabase
    .from('repairs')
    .select('id, ticket_number')
    .eq('parent_repair_id', parentRepairId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; ticket_number: string | null }>()

  const coverage = (parent.warranty_type as WarrantyType) || 'full'
  const parentLabel = parent.ticket_number || parentRepairId.slice(0, 8)

  // `customer_id`, marca, modelo y descripcion son NOT NULL en `repairs`. Los
  // heredamos de la original, asi que si le falta alguno el insert fallaria con
  // un error crudo de Postgres: mejor decir cual es el dato que falta.
  if (!parent.customer_id || !parent.device_brand || !parent.device_model) {
    throw new AfterSalesResolutionError(
      `La reparación ${parentLabel} no tiene cliente, marca o modelo cargados, así que no se puede generar el retrabajo. Completá esos datos primero.`,
      422
    )
  }

  if (existing) {
    logger.warn('Retrabajo de garantía ya existente, no se duplica', { caseId, parentRepairId })
    return { repairId: existing.id, ticketNumber: existing.ticket_number }
  }

  const { data: created, error: createError } = await supabase
    .from('repairs')
    .insert({
      organization_id: organizationId,
      branch_id: parent.branch_id,
      customer_id: parent.customer_id,
      parent_repair_id: parent.id,
      device_type: parent.device_type,
      device_brand: parent.device_brand,
      device_model: parent.device_model,
      problem_description: `[Garantía de ${parentLabel}] ${reason}`,
      technician_id: parent.technician_id,
      priority: parent.priority || 'medium',
      urgency: parent.urgency || 'normal',
      status: 'recibido',
      estimated_cost: 0,
      labor_cost: 0,
      // La garantia vuelve a correr desde la segunda entrega.
      warranty_months: parent.warranty_months ?? 0,
      warranty_type: parent.warranty_type,
    })
    .select('id, ticket_number')
    .single<{ id: string; ticket_number: string | null }>()

  if (createError) throw createError

  // La nota es la que le dice al técnico qué puede cobrar y qué no.
  const { error: noteError } = await supabase.from('repair_notes').insert({
    repair_id: created.id,
    note_text: `Retrabajo por garantía de la reparación ${parentLabel}. ${COVERAGE_NOTE[coverage]}`,
    author_id: userId,
    author_name: 'Sistema',
    is_internal: true,
  })

  // La nota es informativa: si falla, la reparación ya existe y perderla sería
  // peor que quedarse sin la nota.
  if (noteError) {
    logger.warn('No se pudo dejar la nota de cobertura en el retrabajo', { repairId: created.id, error: noteError })
  }

  return { repairId: created.id, ticketNumber: created.ticket_number }
}

/**
 * Devuelve el dinero por caja o como saldo a favor.
 *
 * Por caja exige una sesion abierta: registrar una salida contra una caja
 * cerrada descuadra el arqueo del dia siguiente, asi que preferimos frenar y
 * que la operacion decida (abrir caja, o dar saldo a favor).
 */
export async function applyRefund(params: {
  supabase: SupabaseServerClient
  organizationId: string
  userId: string
  caseId: string
  caseNumber: string | null
  customerId: string | null
  branchId: string | null
  amount: number
  method: RefundMethod
}): Promise<{ method: RefundMethod; amount: number }> {
  const { supabase, organizationId, userId, caseId, caseNumber, customerId, branchId, amount, method } = params

  const label = caseNumber || caseId.slice(0, 8)

  if (method === 'store_credit') {
    if (!customerId) {
      throw new AfterSalesResolutionError(
        'El caso no tiene un cliente asociado, así que no se le puede acreditar saldo a favor. Usá reintegro por caja.',
        422
      )
    }

    const { error } = await supabase.from('customer_store_credits').insert({
      organization_id: organizationId,
      customer_id: customerId,
      amount,
      reason: `Reintegro por caso de posventa ${label}`,
      source_type: 'after_sales',
      source_id: caseId,
      created_by: userId,
    })

    if (error) throw error
    return { method, amount }
  }

  if (!branchId) {
    throw new AfterSalesResolutionError(
      'No se pudo determinar la sucursal del caso para registrar la salida de caja.',
      422
    )
  }

  const { data: openSessions, error: sessionError } = await supabase
    .from('cash_closures')
    .select('id, register_id')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .is('date', null)
    .order('created_at', { ascending: false })

  if (sessionError) throw sessionError

  const sessions = (openSessions ?? []) as Array<{ id: string; register_id: string | null }>
  const targetSession =
    sessions.find((session) => (session.register_id ?? '').toLowerCase() === 'principal') ?? sessions[0] ?? null

  if (!targetSession) {
    throw new AfterSalesResolutionError(
      'No hay una caja abierta en la sucursal. Abrí la caja para reintegrar en efectivo, o acreditá saldo a favor del cliente.',
      409
    )
  }

  const { error: movementError } = await supabase.rpc('record_cash_movement_atomic', {
    p_organization_id: organizationId,
    p_branch_id: branchId,
    p_session_id: targetSession.id,
    p_type: 'cash_out',
    p_amount: amount,
    p_reason: `Reintegro posventa ${label}`,
  })

  if (movementError) {
    const closed = movementError.message?.includes('OPEN_CASH_SESSION_NOT_FOUND')
    throw new AfterSalesResolutionError(
      closed ? 'La caja se cerró mientras se resolvía el caso. Volvé a intentarlo.' : movementError.message,
      closed ? 409 : 400
    )
  }

  return { method, amount }
}

export type RestockAction = 'sellable' | 'quarantine' | 'none'

/**
 * Destino por defecto de la mercaderia que vuelve, segun el tipo de caso.
 *
 * Un producto que vuelve por garantia esta fallado y no se revende; uno que
 * vuelve por cambio o devolucion normalmente si. Es solo el valor inicial:
 * quien resuelve el caso puede cambiarlo.
 */
export function defaultRestockAction(requestType: string): RestockAction {
  if (requestType === 'product_warranty') return 'quarantine'
  if (requestType === 'exchange' || requestType === 'return') return 'sellable'
  // Una garantia de reparacion no devuelve mercaderia: devuelve un equipo del
  // cliente, que nunca fue stock nuestro.
  return 'none'
}

/**
 * Reingresa al stock la mercaderia devuelta.
 *
 * Solo `sellable` toca el inventario. `quarantine` no necesita tabla aparte:
 * el caso ya guarda producto y cantidad, asi que la mercaderia con falla es la
 * suma de los casos completados con ese destino.
 */
export async function applyRestock(params: {
  supabase: SupabaseServerClient
  productId: string | null
  quantity: number
  action: RestockAction
  caseLabel: string
}): Promise<{ restocked: number } | null> {
  const { supabase, productId, quantity, action, caseLabel } = params

  if (action !== 'sellable') return null

  if (!productId) {
    throw new AfterSalesResolutionError(
      'El caso no tiene un producto asociado, así que no se puede reingresar al stock. Elegí "No vuelve nada" o registrá el ingreso a mano.',
      422
    )
  }

  const units = Math.max(1, Math.trunc(Number(quantity) || 1))

  const { error } = await supabase.rpc('update_product_stock', {
    product_id: productId,
    quantity_change: units,
    movement_type: 'entry',
    reason: `Devolución posventa ${caseLabel}`,
    notes: `Reingreso por caso de posventa ${caseLabel}`,
  })

  if (error) {
    throw new AfterSalesResolutionError(
      `No se pudo reingresar el producto al stock: ${error.message}`,
      400
    )
  }

  return { restocked: units }
}

/**
 * Descuenta del stock el producto que el cliente se lleva en un cambio.
 *
 * Es la contrapartida de `applyRestock`: en un cambio entra una unidad y sale
 * otra. Antes el reemplazo se despachaba por fuera del sistema y el stock
 * quedaba con una unidad de mas.
 */
export async function applyReplacement(params: {
  supabase: SupabaseServerClient
  productId: string | null
  quantity: number | null
  caseLabel: string
}): Promise<{ dispatched: number } | null> {
  const { supabase, productId, quantity, caseLabel } = params

  if (!productId) return null

  const units = Math.max(1, Math.trunc(Number(quantity) || 1))

  const { error } = await supabase.rpc('update_product_stock', {
    product_id: productId,
    quantity_change: -units,
    movement_type: 'exit',
    reason: `Cambio posventa ${caseLabel}`,
    notes: `Producto entregado en reemplazo por el caso ${caseLabel}`,
  })

  if (error) {
    throw new AfterSalesResolutionError(
      `No se pudo descontar del stock el producto de reemplazo: ${error.message}`,
      400
    )
  }

  return { dispatched: units }
}

/** Sucursal del origen del caso, para saber contra qué caja reintegrar. */
export async function resolveCaseBranch(params: {
  supabase: SupabaseServerClient
  organizationId: string
  repairId: string | null
  saleId: string | null
}): Promise<string | null> {
  const { supabase, organizationId, repairId, saleId } = params

  if (repairId) {
    const { data } = await supabase
      .from('repairs')
      .select('branch_id')
      .eq('id', repairId)
      .eq('organization_id', organizationId)
      .maybeSingle<{ branch_id: string | null }>()
    if (data?.branch_id) return data.branch_id
  }

  if (saleId) {
    const { data } = await supabase
      .from('sales')
      .select('branch_id')
      .eq('id', saleId)
      .eq('organization_id', organizationId)
      .maybeSingle<{ branch_id: string | null }>()
    if (data?.branch_id) return data.branch_id
  }

  return null
}
