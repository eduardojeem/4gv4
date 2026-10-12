import { collectionRequestSchema } from '@/lib/credits/collection-contract'
import { collectCustomerPayment, CollectionError } from '@/lib/credits/collection-rpc'
import { awardCreditInstallmentLoyaltyPoints } from '@/lib/loyalty/credit-points'
import { awardPaidRepairLoyaltyPoints } from '@/lib/loyalty/repair-points'
import { isLoyaltyModuleMissing } from '@/lib/loyalty/module-status'
import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { readStoreCreditBalance } from '@/lib/credits/store-credit-balance'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import {
  loadCustomerDebts,
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

      const settings = await supabase.from('organization_settings').select('timezone').eq('organization_id', organization.id).maybeSingle()
      if (settings.error) return NextResponse.json({success:false,error:'No se pudo validar la zona horaria de la organización.'},{status:500})
      const timeZone = settings.data?.timezone || 'America/Asuncion'
      const { debts, error } = await loadCustomerDebts(supabase, {
        organizationId: organization.id,
        customerId,
        branchId: branch.branchId,
        timeZone,
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
        timeZone,
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


/** A request is committed as a whole in SQL; no independent ledger/cash writes. */
export const POST = withTenantAuth(
  { permission: 'crm.customers.manage', module: 'crm' },
  async (request, { organization, user }, routeContext) => {
    try {
      const customerId = await getRouteId(routeContext)
      if (!customerId || !UUID_PATTERN.test(customerId)) {
        return NextResponse.json({ success: false, error: 'Cliente inválido.' }, { status: 400 })
      }
      const parsed = collectionRequestSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) return NextResponse.json({
        success: false, error: parsed.error.issues[0]?.message || 'Revisá el cobro.',
        field: parsed.error.issues[0]?.path.join('.'),
      }, { status: 400 })
      const admin = createAdminSupabase()
      const { data: customer, error } = await findCustomer(admin, organization.id, customerId)
      if (error) return NextResponse.json({ success: false, error: 'No se pudo leer la ficha del cliente.' }, { status: 500 })
      if (!customer) return NextResponse.json({ success: false, error: 'El cliente no pertenece a la organización activa.' }, { status: 404 })
      let branchId: string | null
      try {
        const branch = await resolveBranchScopeForUser({
          userId: user.id, role: user.role as Role, organizationId: organization.id,
          requestedBranchId: getRequestedBranchId(request, parsed.data.branchId), strict: true,
        })
        branchId = branch.branchId
      } catch {
        return NextResponse.json({ success: false, error: 'No podés cobrar en esa sucursal.' }, { status: 403 })
      }
      if (!branchId) return NextResponse.json({ success: false, error: 'Elegí una sucursal para cobrar.' }, { status: 400 })
      const collection = await collectCustomerPayment(admin, {
        organizationId: organization.id, customerId, actorId: user.id, branchId, request: parsed.data,
      })
      // Secondary and repeatable: loyalty cannot turn an already committed receipt into failure.
      try {
        const loyaltyClient = await createClient()
        for (const row of collection.allocations) {
          if (row.type === 'installment') {
            const loyalty = await awardCreditInstallmentLoyaltyPoints(loyaltyClient as unknown as Parameters<typeof awardCreditInstallmentLoyaltyPoints>[0], {
              organizationId: organization.id, installmentId: row.debtId, paidAmount: row.appliedAmount, paymentId: row.paymentId,
            })
            if (loyalty.error && !isLoyaltyModuleMissing(loyalty.error)) logger.warn('Credit collection loyalty pending', { paymentId: row.paymentId })
          } else if (row.remainingBalance === 0 && row.totalAmount !== undefined) {
            await awardPaidRepairLoyaltyPoints(loyaltyClient, {
              organizationId: organization.id, repairId: row.debtId, customerId,
              total: row.totalAmount, paymentStatus: 'pagado',
            })
          }
        }
      } catch { logger.warn('Collection loyalty pending', { receiptId: collection.receiptId }) }
      return NextResponse.json({
        success: true, collection, receiptNumber: collection.receiptNumber,
        totalAmount: collection.appliedAmount + collection.excessToStoreCredit,
        totalApplied: collection.appliedAmount, excessToStoreCredit: collection.excessToStoreCredit,
        appliedAllocations: collection.allocations.map(row => ({
          id: row.debtId, type: row.type, title: row.type === 'repair' ? 'Reparación' : 'Cuota',
          allocatedAmount: row.appliedAmount, previousPending: row.appliedAmount + row.remainingBalance,
          newPending: row.remainingBalance, fullyPaid: row.remainingBalance === 0,
        })),
        paymentMethod: parsed.data.paymentMethod, timestamp: collection.recordedAt,
        bankName: parsed.data.bankName ?? null, referenceNumber: parsed.data.referenceNumber ?? null,
        cardType: parsed.data.cardType ?? null, posNetwork: parsed.data.posNetwork ?? null,
        voucherNumber: parsed.data.voucherNumber ?? null, lastFourDigits: parsed.data.lastFourDigits ?? null,
        message: 'Cobro confirmado. El comprobante muestra los importes registrados.',
      })
    } catch (error) {
      if (error instanceof CollectionError) return NextResponse.json({
        success: false, error: error.message, code: error.code,
      }, { status: error.status })
      logger.error('Collection request failed')
      return NextResponse.json({ success: false, error: 'No se pudo confirmar el cobro. Verificá el resultado antes de reintentar.' }, { status: 500 })
    }
  },
)

