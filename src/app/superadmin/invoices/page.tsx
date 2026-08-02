import { createAdminSupabase } from '@/lib/supabase/admin'
import { InvoicesDashboard, type InvoiceRow } from '@/components/superadmin/InvoicesDashboard'
import { chunkValues, fetchAllRows } from '@/lib/superadmin/fetch-all-rows'

async function getInvoicesData() {
  const admin = createAdminSupabase()

  const paymentsData = await fetchAllRows<{
    id: string; organization_id: string; subscription_id: string | null; plan_id: string | null
    amount: number; currency: string; status: string; payment_method: string | null
    provider: string | null; provider_payment_id: string | null; external_reference: string | null
    receipt_url: string | null; paid_at: string | null; created_at: string | null
  }>((from, to) =>
    admin
      .from('subscription_payments')
      .select('id, organization_id, subscription_id, plan_id, amount, currency, status, payment_method, provider, provider_payment_id, external_reference, receipt_url, paid_at, created_at')
      .order('created_at', { ascending: false })
      .range(from, to)
  )

  const payments = (paymentsData ?? []) as Array<{
    id: string; organization_id: string; subscription_id: string | null; plan_id: string | null
    amount: number; currency: string; status: string; payment_method: string | null
    provider: string | null; provider_payment_id: string | null; external_reference: string | null
    receipt_url: string | null; paid_at: string | null; created_at: string | null
  }>

  const orgIds = Array.from(new Set(payments.map((p) => p.organization_id).filter(Boolean)))

  const orgsData = orgIds.length
    ? (await Promise.all(chunkValues(orgIds).map(async (ids) => {
        const { data, error } = await admin.from('organizations').select('id, name, slug, plan').in('id', ids)
        if (error) throw new Error(error.message)
        return data ?? []
      }))).flat()
    : []

  const orgsById = new Map(
    (orgsData ?? []).map((o: { id: string; name: string; slug: string; plan: string | null }) => [o.id, o])
  )

  const rows: InvoiceRow[] = payments.map((p) => {
    const org = orgsById.get(p.organization_id)
    return {
      id: p.id,
      organizationId: p.organization_id,
      organizationName: org?.name ?? null,
      organizationSlug: org?.slug ?? null,
      organizationPlan: org?.plan ?? null,
      planId: p.plan_id,
      amount: Number(p.amount) || 0,
      currency: p.currency || 'PYG',
      status: p.status,
      paymentMethod: p.payment_method,
      provider: p.provider,
      providerPaymentId: p.provider_payment_id,
      externalReference: p.external_reference,
      receiptUrl: p.receipt_url,
      paidAt: p.paid_at,
      createdAt: p.created_at,
    }
  })

  return rows
}

export default async function SuperAdminInvoicesPage() {
  const rows = await getInvoicesData()
  return <InvoicesDashboard rows={rows} referenceTime={new Date().toISOString()} />
}
