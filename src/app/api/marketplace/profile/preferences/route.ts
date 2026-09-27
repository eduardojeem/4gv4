import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const preferenceDefaults = {
  orderNotifications: true,
  repairNotifications: true,
  creditNotifications: true,
  promotions: false,
  marketingCommunications: false,
  publicProfile: false,
}

export const preferencePatchSchema = z.object({
  orderNotifications: z.boolean().optional(),
  repairNotifications: z.boolean().optional(),
  creditNotifications: z.boolean().optional(),
  promotions: z.boolean().optional(),
  marketingCommunications: z.boolean().optional(),
  publicProfile: z.boolean().optional(),
}).strict()

const columns = 'order_notifications, repair_notifications, credit_notifications, promotions, marketing_communications, public_profile'
const toApi = (row: Record<string, boolean>) => ({
  orderNotifications: row.order_notifications,
  repairNotifications: row.repair_notifications,
  creditNotifications: row.credit_notifications,
  promotions: row.promotions,
  marketingCommunications: row.marketing_communications,
  publicProfile: row.public_profile,
})

async function session() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  return { db, user }
}

export async function GET() {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  const { data, error } = await db.from('marketplace_user_preferences').select(columns).eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'No se pudieron cargar las preferencias' }, { status: 500 })
  return NextResponse.json({ preferences: data ? toApi(data) : preferenceDefaults })
}

export async function PATCH(request: NextRequest) {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  const parsed = preferencePatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: 'Preferencias inválidas' }, { status: 400 })
  const p = parsed.data
  const row = {
    user_id: user.id,
    ...(p.orderNotifications === undefined ? {} : { order_notifications: p.orderNotifications }),
    ...(p.repairNotifications === undefined ? {} : { repair_notifications: p.repairNotifications }),
    ...(p.creditNotifications === undefined ? {} : { credit_notifications: p.creditNotifications }),
    ...(p.promotions === undefined ? {} : { promotions: p.promotions }),
    ...(p.marketingCommunications === undefined ? {} : { marketing_communications: p.marketingCommunications }),
    ...(p.publicProfile === undefined ? {} : { public_profile: p.publicProfile }),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await db.from('marketplace_user_preferences').upsert(row, { onConflict: 'user_id' }).select(columns).single()
  if (error || !data) return NextResponse.json({ error: 'No se pudieron guardar las preferencias' }, { status: 500 })
  return NextResponse.json({ preferences: toApi(data) })
}
