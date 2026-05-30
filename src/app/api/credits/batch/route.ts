import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

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
export async function POST(request: Request) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
    if (staffAuth.role === 'tecnico') {
      return NextResponse.json(
        { error: 'Permisos insuficientes para consultar créditos.' },
        { status: 403 }
      )
    }
    const organization = await getCurrentOrganizationContext(staffAuth.user.id)
    if (!organization) {
      return NextResponse.json({ error: 'Organizacion requerida' }, { status: 403 })
    }

    const body = await request.json() as { customerIds?: unknown }
    const { customerIds } = body

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ credits: [], installments: [], payments: [] })
    }

    const supabase = createAdminSupabase()

    // 1. Fetch credits for the requested customers
    const { data: credits, error: creditsError } = await supabase
      .from('customer_credits')
      .select('id, customer_id, principal, interest_rate, term_months, start_date, status')
      .eq('organization_id', organization.id)
      .in('customer_id', customerIds as string[])

    if (creditsError) {
      console.error('[credits/batch] Error fetching credits:', creditsError)
      throw creditsError
    }

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

    return NextResponse.json({ credits: credits ?? [], installments, payments })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    console.error('[credits/batch] Unhandled error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
