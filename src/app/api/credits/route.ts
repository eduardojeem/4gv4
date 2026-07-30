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

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'credits' }, async (_request, { organization }) => {
  try {
    if (!canAccessCredits(organization.role, 'read')) {
      return NextResponse.json({ success: false, error: 'No tenes permiso para acceder a créditos.' }, { status: 403 })
    }

    const supabase = createAdminSupabase()
    const { data: credits, error: creditsError } = await supabase
      .from('credit_details')
      .select('*')
      .eq('organization_id', organization.id)

    if (creditsError) {
      // View or table may not exist yet — return empty data instead of crashing
      if (creditsError.code === '42P01' || creditsError.message?.includes('does not exist')) {
        logger.warn('Credits view not found, returning empty data', { error: creditsError.message })
        return NextResponse.json({
          success: true,
          data: {
            credits: [],
            installments: [],
            payments: [],
            summary: [],
            installmentsProgress: [],
            customers: [],
          },
        })
      }
      throw creditsError
    }

    const creditRows = credits ?? []
    const creditIds = creditRows.map((credit) => String(credit.id)).filter(Boolean)
    const customerIds = [...new Set(creditRows.map((credit) => String(credit.customer_id)).filter(Boolean))]

    if (creditIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          credits: [],
          installments: [],
          payments: [],
          summary: [],
          installmentsProgress: [],
          customers: [],
        },
      })
    }

    const [installmentsResult, paymentsResult, summaryResult, progressResult, customersResult, salesResult] = await Promise.all([
      supabase
        .from('credit_installments')
        .select('*')
        .in('credit_id', creditIds)
        .order('due_date', { ascending: true })
        .order('installment_number', { ascending: true })
        .limit(1000),
      supabase
        .from('credit_payments')
        .select('*')
        .in('credit_id', creditIds)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('credit_summary')
        .select('*')
        .in('credit_id', creditIds),
      supabase
        .from('credit_installments_progress')
        .select('*')
        .in('credit_id', creditIds)
        .limit(1000),
      supabase
        .from('customers')
        .select('id, customer_code')
        .eq('organization_id', organization.id)
        .in('id', customerIds),
      supabase
        .from('sales')
        .select('id, code, total_amount, payment_method, customer_id, created_at, notes')
        .eq('organization_id', organization.id)
        .in('customer_id', customerIds)
        .in('payment_method', ['credit', 'crédito', 'credito'])
        .order('created_at', { ascending: false })
    ])

    const firstError =
      installmentsResult.error ||
      paymentsResult.error ||
      summaryResult.error ||
      progressResult.error ||
      customersResult.error ||
      salesResult.error

    if (firstError) {
      // View or table may not exist yet — return partial data gracefully
      if (firstError.code === '42P01' || firstError.message?.includes('does not exist')) {
        logger.warn('Credits related view not found, returning partial data', { error: firstError.message })
        return NextResponse.json({
          success: true,
          data: {
            credits: creditRows,
            installments: installmentsResult.data ?? [],
            payments: paymentsResult.data ?? [],
            summary: summaryResult.data ?? [],
            installmentsProgress: progressResult.data ?? [],
            customers: customersResult.data ?? [],
            sales: [],
            saleItems: []
          },
        })
      }
      throw firstError
    }

    const sales = salesResult.data ?? []
    const saleIds = sales.map((s) => s.id)
    let saleItems: Array<Record<string, unknown>> = []

    if (saleIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('id, sale_id, quantity, unit_price, subtotal, product:products(id, name)')
        .in('sale_id', saleIds)

      if (itemsError) {
        logger.error('Error fetching sale items for credits', { error: itemsError })
      } else {
        saleItems = items ?? []
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        credits: creditRows,
        installments: installmentsResult.data ?? [],
        payments: paymentsResult.data ?? [],
        summary: summaryResult.data ?? [],
        installmentsProgress: progressResult.data ?? [],
        customers: customersResult.data ?? [],
        sales,
        saleItems
      },
    })
  } catch (error) {
    logger.error('Credits API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los creditos.' }, { status: 500 })
  }
})

type RegisterCreditPaymentBody = {
  installmentId?: unknown
  method?: unknown
  amount?: unknown
  notes?: unknown
  branchId?: unknown
}

export const POST = withTenantAuth({ permission: 'crm.customers.manage', module: 'credits' }, async (request, { organization, user }) => {
  try {
    if (!canAccessCredits(organization.role, 'manage')) {
      return NextResponse.json({ success: false, error: 'No tenes permiso para registrar pagos de créditos.' }, { status: 403 })
    }

    const body = await request.json() as RegisterCreditPaymentBody
    const installmentId = typeof body.installmentId === 'string' ? body.installmentId.trim() : ''
    const method = typeof body.method === 'string' ? body.method.trim().toLowerCase() : ''
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
    const requestedAmount = Number(body.amount)

    if (!installmentId) {
      return NextResponse.json({ success: false, error: 'La cuota es obligatoria.' }, { status: 400 })
    }

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'El monto debe ser mayor a 0.' }, { status: 400 })
    }

    if (!['cash', 'card', 'transfer'].includes(method)) {
      return NextResponse.json({ success: false, error: 'Metodo de pago invalido.' }, { status: 400 })
    }

    const branch = await resolveBranchScopeForUser({
      userId: user.id,
      role: user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
      requestedBranchId: getRequestedBranchId(request, body.branchId),
      organizationId: organization.id,
      strict: true,
    })

    if (method === 'cash' && !branch.branchId) {
      return NextResponse.json({
        success: false,
        error: 'Selecciona una sucursal y abri una caja para registrar pagos en efectivo.',
      }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('register_credit_payment_atomic', {
      p_organization_id: organization.id,
      p_branch_id: branch.branchId,
      p_installment_id: installmentId,
      p_amount: requestedAmount,
      p_method: method,
      p_notes: notes,
    })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    const result = data as {
      installment_id?: string
      credit_id?: string
      installment_number?: number
      applied_amount?: number
    } | null

    return NextResponse.json({
      success: true,
      data: {
        installmentId: result?.installment_id ?? installmentId,
        creditId: result?.credit_id,
        installmentNumber: result?.installment_number,
        appliedAmount: Number(result?.applied_amount || 0),
      },
    })
  } catch (error) {
    logger.error('Credits API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo registrar el pago.' }, { status: 500 })
  }
})
