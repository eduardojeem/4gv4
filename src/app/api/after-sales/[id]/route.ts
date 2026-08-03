import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  AfterSalesResolutionError,
  applyRefund,
  applyRestock,
  createWarrantyRepair,
  defaultRestockAction,
  resolveCaseBranch,
  type RestockAction,
} from '@/lib/after-sales/resolution'

type CaseStatus = 'open' | 'approved' | 'rejected' | 'completed' | 'cancelled'

/**
 * Transiciones validas de un caso de posventa. `rejected`, `completed` y
 * `cancelled` son terminales: un caso cerrado no se reabre, se crea uno nuevo.
 */
const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  open: ['approved', 'rejected', 'cancelled'],
  approved: ['completed', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: [],
}

const STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'abierto',
  approved: 'aprobado',
  rejected: 'rechazado',
  completed: 'completado',
  cancelled: 'cancelado',
}

const updateCaseSchema = z.object({
  status: z.enum(['approved', 'rejected', 'completed', 'cancelled']).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  refund_amount: z.number().min(0).optional().nullable(),
  refund_method: z.enum(['cash', 'store_credit']).optional().nullable(),
  restock_action: z.enum(['sellable', 'quarantine', 'none']).optional().nullable(),
})

const SELECT_COLUMNS =
  'id, case_number, source_type, request_type, status, customer_id, repair_id, sale_id, sale_item_id, product_id, quantity, reason, notes, refund_amount, refund_method, restock_action, generated_repair_id, approved_at, resolved_at, created_by, resolved_by, created_at, updated_at'

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'crm' }, async (_request, { organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id) return NextResponse.json({ success: false, error: 'Caso inválido.' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('after_sales_cases')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ success: false, error: 'Caso no encontrado.' }, { status: 404 })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('After-sales detail API error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar el caso.' }, { status: 500 })
  }
})

export const PATCH = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (request, { user, organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id) return NextResponse.json({ success: false, error: 'Caso inválido.' }, { status: 400 })

    const validation = updateCaseSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: current, error: currentError } = await supabase
      .from('after_sales_cases')
      .select('status, request_type, case_number, repair_id, sale_id, customer_id, product_id, quantity, refund_amount, generated_repair_id')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return NextResponse.json({ success: false, error: 'Caso no encontrado.' }, { status: 404 })

    const currentStatus = (current.status ?? 'open') as CaseStatus
    const nextStatus = validation.data.status
    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { updated_at: now }

    if (nextStatus) {
      if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
        return NextResponse.json({
          success: false,
          error: ALLOWED_TRANSITIONS[currentStatus]?.length === 0
            ? `El caso ya está ${STATUS_LABELS[currentStatus]} y no admite más cambios.`
            : `No se puede pasar de ${STATUS_LABELS[currentStatus]} a ${STATUS_LABELS[nextStatus]}.`,
        }, { status: 409 })
      }

      patch.status = nextStatus
      if (nextStatus === 'approved') patch.approved_at = now
      // Todo cierre deja constancia de quien y cuando lo resolvio.
      if (['rejected', 'completed', 'cancelled'].includes(nextStatus)) {
        patch.resolved_at = now
        patch.resolved_by = user.id
      }
    }

    if ('notes' in validation.data) patch.notes = validation.data.notes || null
    if ('refund_amount' in validation.data) patch.refund_amount = validation.data.refund_amount ?? null
    if ('refund_method' in validation.data) patch.refund_method = validation.data.refund_method ?? null
    if ('restock_action' in validation.data) patch.restock_action = validation.data.restock_action ?? null

    // Los efectos van ANTES de persistir el estado: si crear el retrabajo o
    // mover la plata falla, el caso queda como estaba y se puede reintentar.
    // Al reves quedaria aprobado sin reparacion, o completado sin reintegro.
    let sideEffect: {
      warrantyRepair?: { repairId: string; ticketNumber: string | null }
      refund?: { method: string; amount: number }
      restock?: { restocked: number; action: RestockAction }
    } = {}

    try {
      if (nextStatus === 'approved' && current.request_type === 'repair_warranty' && current.repair_id) {
        const created = await createWarrantyRepair({
          supabase,
          organizationId: organization.id,
          userId: user.id,
          caseId: id,
          parentRepairId: current.repair_id,
          reason: (validation.data.notes || '').trim() || 'Reclamo de garantía.',
        })
        patch.generated_repair_id = created.repairId
        sideEffect = { ...sideEffect, warrantyRepair: created }
      }

      if (nextStatus === 'completed') {
        // La mercaderia se mueve antes que la plata: si el reingreso falla, no
        // queremos haber sacado el efectivo de la caja.
        const restockAction = (validation.data.restock_action
          ?? defaultRestockAction(current.request_type as string)) as RestockAction

        const restocked = await applyRestock({
          supabase,
          productId: current.product_id,
          quantity: Number(current.quantity || 1),
          action: restockAction,
          caseLabel: current.case_number || id.slice(0, 8),
        })

        patch.restock_action = restockAction
        if (restocked) sideEffect = { ...sideEffect, restock: { ...restocked, action: restockAction } }

        const amount = Number(validation.data.refund_amount ?? current.refund_amount ?? 0)
        const method = validation.data.refund_method

        if (amount > 0) {
          if (!method) {
            return NextResponse.json(
              { success: false, error: 'Indicá cómo se devuelve el dinero: por caja o como saldo a favor.' },
              { status: 400 }
            )
          }

          const branchId = await resolveCaseBranch({
            supabase,
            organizationId: organization.id,
            repairId: current.repair_id,
            saleId: current.sale_id,
          })

          const applied = await applyRefund({
            supabase,
            organizationId: organization.id,
            userId: user.id,
            caseId: id,
            caseNumber: current.case_number,
            customerId: current.customer_id,
            branchId,
            amount,
            method,
          })
          patch.refund_amount = amount
          patch.refund_method = applied.method
          sideEffect = { ...sideEffect, refund: applied }
        }
      }
    } catch (effectError) {
      if (effectError instanceof AfterSalesResolutionError) {
        return NextResponse.json({ success: false, error: effectError.message }, { status: effectError.status })
      }
      throw effectError
    }

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ success: false, error: 'No hay cambios para aplicar.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('after_sales_cases')
      .update(patch)
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select(SELECT_COLUMNS)
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data, ...sideEffect })
  } catch (error) {
    logger.error('After-sales update API error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el caso.' }, { status: 500 })
  }
})
