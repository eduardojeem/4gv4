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

// Solo minusculas, numeros y guion bajo: es literalmente el segmento de URL
// de /perfil/[username], asi que nada que rompa una ruta.
export const usernameSchema = z.string()
  .trim()
  .toLowerCase()
  .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
  .max(30, 'El nombre de usuario no puede superar los 30 caracteres')
  .regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guion bajo')

export const preferencePatchSchema = z.object({
  orderNotifications: z.boolean().optional(),
  repairNotifications: z.boolean().optional(),
  creditNotifications: z.boolean().optional(),
  promotions: z.boolean().optional(),
  marketingCommunications: z.boolean().optional(),
  publicProfile: z.boolean().optional(),
  username: usernameSchema.optional(),
}).strict()

const columns = 'order_notifications, repair_notifications, credit_notifications, promotions, marketing_communications'
const toApi = (row: Record<string, boolean>) => ({
  orderNotifications: row.order_notifications,
  repairNotifications: row.repair_notifications,
  creditNotifications: row.credit_notifications,
  promotions: row.promotions,
  marketingCommunications: row.marketing_communications,
})

async function session() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  return { db, user }
}

export async function GET() {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  const [prefsResult, profileResult] = await Promise.all([
    db.from('marketplace_user_preferences').select(columns).eq('user_id', user.id).maybeSingle(),
    // publicProfile y username viven en profiles: es lo que realmente mira
    // la pagina publica y su politica RLS, no marketplace_user_preferences.
    db.from('profiles').select('username, is_public').eq('id', user.id).maybeSingle(),
  ])
  if (prefsResult.error) return NextResponse.json({ error: 'No se pudieron cargar las preferencias' }, { status: 500 })
  return NextResponse.json({
    preferences: {
      ...(prefsResult.data ? toApi(prefsResult.data) : preferenceDefaults),
      publicProfile: profileResult.data?.is_public ?? false,
    },
    username: profileResult.data?.username ?? null,
  })
}

export async function PATCH(request: NextRequest) {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  const parsed = preferencePatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: 'Preferencias inválidas' }, { status: 400 })
  const p = parsed.data
  const { publicProfile, username, ...rest } = p

  // publicProfile y username se aplican sobre profiles, no sobre
  // marketplace_user_preferences.
  if (publicProfile !== undefined || username !== undefined) {
    const nextUsername = username
    if (publicProfile === true && nextUsername === undefined) {
      const { data: current } = await db.from('profiles').select('username').eq('id', user.id).maybeSingle()
      if (!current?.username) {
        return NextResponse.json(
          { error: 'Elegí un nombre de usuario antes de activar tu perfil público.' },
          { status: 400 },
        )
      }
    }

    const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (publicProfile !== undefined) profileUpdate.is_public = publicProfile
    if (nextUsername !== undefined) profileUpdate.username = nextUsername

    const { error: profileError } = await db.from('profiles').update(profileUpdate).eq('id', user.id)
    if (profileError) {
      // Constraint de unicidad de profiles_username_key.
      const message = profileError.code === '23505'
        ? 'Ese nombre de usuario ya está en uso.'
        : 'No se pudo actualizar el perfil público.'
      return NextResponse.json({ error: message }, { status: profileError.code === '23505' ? 409 : 500 })
    }
  }

  const hasPreferenceFields = Object.keys(rest).length > 0
  let preferencesRow: Record<string, boolean> | null = null
  if (hasPreferenceFields) {
    const row = {
      user_id: user.id,
      ...(rest.orderNotifications === undefined ? {} : { order_notifications: rest.orderNotifications }),
      ...(rest.repairNotifications === undefined ? {} : { repair_notifications: rest.repairNotifications }),
      ...(rest.creditNotifications === undefined ? {} : { credit_notifications: rest.creditNotifications }),
      ...(rest.promotions === undefined ? {} : { promotions: rest.promotions }),
      ...(rest.marketingCommunications === undefined ? {} : { marketing_communications: rest.marketingCommunications }),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await db.from('marketplace_user_preferences').upsert(row, { onConflict: 'user_id' }).select(columns).single()
    if (error || !data) return NextResponse.json({ error: 'No se pudieron guardar las preferencias' }, { status: 500 })
    preferencesRow = data
  }

  const [prefsResult, profileResult] = await Promise.all([
    preferencesRow
      ? Promise.resolve({ data: preferencesRow })
      : db.from('marketplace_user_preferences').select(columns).eq('user_id', user.id).maybeSingle(),
    db.from('profiles').select('username, is_public').eq('id', user.id).maybeSingle(),
  ])

  return NextResponse.json({
    preferences: {
      ...(prefsResult.data ? toApi(prefsResult.data) : preferenceDefaults),
      publicProfile: profileResult.data?.is_public ?? false,
    },
    username: profileResult.data?.username ?? null,
  })
}
