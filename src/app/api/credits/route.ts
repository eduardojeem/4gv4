import { readAllCreditRows, summarizeCreditPortfolio } from '@/lib/credits/portfolio'
import { chunkIds } from '@/lib/customers/batch'
import { creditInstallmentIsOverdue, creditCalendarDate } from '@/lib/credits/calendar'
import { z } from 'zod'
import { collectCustomerPayment, CollectionError } from '@/lib/credits/collection-rpc'
import { awardCreditInstallmentLoyaltyPoints } from '@/lib/loyalty/credit-points'
import { isLoyaltyModuleMissing } from '@/lib/loyalty/module-status'
import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'

const CREDIT_ALLOWED_ROLES = new Set(['owner', 'admin', 'manager', 'seller'])

function canAccessCredits(role: string | undefined, action: 'read' | 'manage') {
  if (!role) return false
  if (!CREDIT_ALLOWED_ROLES.has(role)) return false
  return action === 'read' || action === 'manage'
}

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'credits' }, async (request, { organization }) => {
  try {
    if (!canAccessCredits(organization.role, 'read')) return NextResponse.json({ success: false, error: 'No tenés permiso para acceder a créditos.' }, { status: 403 })
    const supabase = createAdminSupabase()
    const params = new URL(request.url).searchParams
    const filters = z.object({
      status: z.enum(['pending', 'paid', 'late', '']).optional(),
      fromDate: z.string().refine(value => !value || creditCalendarDate(value) === value).optional(),
      toDate: z.string().refine(value => !value || creditCalendarDate(value) === value).optional(),
      minAmount: z.string().refine(value => !value || (Number.isFinite(Number(value)) && Number(value) >= 0)).optional(),
    }).safeParse(Object.fromEntries(params))
    if (!filters.success || (filters.data.fromDate && filters.data.toDate && filters.data.fromDate > filters.data.toDate)) {
      return NextResponse.json({ success: false, error: 'Filtros de créditos inválidos.' }, { status: 400 })
    }
    const page = params.has('page') ? Number(params.get('page')) : null
    const perPage = Number(params.get('per_page') || 100)
    if ((page !== null && (!Number.isInteger(page) || page < 1)) || !Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
      return NextResponse.json({ success: false, error: 'Paginación inválida.' }, { status: 400 })
    }
    const [creditRows, settings] = await Promise.all([
      readAllCreditRows((from,to) => supabase.from('credit_details').select('*').eq('organization_id', organization.id).order('id').range(from,to)),
      supabase.from('organization_settings').select('timezone').eq('organization_id', organization.id).maybeSingle(),
    ])
    if (settings.error) throw settings.error
    const timeZone = settings.data?.timezone || 'America/Asuncion'
    const creditIds = creditRows.map(row => String(row.id))
    const customerIds = [...new Set(creditRows.map(row => String(row.customer_id)))]
    const readCreditChildren = async (table:string,columns:string) => (await Promise.all(chunkIds(creditIds,200).map(ids =>
      readAllCreditRows((from,to) => supabase.from(table).select(columns).in('credit_id',ids).order('id').range(from,to).overrideTypes<Array<Record<string, unknown>>, {merge:false}>())
    ))).flat()
    const [installments, payments, summary, installmentsProgress, customers, sales] = await Promise.all([
      readCreditChildren('credit_installments','*'),
      readCreditChildren('credit_payments','*'),
      Promise.all(chunkIds(creditIds,200).map(ids=>readAllCreditRows((from,to)=>
        supabase.from('credit_summary').select('*').in('credit_id',ids).order('credit_id').range(from,to)))).then(rows => rows.flat()),
      Promise.all(chunkIds(creditIds,200).map(ids=>readAllCreditRows((from,to)=>
        supabase.from('credit_installments_progress').select('*').in('credit_id',ids).order('id').range(from,to)))).then(rows => rows.flat()),
      Promise.all(chunkIds(customerIds,200).map(ids=>readAllCreditRows((from,to)=>
        supabase.from('customers').select('id,customer_code').eq('organization_id',organization.id).in('id',ids).order('id').range(from,to)))).then(rows => rows.flat()),
      Promise.all(chunkIds(customerIds,200).map(ids=>readAllCreditRows((from,to)=>
        supabase.from('sales').select('id,code,total_amount,payment_method,customer_id,created_at,notes').eq('organization_id',organization.id)
          .in('customer_id',ids).in('payment_method',['credit','crédito','credito']).order('id').range(from,to)))).then(rows => rows.flat()),
    ])
    const saleItems = (await Promise.all(chunkIds(sales.map(row=>String(row.id)),200).map(ids=>readAllCreditRows((from,to)=>
      supabase.from('sale_items').select('id,sale_id,quantity,unit_price,subtotal,product:products(id,name)').in('sale_id',ids).order('id').range(from,to))))).flat()
    const orderedInstallments = installments.map((row): Record<string, unknown> => ({...row, status: row.status === 'paid' ? 'paid' :
      creditInstallmentIsOverdue(String(row.due_date), String(row.status), timeZone) ? 'late' : 'pending'}))
      .sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)) || Number(a.installment_number)-Number(b.installment_number))
    const statuses = new Map(orderedInstallments.map(row => [String(row.id), row.status]))
    const orderedPayments = [...payments].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id)))
    const globalSummary = summarizeCreditPortfolio(
      creditRows as unknown as Parameters<typeof summarizeCreditPortfolio>[0],
      orderedInstallments as unknown as Parameters<typeof summarizeCreditPortfolio>[1], timeZone)
    const filtered = orderedInstallments.filter(row=>{
      const credit=creditRows.find(c=>String(c.id)===String(row.credit_id))
      if (['cancelled','cancelado','canceled'].includes(String(credit?.status))) return false
      if (credit?.status === 'completed' && row.status !== 'paid') return false
      const status=params.get('status')
      if (status && row.status !== status) return false
      if (params.get('creditId') && !String(row.credit_id).toLowerCase().includes(params.get('creditId')!.toLowerCase())) return false
      if (params.get('customerName') && !String(credit?.customer_name || '').toLowerCase().includes(params.get('customerName')!.toLowerCase())) return false
      const date=creditCalendarDate(String(row.due_date),timeZone)
      if (params.get('fromDate') && date && date<params.get('fromDate')!) return false
      if (params.get('toDate') && date && date>params.get('toDate')!) return false
      if (params.get('minAmount') && Number(row.amount)<Number(params.get('minAmount'))) return false
      return true
    })
    const filteredSummary = summarizeCreditPortfolio(
      creditRows as unknown as Parameters<typeof summarizeCreditPortfolio>[0],
      filtered as unknown as Parameters<typeof summarizeCreditPortfolio>[1], timeZone)
    return NextResponse.json({ success:true,data:{
      credits:creditRows,installments:page===null?orderedInstallments:filtered.slice((page-1)*perPage,page*perPage),
      payments:orderedPayments,summary,installmentsProgress:installmentsProgress.map(row => ({...row,status_effective:statuses.get(String(row.id)) ?? row.status_effective})),customers,sales,saleItems,
      globalSummary,filteredSummary,timeZone,asOf:new Date().toISOString(),
      pagination:{page:page??1,perPage:page===null?orderedInstallments.length:perPage,total:filtered.length,complete:page===null},
    } })
  } catch {
    logger.error('Credit portfolio read failed')
    return NextResponse.json({success:false,error:'No se pudo cargar la cartera completa. Reintentá antes de consultar saldos.'},{status:500})
  }
})

const creditPaymentSchema = z.object({
  installmentId: z.string().uuid(), creditId: z.string().uuid().optional(),
  method: z.enum(['cash', 'card', 'transfer']), amount: z.number().finite().positive().max(1_000_000_000).multipleOf(0.01),
  notes: z.string().max(500).optional(), reference: z.string().max(120).optional(),
  idempotencyKey: z.string().min(8).max(120), branchId: z.string().uuid().optional(),
}).strict()
export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'credits' }, async (request, { organization, user }) => {
  try {
    if (!canAccessCredits(organization.role, 'manage')) return NextResponse.json({ success: false, error: 'No tenés permiso para cobrar créditos.' }, { status: 403 })
    const parsed = creditPaymentSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Cobro inválido.' }, { status: 400 })
    const input = parsed.data
    const admin = createAdminSupabase()
    const { data: row, error } = await admin.from('credit_installments')
      .select('id, credit_id, customer_credits!inner(customer_id, organization_id)')
      .eq('id', input.installmentId).eq('customer_credits.organization_id', organization.id).maybeSingle()
    if (error) return NextResponse.json({ success: false, error: 'No se pudo leer la cuota.' }, { status: 500 })
    const raw = row as { credit_id: string; customer_credits: { customer_id: string; organization_id: string } | Array<{ customer_id: string; organization_id: string }> } | null
    const credit = Array.isArray(raw?.customer_credits) ? raw.customer_credits[0] : raw?.customer_credits
    if (!raw || !credit || credit.organization_id !== organization.id || (input.creditId && input.creditId !== raw.credit_id)) {
      return NextResponse.json({ success: false, error: 'La cuota no pertenece a la organización o al crédito seleccionado.' }, { status: 404 })
    }
    let branchId: string | null
    try {
      const branch = await resolveBranchScopeForUser({
        userId: user.id, role: user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
        requestedBranchId: getRequestedBranchId(request, input.branchId), organizationId: organization.id, strict: true,
      })
      branchId = branch.branchId
    } catch { return NextResponse.json({ success: false, error: 'No podés cobrar en esa sucursal.' }, { status: 403 }) }
    if (!branchId) return NextResponse.json({ success: false, error: 'Elegí una sucursal para cobrar.' }, { status: 400 })
    const collection = await collectCustomerPayment(admin, {
      organizationId: organization.id, customerId: credit.customer_id, actorId: user.id, branchId,
      request: {
        amount: input.amount, paymentMethod: input.method, mode: input.creditId ? 'auto' : 'manual',
        allocations: input.creditId ? undefined : [{ id: input.installmentId, type: 'installment', amount: input.amount }],
        scope: input.creditId ? { creditId: input.creditId } : { installmentId: input.installmentId },
        idempotencyKey: input.idempotencyKey, notes: input.notes,
        referenceNumber: input.method === 'transfer' ? input.reference : undefined,
        voucherNumber: input.method === 'card' ? input.reference : undefined,
      },
    })
    let loyaltyPoints = 0
    try {
      const client = await createClient()
      for (const payment of collection.allocations) {
        const loyalty = await awardCreditInstallmentLoyaltyPoints(client as unknown as Parameters<typeof awardCreditInstallmentLoyaltyPoints>[0], {
          organizationId: organization.id, installmentId: payment.debtId, paidAmount: payment.appliedAmount, paymentId: payment.paymentId,
        })
        loyaltyPoints += loyalty.points
        if (loyalty.error && !isLoyaltyModuleMissing(loyalty.error)) logger.warn('Collection loyalty pending', { paymentId: payment.paymentId })
      }
    } catch { logger.warn('Collection loyalty pending', { receiptId: collection.receiptId }) }
    return NextResponse.json({ success: true, data: {
      loyaltyPoints, installmentId: input.installmentId, creditId: raw.credit_id,
      appliedAmount: collection.appliedAmount, collection,
    } })
  } catch (error) {
    if (error instanceof CollectionError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    logger.error('Credit collection request failed')
    return NextResponse.json({ success: false, error: 'No se pudo confirmar el cobro. Verificá el resultado antes de reintentar.' }, { status: 500 })
  }
})
