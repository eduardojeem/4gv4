import 'server-only'

import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'
import type { CustomerCreditItem } from './customer-portal'

export async function loadCustomerCreditPortal(userId: string, organizationSlug: string) {
  const admin = createAdminSupabase()
  const organization = await resolvePublicOrganizationBySlug(organizationSlug, admin)
  if (!organization) return null

  const { data: customerRows, error: customerError } = await admin
    .from('customers')
    .select('id')
    .eq('profile_id', userId)
    .eq('organization_id', organization.id)

  if (customerError) throw customerError
  const customerIds = (customerRows || []).map((row) => row.id)
  if (customerIds.length === 0) return { organization, credits: [], payments: [] }

  const { data: creditRows, error: creditsError } = await admin
    .from('customer_credits')
    .select('id, principal, term_months, start_date, created_at, status, credit_installments(id, installment_number, due_date, amount, status, amount_paid)')
    .eq('organization_id', organization.id)
    .in('customer_id', customerIds)
    .in('status', ['active', 'defaulted', 'completed'])
    .order('created_at', { ascending: false })

  if (creditsError) throw creditsError
  const creditIds = (creditRows || []).map((credit) => credit.id)
  let payments: Array<{ id: string; credit_id?: string; installment_id?: string | null; amount: number; payment_method: string; created_at: string; notes?: string }> = []

  if (creditIds.length > 0) {
    const { data, error } = await admin
      .from('credit_payments')
      .select('id, credit_id, installment_id, amount, payment_method, created_at, notes')
      .in('credit_id', creditIds)
      .order('created_at', { ascending: false })
    if (error) throw error
    payments = (data || []).map((payment) => ({ ...payment, amount: Number(payment.amount || 0), notes: payment.notes ?? undefined }))
  }

  const credits: CustomerCreditItem[] = (creditRows || []).map((credit) => ({
    id: credit.id,
    principal: Number(credit.principal || 0),
    term_months: Number(credit.term_months || 0),
    start_date: credit.start_date,
    created_at: credit.created_at ?? undefined,
    status: credit.status as CustomerCreditItem['status'],
    installments: (credit.credit_installments || []).map((installment) => ({
      id: installment.id,
      installment_number: installment.installment_number,
      due_date: installment.due_date,
      amount: Number(installment.amount || 0),
      amount_paid: installment.amount_paid === null ? null : Number(installment.amount_paid || 0),
      status: installment.status as 'pending' | 'paid' | 'late',
    })),
  }))

  return { organization, credits, payments }
}
