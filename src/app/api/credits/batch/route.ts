import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { summarizeRepairDebts } from '@/lib/customers/repair-debt-summary'
import { z } from 'zod'

const batchSchema = z.object({
  customerIds: z.array(z.string().uuid()).max(500).default([]),
})

type CreditRow = {
  id: string
  customer_id: string
  principal: number
  interest_rate: number
  term_months: number
  start_date: string
  status: string
  [key: string]: unknown
}

type InstallmentRow = {
  id: string
  credit_id: string
  installment_number: number
  due_date: string
  amount: number
  status: string
  [key: string]: unknown
}

type PaymentRow = {
  id: string
  credit_id: string
  installment_id: string | null
  amount: number
  payment_method: string | null
  created_at: string
}

/**
 * POST /api/credits/batch
 *
 * Fetches credits, installments and payments for a given list of customer IDs.
 * Used by CustomerDashboard to display per-customer credit summaries.
 *
 * Body: { customerIds: string[] }
 */
export const POST = withTenantAuth({ permission: 'crm.customers.read', module: 'crm' }, async (request, { organization }) => {
  try {
    const validation = batchSchema.safeParse(await request.json().catch(() => ({})))
    if (!validation.success) {
      return NextResponse.json({ error: 'Lista de clientes inválida.' }, { status: 400 })
    }
    const customerIds = [...new Set(validation.data.customerIds)]

    if (customerIds.length === 0) {
      return NextResponse.json({ credits: [], installments: [], payments: [], repairDebts: {} })
    }

    const supabase = createAdminSupabase()

    // Créditos y reparaciones se leen una sola vez para toda la lista. El
    // cliente administrativo exige organization_id en ambas consultas.
    const [creditsResult, repairsResult] = await Promise.all([
      supabase
        .from('customer_credits')
        .select('id, customer_id, principal, interest_rate, term_months, start_date, status')
        .eq('organization_id', organization.id)
        .in('customer_id', customerIds),
      supabase
        .from('repairs')
        .select('customer_id, status, delivered_at, pricing_mode, labor_cost, final_cost, estimated_cost, discount_amount, paid_amount, parts:repair_parts(unit_price, unit_cost, quantity, line_type)')
        .eq('organization_id', organization.id)
        .in('customer_id', customerIds)
        .is('deleted_at', null),
    ])

    if (creditsResult.error) throw creditsResult.error
    if (repairsResult.error) throw repairsResult.error

    const credits = creditsResult.data

    const creditIds = (credits as CreditRow[] | null)?.map(c => c.id) ?? []

    // 2. Fetch installments and payments only if we have credits
    let installments: InstallmentRow[] = []
    let payments: PaymentRow[] = []

    if (creditIds.length > 0) {
      const [installmentsResult, paymentsResult] = await Promise.all([
        supabase
          .from('credit_installments')
          .select('id, credit_id, installment_number, due_date, amount, status, amount_paid, paid_at')
          .in('credit_id', creditIds)
          .order('installment_number', { ascending: true }),
        supabase
          .from('credit_payments')
          .select('id, credit_id, installment_id, amount, payment_method, created_at')
          .in('credit_id', creditIds)
          .order('created_at', { ascending: false })
          .limit(200)
      ])

      if (installmentsResult.error) {
        console.error('[credits/batch] Error fetching installments:', installmentsResult.error)
        throw installmentsResult.error
      }
      if (paymentsResult.error) {
        console.error('[credits/batch] Error fetching payments:', paymentsResult.error)
        throw paymentsResult.error
      }

      installments = (installmentsResult.data as InstallmentRow[]) ?? []
      payments = (paymentsResult.data as PaymentRow[]) ?? []
    }

    return NextResponse.json({
      credits: credits ?? [],
      installments,
      payments,
      repairDebts: summarizeRepairDebts(repairsResult.data ?? []),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[credits/batch] Unhandled error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
