import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { readStoreCreditBalance } from '@/lib/credits/store-credit-balance'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import {
  closeRepairAndRegisterPayment,
  FinancialClosureRpcError,
} from '@/lib/repairs/financial-closure-rpc'
import {
  buildReceiptNumber,
  collectPaymentRequestSchema,
  loadCustomerDebts,
  paymentNote,
  paymentReference,
  planAllocations,
  type DebtItem,
} from '@/lib/customers/collect-payment'
import { logger } from '@/lib/logger'

export type { DebtItem } from '@/lib/customers/collect-payment'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Role = Parameters<typeof resolveBranchScopeForUser>[0]['role']

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

/**
 * El cliente tiene que ser de la organización activa. El POST anterior no lo
 * verificaba: con un ID de otra empresa se le podían marcar cuotas como pagadas.
 */
async function findCustomer(
  supabase: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
  customerId: string
) {
  return supabase
    .from('customers')
    .select('id, name, credit_limit')
    .eq('id', customerId)
    .eq('organization_id', organizationId)
    .maybeSingle()
}

/**
 * GET /api/customers/[id]/collect-payment
 * Deudas pendientes del cliente y cuáles se pueden cobrar desde la sucursal activa.
 */
export const GET = withTenantAuth(
  { permission: 'crm.customers.read', module: 'crm' },
  async (request, { organization, user }, routeContext) => {
    try {
      const customerId = await getRouteId(routeContext)
      if (!customerId || !UUID_PATTERN.test(customerId)) {
        return NextResponse.json({ success: false, error: 'Cliente inválido.' }, { status: 400 })
      }

      const supabase = createAdminSupabase()
      const { data: customer, error: customerError } = await findCustomer(supabase, organization.id, customerId)
      if (customerError) {
        return NextResponse.json({ success: false, error: 'No se pudo leer la ficha del cliente.' }, { status: 500 })
      }
      if (!customer) {
        return NextResponse.json({ success: false, error: 'El cliente no pertenece a la organización activa.' }, { status: 404 })
      }

      const branch = await resolveBranchScopeForUser({
        userId: user.id,
        role: user.role as Role,
        requestedBranchId: getRequestedBranchId(request),
        organizationId: organization.id,
      })

      const { debts, error } = await loadCustomerDebts(supabase, {
        organizationId: organization.id,
        customerId,
        branchId: branch.branchId,
      })
      if (error) return NextResponse.json({ success: false, error }, { status: 500 })

      const storeCredit = await readStoreCreditBalance(
        supabase as unknown as Parameters<typeof readStoreCreditBalance>[0],
        organization.id,
        customerId,
      )

      const sum = (items: DebtItem[]) => items.reduce((acc, d) => acc + d.pendingAmount, 0)

      return NextResponse.json({
        success: true,
        branchId: branch.branchId,
        creditLimit: Number(customer.credit_limit || 0),
        debts,
        totalDebt: sum(debts),
        collectableDebt: sum(debts.filter((d) => d.collectable)),
        overdueDebt: sum(debts.filter((d) => d.isOverdue)),
        storeBalance: storeCredit.available,
        storeLedgerBalance: storeCredit.ledger,
        storeReservedBalance: storeCredit.reserved,
      })
    } catch (error) {
      logger.error('[GET collect-payment] error', { error })
      return NextResponse.json({ success: false, error: 'No se pudieron cargar las deudas del cliente.' }, { status: 500 })
    }
  }
)

/** La caja abierta de la sucursal, con el mismo criterio que el cobro de reparaciones. */
async function findOpenCashSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  branchId: string
) {
  const { data, error } = await supabase
    .from('cash_closures')
    .select('id, register_id')
    .eq('organization_id', organizationId)
    .eq('branch_id', branchId)
    .is('date', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  const sessions = (data ?? []) as Array<{ id: string; register_id?: string | null }>
  return sessions.find((s) => (s.register_id ?? '').toLowerCase() === 'principal')?.id ?? sessions[0]?.id ?? null
}

type Applied = {
  id: string
  type: DebtItem['type']
  title: string
  allocatedAmount: number
  previousPending: number
  newPending: number
  fullyPaid: boolean
}

/**
 * POST /api/customers/[id]/collect-payment
 *
 * Reparte el monto entre las deudas y cobra cada una por su camino seguro.
 * Si una falla se corta ahí: lo ya cobrado queda registrado y se informa, en vez
 * de devolver «Pago registrado» con la base a medias.
 */
export const POST = withTenantAuth(
  { permission: 'crm.customers.manage', module: 'crm' },
  async (request, { organization, user }, routeContext) => {
    try {
      const customerId = await getRouteId(routeContext)
      if (!customerId || !UUID_PATTERN.test(customerId)) {
        return NextResponse.json({ success: false, error: 'Cliente inválido.' }, { status: 400 })
      }

      const parsed = collectPaymentRequestSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) {
        return NextResponse.json({
          success: false,
          error: parsed.error.issues[0]?.message || 'Revisá los datos del cobro.',
          field: parsed.error.issues[0]?.path.join('.'),
        }, { status: 400 })
      }
      const input = parsed.data

      const admin = createAdminSupabase()
      const { data: customer, error: customerError } = await findCustomer(admin, organization.id, customerId)
      if (customerError) {
        return NextResponse.json({ success: false, error: 'No se pudo leer la ficha del cliente.' }, { status: 500 })
      }
      if (!customer) {
        return NextResponse.json({ success: false, error: 'El cliente no pertenece a la organización activa.' }, { status: 404 })
      }

      let branchId: string | null
      try {
        const branch = await resolveBranchScopeForUser({
          userId: user.id,
          role: user.role as Role,
          requestedBranchId: getRequestedBranchId(request, input.branchId),
          organizationId: organization.id,
          strict: true,
        })
        branchId = branch.branchId
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'No podés cobrar en esa sucursal.',
        }, { status: 403 })
      }
      if (!branchId) {
        return NextResponse.json({ success: false, error: 'Elegí una sucursal para registrar el cobro.' }, { status: 400 })
      }

      // Deudas leídas de nuevo en el servidor: no se confía en los montos del navegador.
      const { debts, error: debtsError } = await loadCustomerDebts(admin, {
        organizationId: organization.id,
        customerId,
        branchId,
      })
      if (debtsError) return NextResponse.json({ success: false, error: debtsError }, { status: 500 })

      const plan = planAllocations(debts, {
        amount: input.amount,
        mode: input.mode,
        allocations: input.allocations,
      })

      if (plan.allocations.length === 0 && plan.excess > 0 && !input.creditExcessToStoreCredit) {
        return NextResponse.json({
          success: false,
          error: 'No hay deudas que se puedan cobrar desde esta sucursal con ese reparto.',
          code: 'NOTHING_TO_COLLECT',
        }, { status: 422 })
      }

      // Un sobrante no se acredita solo: un cero de más tipeado quedaba como
      // saldo a favor sin que nadie lo notara.
      if (plan.excess > 0 && !input.creditExcessToStoreCredit) {
        return NextResponse.json({
          success: false,
          error: `Sobran ${plan.excess.toLocaleString('es-PY')} Gs. Confirmá que van a saldo a favor o ajustá el monto.`,
          code: 'EXCESS_REQUIRES_CONFIRMATION',
          excess: plan.excess,
        }, { status: 422 })
      }

      const supabase = await createClient()
      let cashSessionId: string | null = null
      if (input.paymentMethod === 'cash') {
        cashSessionId = await findOpenCashSession(supabase, organization.id, branchId)
        if (!cashSessionId) {
          return NextResponse.json({
            success: false,
            error: 'No hay una caja abierta en esta sucursal. Abrí caja antes de cobrar en efectivo.',
            code: 'CASH_REGISTER_NOT_OPEN',
          }, { status: 409 })
        }
      }

      const reference = paymentReference(input)
      const note = paymentNote(input)
      const applied: Applied[] = []
      let failure: { title: string; error: string } | null = null
      let unapplied = 0

      for (const { debt, amount } of plan.allocations) {
        try {
          if (debt.type === 'repair') {
            const result = await closeRepairAndRegisterPayment(supabase, {
              repairId: debt.id,
              organizationId: organization.id,
              branchId,
              actorId: user.id,
              deliver: false,
              allowOutstandingBalance: false,
              payment: {
                method: input.paymentMethod,
                amount,
                reference,
                note,
                // Por deuda: reintentar el mismo cobro no la cobra dos veces.
                idempotencyKey: `${input.idempotencyKey}:repair:${debt.id}`,
              },
              cashSessionId,
              creditId: null,
              source: 'repairs',
            })
            const newPending = Math.max(0, Number(result.balance ?? debt.pendingAmount - amount))
            applied.push({
              id: debt.id,
              type: debt.type,
              title: debt.title,
              allocatedAmount: amount,
              previousPending: debt.pendingAmount,
              newPending,
              fullyPaid: newPending === 0,
            })
          } else {
            const { data, error } = await supabase.rpc('register_credit_payment_atomic', {
              p_organization_id: organization.id,
              p_branch_id: branchId,
              p_installment_id: debt.id,
              p_amount: amount,
              p_method: input.paymentMethod,
              p_notes: [reference ? `Ref ${reference}` : null, note].filter(Boolean).join(' — ') || null,
            })
            if (error) throw new Error(error.message)

            // La función cobra como mucho lo pendiente de la cuota al momento de
            // bloquearla; si alguien pagó en el medio, lo que no entró se informa.
            const appliedAmount = Math.min(amount, Number((data as { applied_amount?: number } | null)?.applied_amount ?? amount))
            unapplied += amount - appliedAmount
            const newPending = Math.max(0, debt.pendingAmount - appliedAmount)
            applied.push({
              id: debt.id,
              type: debt.type,
              title: debt.title,
              allocatedAmount: appliedAmount,
              previousPending: debt.pendingAmount,
              newPending,
              fullyPaid: newPending === 0,
            })
          }
        } catch (error) {
          failure = {
            title: debt.title,
            error: error instanceof FinancialClosureRpcError || error instanceof Error
              ? error.message
              : 'No se pudo registrar el cobro.',
          }
          break
        }
      }

      const receiptNumber = buildReceiptNumber()
      const totalApplied = applied.reduce((acc, a) => acc + a.allocatedAmount, 0)

      if (failure) {
        logger.warn('[POST collect-payment] cobro cortado', { customerId, failure, applied: applied.length })
        return NextResponse.json({
          success: false,
          partial: applied.length > 0,
          error: applied.length > 0
            ? `Se cobraron ${totalApplied.toLocaleString('es-PY')} Gs y se detuvo en «${failure.title}»: ${failure.error}`
            : `No se pudo cobrar «${failure.title}»: ${failure.error}`,
          receiptNumber: applied.length > 0 ? receiptNumber : null,
          appliedAllocations: applied,
          totalApplied,
          excessToStoreCredit: 0,
        }, { status: applied.length > 0 ? 207 : 422 })
      }

      // El sobrante —confirmado— va a saldo a favor. Si entró en efectivo, entra
      // también a la caja: antes se acreditaba sin que la plata figurara en ningún
      // arqueo.
      const excess = plan.excess + unapplied
      let storeCreditWarning: string | null = null
      let excessToStoreCredit = 0

      if (excess > 0 && !input.creditExcessToStoreCredit) {
        storeCreditWarning = `${excess.toLocaleString('es-PY')} Gs no se aplicaron porque el saldo de una cuota cambió mientras se cobraba. Devolvelos al cliente o acreditalos como saldo a favor.`
      }

      if (excess > 0 && input.creditExcessToStoreCredit) {
        const { data: credit, error: storeCreditError } = await admin
          .from('customer_store_credits')
          .insert({
            customer_id: customerId,
            organization_id: organization.id,
            amount: excess,
            reason: `Excedente de cobro ${receiptNumber}`,
            source_type: 'manual',
            created_by: user.id,
          })
          .select('id')
          .single()

        if (storeCreditError || !credit) {
          storeCreditWarning = `Las deudas se cobraron, pero el excedente de ${excess.toLocaleString('es-PY')} Gs no se pudo acreditar. Registralo a mano.`
        } else if (input.paymentMethod === 'cash' && cashSessionId) {
          const { error: cashError } = await admin.from('cash_movements').insert({
            session_id: cashSessionId,
            type: 'cash_in',
            amount: excess,
            reason: `Saldo a favor · ${customer.name ?? 'cliente'} · ${receiptNumber}`,
            payment_method: 'cash',
            created_by: user.id,
            organization_id: organization.id,
            branch_id: branchId,
          })

          if (cashError) {
            // Sin movimiento de caja el saldo no puede quedar: se revierte.
            await admin.from('customer_store_credits').delete().eq('id', credit.id).eq('organization_id', organization.id)
            storeCreditWarning = `Las deudas se cobraron, pero el excedente de ${excess.toLocaleString('es-PY')} Gs no se pudo registrar en caja y no se acreditó. Devolvé el efectivo o registralo a mano.`
          } else {
            excessToStoreCredit = excess
          }
        } else {
          excessToStoreCredit = excess
        }
      }

      return NextResponse.json({
        success: true,
        receiptNumber,
        totalAmount: input.amount,
        appliedAllocations: applied,
        excessToStoreCredit,
        storeCreditWarning,
        paymentMethod: input.paymentMethod,
        bankName: input.bankName ?? null,
        referenceNumber: input.referenceNumber ?? null,
        cardType: input.paymentMethod === 'card' ? input.cardType ?? 'debit' : null,
        posNetwork: input.posNetwork ?? null,
        voucherNumber: input.voucherNumber ?? null,
        lastFourDigits: input.lastFourDigits ?? null,
        timestamp: new Date().toISOString(),
        message: `Cobro de ${input.amount.toLocaleString('es-PY')} Gs registrado.`,
      })
    } catch (error) {
      logger.error('[POST collect-payment] error', { error })
      return NextResponse.json({ success: false, error: 'No se pudo registrar el cobro.' }, { status: 500 })
    }
  }
)

