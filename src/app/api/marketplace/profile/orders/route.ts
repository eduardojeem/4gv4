import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'FAILED'] as const

export const orderHistoryQuerySchema = z.object({
  cursor: z.string().max(100).optional(),
  organization: z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  payment: z.enum(PAYMENT_STATUSES).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, { message: 'Rango de fechas inválido' })

export function decodeOrderCursor(cursor?: string) {
  if (!cursor) return null
  const separator = cursor.lastIndexOf('|')
  if (separator < 1) return null
  const createdAt = cursor.slice(0, separator)
  const id = cursor.slice(separator + 1)
  if (Number.isNaN(Date.parse(createdAt)) || !z.string().uuid().safeParse(id).success) return null
  return { createdAt, id }
}

export async function GET(request: NextRequest) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })

  const parsed = orderHistoryQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()))
  if (!parsed.success) return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 })
  const cursor = decodeOrderCursor(parsed.data.cursor)
  if (parsed.data.cursor && !cursor) return NextResponse.json({ error: 'Cursor inválido' }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: customers, error: customersError } = await admin
    .from('customers')
    .select('id, organization_id')
    .eq('profile_id', user.id)
  if (customersError) return NextResponse.json({ error: 'No se pudo validar la cuenta' }, { status: 500 })
  if (!customers?.length) return NextResponse.json({ items: [], nextCursor: null })

  let organizationId: string | null = null
  if (parsed.data.organization) {
    const { data: organization } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', parsed.data.organization)
      .maybeSingle()
    if (!organization) return NextResponse.json({ items: [], nextCursor: null })
    organizationId = organization.id
  }

  let query = admin
    .from('customer_orders')
    .select('id, order_number, status, payment_status, fulfillment_type, customer_address, estimated_delivery_date, total, store_credit_reserved, store_credit_applied, created_at, organization_id')
    .in('customer_id', customers.map((customer) => customer.id))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(21)
  if (organizationId) query = query.eq('organization_id', organizationId)
  if (parsed.data.status) query = query.eq('status', parsed.data.status)
  if (parsed.data.payment) query = query.eq('payment_status', parsed.data.payment)
  if (parsed.data.from) query = query.gte('created_at', `${parsed.data.from}T00:00:00.000Z`)
  if (parsed.data.to) query = query.lte('created_at', `${parsed.data.to}T23:59:59.999Z`)
  if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: 'No se pudieron cargar los pedidos' }, { status: 500 })
  const page = (rows ?? []).slice(0, 20)
  const organizationIds = [...new Set(page.map((order) => order.organization_id))]
  const { data: organizations } = organizationIds.length
    ? await admin.from('organizations').select('id, name, slug, logo_url').in('id', organizationIds)
    : { data: [] }
  const organizationMap = new Map((organizations ?? []).map((organization) => [organization.id, organization]))
  const items = page.map((order) => ({
    ...order,
    total: Number(order.total ?? 0),
    store_credit_reserved: Number(order.store_credit_reserved ?? 0),
    store_credit_applied: Number(order.store_credit_applied ?? 0),
    amount_due: String(order.payment_status).toUpperCase() === 'PAID'
      ? 0
      : Math.max(0, Number(order.total ?? 0) - Number(order.store_credit_reserved ?? 0) - Number(order.store_credit_applied ?? 0)),
    organization: organizationMap.get(order.organization_id) ?? null,
  }))
  const last = page.at(-1)
  const nextCursor = (rows?.length ?? 0) > 20 && last ? `${last.created_at}|${last.id}` : null
  return NextResponse.json({ items, nextCursor })
}
