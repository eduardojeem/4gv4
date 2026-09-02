import { NextResponse } from 'next/server'

import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { chunkQueryValues } from '@/lib/analytics/query-batches'
import { logger } from '@/lib/logger'
import { buildCreditReport } from '@/lib/reports/credit-report'
import { createAdminSupabase } from '@/lib/supabase/admin'

const PAGE_SIZE = 1000

type CreditRow = {
  id: string
  customer_id: string | null
  principal: number | null
  interest_rate: number | null
  created_at: string | null
  branch_id: string | null
}

type InstallmentRow = {
  id: string
  credit_id: string
  amount: number
  amount_paid: number | null
  status: string | null
  due_date: string
}

type PaymentRow = {
  id: string
  credit_id: string
  amount: number
  created_at: string | null
}

async function fetchAllPages<T>(
  getPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await getPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message || 'No se pudieron consultar los datos del reporte.')
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

function parseReportRange(request: Request) {
  const url = new URL(request.url)
  const from = new Date(url.searchParams.get('from') || '')
  const to = new Date(url.searchParams.get('to') || '')
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return null
  return { from, to }
}

function currentDateInAsuncion() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

export const GET = withTenantAuth({ permission: 'analytics.read', module: 'credits' }, async (request, { organization, user }) => {
  const range = parseReportRange(request)
  if (!range) {
    return NextResponse.json(
      { success: false, error: 'El período del reporte no es válido.' },
      { status: 400 },
    )
  }

  try {
    const requestedBranchId = getRequestedBranchId(request)
    let branchId: string | null = null
    if (requestedBranchId) {
      const scope = await resolveBranchScopeForUser({
        userId: user.id,
        role: organization.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
        requestedBranchId,
        organizationId: organization.id,
        strict: true,
      })
      branchId = scope.branchId
    }

    const supabase = createAdminSupabase()
    const credits = await fetchAllPages<CreditRow>((from, to) => {
      let query = supabase
        .from('customer_credits')
        .select('id, customer_id, principal, interest_rate, created_at, branch_id')
        .eq('organization_id', organization.id)
      if (branchId) query = query.eq('branch_id', branchId)
      return query.order('id', { ascending: true }).range(from, to)
    })

    const creditIds = credits.map((credit) => String(credit.id)).filter(Boolean)
    const installments: InstallmentRow[] = []
    const payments: PaymentRow[] = []

    for (const creditIdBatch of chunkQueryValues(creditIds)) {
      const [batchInstallments, batchPayments] = await Promise.all([
        fetchAllPages<InstallmentRow>((from, to) => supabase
          .from('credit_installments')
          .select('id, credit_id, amount, amount_paid, status, due_date')
          .in('credit_id', creditIdBatch)
          .order('id', { ascending: true })
          .range(from, to)),
        fetchAllPages<PaymentRow>((from, to) => supabase
          .from('credit_payments')
          .select('id, credit_id, amount, created_at')
          .in('credit_id', creditIdBatch)
          .gte('created_at', range.from.toISOString())
          .lte('created_at', range.to.toISOString())
          .order('id', { ascending: true })
          .range(from, to)),
      ])
      installments.push(...batchInstallments)
      payments.push(...batchPayments)
    }

    const report = buildCreditReport({
      credits: credits.map((credit) => ({
        id: String(credit.id),
        customerId: String(credit.customer_id || ''),
        principal: Number(credit.principal || 0),
        interestRate: Number(credit.interest_rate || 0),
        createdAt: String(credit.created_at || ''),
      })),
      installments: installments.map((installment) => ({
        creditId: String(installment.credit_id),
        amount: Number(installment.amount || 0),
        amountPaid: installment.amount_paid === null ? null : Number(installment.amount_paid || 0),
        status: String(installment.status || 'pending'),
        dueDate: String(installment.due_date || ''),
      })),
      payments: payments.map((payment) => ({
        creditId: String(payment.credit_id),
        amount: Number(payment.amount || 0),
        createdAt: String(payment.created_at || ''),
      })),
      from: range.from,
      to: range.to,
      today: currentDateInAsuncion(),
    })

    return NextResponse.json({
      success: true,
      data: report,
      meta: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        branchId,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('Credit report API error', {
      organizationId: organization.id,
      message: error instanceof Error ? error.message : String(error),
    })
    const isBranchScopeError = error instanceof Error && error.message.toLowerCase().includes('sucursal')
    const message = isBranchScopeError
      ? error.message
      : 'No se pudo generar el reporte de créditos.'
    return NextResponse.json({ success: false, error: message }, { status: isBranchScopeError ? 403 : 500 })
  }
})
