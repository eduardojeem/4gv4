import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchRepairById, isNextResponse, resolveRepairRouteContext } from '@/app/api/repairs/_lib'
import { resolveRepairCashSessionId } from '@/lib/repairs/cash-session'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * Qué hacer con la seña de una reparación cancelada antes de terminarse:
 * devolverla (efectivo o transferencia), dejarla como saldo a favor o
 * quedársela como cargo por cancelación. Se resuelve una sola vez.
 */
const settlementSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('refund'),
    method: z.enum(['cash', 'transfer']),
    reference: z.string().trim().max(120).optional(),
    reason: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().trim().min(8).max(120),
  }),
  z.object({
    kind: z.literal('store_credit'),
    reason: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().trim().min(8).max(120),
  }),
  z.object({
    kind: z.literal('retain'),
    reason: z.string().trim().min(3, 'Contá por qué se retiene la seña.').max(500),
    idempotencyKey: z.string().trim().min(8).max(120),
  }),
])

const ERRORS: Array<[string, string, number]> = [
  ['REPAIR_DEPOSIT_REQUIRES_CANCELLED', 'Solo se resuelve la seña de una reparación cancelada.', 409],
  ['REPAIR_DEPOSIT_ALREADY_SETTLED', 'La seña de esta reparación ya se resolvió.', 409],
  ['REPAIR_HAS_NO_DEPOSIT', 'Esta reparación no tiene seña cobrada.', 409],
  ['REPAIR_STORE_CREDIT_REQUIRES_CUSTOMER', 'Para dejar saldo a favor, la reparación tiene que tener un cliente.', 422],
  ['REPAIR_TRANSFER_REFERENCE_REQUIRED', 'Anotá la referencia de la transferencia.', 422],
  ['REPAIR_CASH_REGISTER_NOT_OPEN', 'No hay una caja abierta en esta sucursal. Abrí caja para devolver en efectivo.', 409],
  ['REPAIR_FINANCIAL_PERMISSION_DENIED', 'No tenés permiso para devolver o retener señas.', 403],
]

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.deliver')
    if (isNextResponse(ctx)) return ctx
    const { id } = await context.params

    const parsed = settlementSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Revisá cómo se resuelve la seña.', code: 'INVALID_DEPOSIT_SETTLEMENT' },
        { status: 400 },
      )
    }
    const input = parsed.data
    const method = input.kind === 'refund' ? input.method : null
    const cashSessionId = method === 'cash' ? await resolveRepairCashSessionId(ctx.supabase, ctx) : null
    if (method === 'cash' && !cashSessionId) {
      return NextResponse.json(
        { error: 'No hay una caja abierta en esta sucursal. Abrí caja para devolver en efectivo.', code: 'REPAIR_CASH_REGISTER_NOT_OPEN' },
        { status: 409 },
      )
    }

    const { data, error } = await ctx.supabase.rpc('settle_cancelled_repair_deposit', {
      p_repair_id: id,
      p_organization_id: ctx.organizationId,
      p_branch_id: ctx.branchId,
      p_actor_id: ctx.userId,
      p_kind: input.kind,
      p_method: method,
      p_reference: input.kind === 'refund' ? input.reference ?? null : null,
      p_reason: input.reason ?? null,
      p_cash_session_id: cashSessionId,
      p_idempotency_key: input.idempotencyKey,
    })
    if (error) {
      const text = `${error.message ?? ''} ${error.details ?? ''}`
      for (const [code, message, status] of ERRORS) {
        if (text.includes(code)) return NextResponse.json({ error: message, code }, { status })
      }
      if (error.code === '42883' || text.includes('settle_cancelled_repair_deposit')) {
        return NextResponse.json({ error: 'Falta aplicar la migración de señas canceladas.', code: 'MIGRATION_REQUIRED' }, { status: 503 })
      }
      throw error
    }

    const { data: repair, error: repairError } = await fetchRepairById(ctx, id)
    if (repairError) throw repairError
    return NextResponse.json({ repair, settlement: data })
  } catch (error) {
    logger.error('[deposit-settlement] POST', { error: error instanceof Error ? error.message : error })
    return NextResponse.json({ error: 'No se pudo resolver la seña.' }, { status: 500 })
  }
}
