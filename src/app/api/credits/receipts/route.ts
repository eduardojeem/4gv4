import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { collectionResultSchema } from '@/lib/credits/collection-contract'

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'credits' }, async (request, { organization }) => {
  const paymentId = z.string().uuid().safeParse(new URL(request.url).searchParams.get('paymentId'))
  if (!paymentId.success) return NextResponse.json({ error: 'Pago inválido.' }, { status: 400 })
  if (!['owner', 'admin', 'manager', 'seller'].includes(organization.role)) return NextResponse.json({ error: 'Sin permiso para consultar comprobantes.' }, { status: 403 })
  const admin = createAdminSupabase()
  const payment = await admin.from('credit_payments').select('id, customer_credits!inner(customer_id, organization_id)')
    .eq('id', paymentId.data).eq('customer_credits.organization_id', organization.id).maybeSingle()
  if (payment.error) return NextResponse.json({ error: 'No se pudo consultar el pago.' }, { status: 500 })
  if (!payment.data) return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 })
  const collections = await admin.from('customer_collection_requests').select('result')
    .eq('organization_id', organization.id).contains('result', { allocations: [{ paymentId: paymentId.data, type: 'installment' }] }).limit(2)
  if (collections.error) return NextResponse.json({ error: 'No se pudo recuperar el comprobante.' }, { status: 500 })
  if (!collections.data?.length) return NextResponse.json({ success: true, legacy: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  if (collections.data.length !== 1) return NextResponse.json({ error: 'El pago requiere conciliar sus comprobantes.' }, { status: 409 })
  const result = collectionResultSchema.safeParse(collections.data[0].result)
  if (!result.success) return NextResponse.json({ error: 'El comprobante guardado está incompleto.' }, { status: 409 })
  return NextResponse.json({ success: true, legacy: !result.data.receipt, collection: result.data }, { headers: { 'Cache-Control': 'private, no-store' } })
})
