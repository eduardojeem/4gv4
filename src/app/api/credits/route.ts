import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

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
    let saleItems: any[] = []

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

    const supabase = createAdminSupabase()
    const { data: installment, error: installmentError } = await supabase
      .from('credit_installments')
      .select('id, credit_id, installment_number, amount, amount_paid, status')
      .eq('id', installmentId)
      .maybeSingle()

    if (installmentError) {
      throw installmentError
    }

    if (!installment) {
      return NextResponse.json({ success: false, error: 'La cuota no existe.' }, { status: 404 })
    }

    const { data: credit, error: creditError } = await supabase
      .from('credit_details')
      .select('id, customer_name, organization_id')
      .eq('id', installment.credit_id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (creditError) {
      throw creditError
    }

    if (!credit) {
      return NextResponse.json({ success: false, error: 'La cuota no pertenece a tu organización.' }, { status: 404 })
    }

    const baseAmount = Math.max(0, Number(installment.amount || 0))
    const currentPaid = Math.min(baseAmount, Math.max(0, Number(installment.amount_paid || 0)))
    const outstanding = Math.max(0, baseAmount - currentPaid)

    if (outstanding <= 0 || installment.status === 'paid') {
      return NextResponse.json({ success: false, error: 'La cuota ya no tiene saldo pendiente.' }, { status: 400 })
    }

    const appliedAmount = Math.max(0, Math.min(requestedAmount, outstanding))

    if (appliedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'No hay saldo disponible para aplicar.' }, { status: 400 })
    }

    const { error: paymentError } = await supabase
      .from('credit_payments')
      .insert({
        credit_id: installment.credit_id,
        installment_id: installmentId,
        amount: appliedAmount,
        payment_method: method,
        notes,
      })

    if (paymentError) {
      throw paymentError
    }

    try {
      const { data: openSessions } = await supabase
        .from('cash_closures')
        .select('id, register_id')
        .is('date', null)
        .order('created_at', { ascending: false })

      const targetSession = (openSessions || []).find(
        (session) => session.register_id?.toLowerCase() === 'principal'
      ) || (openSessions || [])[0]

      if (targetSession) {
        const reason = `Cobro cuota crédito${credit.customer_name ? ` - ${credit.customer_name}` : ''}${notes ? ` (${notes})` : ''}`

        await supabase.from('cash_movements').insert({
          session_id: targetSession.id,
          type: 'cash_in',
          amount: appliedAmount,
          reason,
          payment_method: method,
          created_by: user.id,
          created_at: new Date().toISOString(),
        })
      }
    } catch (cashError) {
      logger.warn('Credit payment cash movement could not be recorded', {
        error: cashError,
        installmentId,
        organizationId: organization.id,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        installmentId,
        creditId: installment.credit_id,
        installmentNumber: installment.installment_number,
        appliedAmount,
      },
    })
  } catch (error) {
    logger.error('Credits API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo registrar el pago.' }, { status: 500 })
  }
})
