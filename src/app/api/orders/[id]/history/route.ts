import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { normalizeOrderStatus } from '@/lib/orders/flow'
import { normalizePaymentStatus } from '@/lib/orders/payment-flow'

type HistoryRow = {
  id: string
  from_status: string | null
  to_status: string
  note: string | null
  changed_by: string | null
  created_at: string
  amount?: number | null
  payment_method?: string | null
}

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

// Los nombres viven en profiles y las entradas automáticas (expiración por
// falta de pago) no tienen autor, así que se resuelven aparte en vez de
// arrastrar un join por cada fila.
async function resolveActorNames(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return new Map<string, string>()

  const admin = createAdminSupabase()
  const { data } = await admin.from('profiles').select('id, full_name, email').in('id', unique)

  const names = new Map<string, string>()
  for (const profile of data ?? []) {
    const name = (profile.full_name as string | null)?.trim() || (profile.email as string | null) || null
    if (name) names.set(String(profile.id), name)
  }
  return names
}

export const GET = withTenantAuth({ permission: 'ecommerce.orders.manage', module: 'orders' }, async (_request, { organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id) return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 })

    const supabase = await createClient()

    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (orderError) throw orderError
    if (!order) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 })

    const [statusResult, paymentResult] = await Promise.all([
      supabase
        .from('customer_order_status_history')
        .select('id, from_status, to_status, note, changed_by, created_at')
        .eq('organization_id', organization.id)
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('customer_order_payment_history')
        .select('id, from_status, to_status, note, changed_by, created_at, amount, payment_method')
        .eq('organization_id', organization.id)
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
    ])

    if (statusResult.error) throw statusResult.error
    if (paymentResult.error) throw paymentResult.error

    const statusRows = (statusResult.data ?? []) as HistoryRow[]
    const paymentRows = (paymentResult.data ?? []) as HistoryRow[]
    const actorNames = await resolveActorNames(
      [...statusRows, ...paymentRows].map((row) => row.changed_by ?? '')
    )

    const events = [
      ...statusRows.map((row) => ({
        id: `status:${row.id}`,
        kind: 'STATUS' as const,
        from: row.from_status ? normalizeOrderStatus(row.from_status) : null,
        to: normalizeOrderStatus(row.to_status),
        note: row.note,
        amount: null as number | null,
        // Sin autor significa que lo hizo el sistema: hoy solo la expiración a 72h.
        actor: row.changed_by ? actorNames.get(row.changed_by) ?? 'Usuario removido' : null,
        createdAt: row.created_at,
      })),
      ...paymentRows.map((row) => ({
        id: `payment:${row.id}`,
        kind: 'PAYMENT' as const,
        from: row.from_status ? normalizePaymentStatus(row.from_status) : null,
        to: normalizePaymentStatus(row.to_status),
        note: row.note,
        amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
        actor: row.changed_by ? actorNames.get(row.changed_by) ?? 'Usuario removido' : null,
        createdAt: row.created_at,
      })),
    ].sort((left, right) => left.createdAt.localeCompare(right.createdAt))

    return NextResponse.json({ success: true, data: { events } })
  } catch (error) {
    logger.error('Orders history API error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar el historial.' }, { status: 500 })
  }
})
