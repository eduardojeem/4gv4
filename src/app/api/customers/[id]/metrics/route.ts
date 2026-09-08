import { NextResponse, type NextRequest } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { isCancelledSaleStatus } from '@/lib/sales-status'
import { isCountableOrder, isCountableRepair } from '@/lib/customers/customer-spend'
import { isLoyaltyModuleMissing } from '@/lib/loyalty/module-status'

async function getCustomerId(routeContext: unknown): Promise<string | null> {
  const params = (routeContext as {
    params?: { id?: string } | Promise<{ id?: string }>
  } | undefined)?.params
  const resolved = params ? await Promise.resolve(params) : null
  return resolved?.id ?? null
}

const amount = (value: unknown) => Math.max(0, Number(value) || 0)

/** Resumen comercial sensible usado por la ficha de reparaciones. */
export const GET = withTenantAuth(
  { permission: ['settings.manage', 'pos.sales.create'] },
  async (_request: NextRequest, { organization }, routeContext) => {
    const customerId = await getCustomerId(routeContext)
    if (!customerId) return NextResponse.json({ error: 'Falta el cliente' }, { status: 400 })

    const admin = createAdminSupabase()
    const customer = await admin
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (customer.error) return NextResponse.json({ error: 'No se pudo validar el cliente' }, { status: 500 })
    if (!customer.data) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const [sales, orders, repairs, loyaltySettings, loyaltyAccount, credits] = await Promise.all([
      admin.from('sales').select('total_amount, status').eq('customer_id', customerId).eq('organization_id', organization.id),
      admin.from('customer_orders').select('total, status').eq('customer_id', customerId).eq('organization_id', organization.id),
      admin.from('repairs').select('final_cost, estimated_cost, status').eq('customer_id', customerId).eq('organization_id', organization.id),
      admin.from('loyalty_settings').select('enabled').eq('organization_id', organization.id).maybeSingle(),
      admin.from('loyalty_accounts').select('balance').eq('customer_id', customerId).eq('organization_id', organization.id).maybeSingle(),
      admin.from('customer_credits').select('id').eq('customer_id', customerId).eq('organization_id', organization.id),
    ])

    const activityError = sales.error || orders.error || repairs.error || credits.error
    if (activityError) {
      return NextResponse.json({ error: 'No se pudo calcular la actividad del cliente' }, { status: 500 })
    }

    const validSales = (sales.data ?? []).filter((sale) => {
      const status = String(sale.status ?? '').trim().toLowerCase()
      return !isCancelledSaleStatus(status) && status !== 'cancelado'
    })
    const validOrders = (orders.data ?? []).filter((order) => isCountableOrder(order.status))
    const validRepairs = (repairs.data ?? []).filter((repair) => {
      const status = String(repair.status ?? '').trim().toLowerCase()
      return status !== 'cancelado' && status !== 'cancelled'
    })
    const billableRepairs = validRepairs.filter((repair) => isCountableRepair(repair.status))

    const posBilled = validSales.reduce((sum, sale) => sum + amount(sale.total_amount), 0)
    const webBilled = validOrders.reduce((sum, order) => sum + amount(order.total), 0)
    const repairsBilled = billableRepairs.reduce(
      (sum, repair) => sum + amount(repair.final_cost ?? repair.estimated_cost),
      0,
    )

    const loyaltyMissing = [loyaltySettings.error, loyaltyAccount.error]
      .filter(Boolean)
      .some((error) => isLoyaltyModuleMissing(error))
    const loyaltyAvailable = !loyaltyMissing && !loyaltySettings.error && !loyaltyAccount.error
      && loyaltySettings.data?.enabled === true
    const creditIds = (credits.data ?? []).map((credit) => credit.id)
    const installments = creditIds.length
      ? await admin.from('credit_installments').select('amount, amount_paid, status').in('credit_id', creditIds)
      : { data: [], error: null }
    if (installments.error) return NextResponse.json({ error: 'No se pudo calcular el saldo del cliente' }, { status: 500 })
    const creditBalance = (installments.data ?? []).reduce((sum, installment) => {
      const installmentAmount = amount(installment.amount)
      const paidAmount = installment.status === 'paid' ? installmentAmount : amount(installment.amount_paid)
      return sum + Math.max(0, installmentAmount - paidAmount)
    }, 0)

    return NextResponse.json({
      metrics: {
        repairs: validRepairs.length,
        purchases: validSales.length + validOrders.length,
        billed: posBilled + webBilled + repairsBilled,
        posBilled,
        webBilled,
        repairsBilled,
        loyaltyPoints: loyaltyAvailable ? amount(loyaltyAccount.data?.balance) : null,
        loyaltyModuleInstalled: loyaltyAvailable,
        creditBalance,
      },
    })
  },
)
