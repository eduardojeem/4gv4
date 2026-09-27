import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  dashboardProfilePatchSchema,
  toDashboardProfile,
  toProfileUpdate,
} from '@/lib/profile/dashboard-profile-contract'

const PROFILE_COLUMNS = [
  'id', 'full_name', 'role', 'avatar_url', 'phone', 'email', 'department',
  'status', 'bio', 'website', 'job_title', 'timezone', 'social_links',
  'preferences', 'location', 'updated_at',
].join(',')

async function session() {
  const db = await createClient()
  const { data: { user }, error } = await db.auth.getUser()
  return { db, user: error ? null : user }
}

export async function GET() {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })

  const { data, error } = await db
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'No se pudo cargar el perfil' }, { status: 500 })
  const profileRow = (data ?? { id: user.id }) as unknown as Record<string, unknown>
  return NextResponse.json({ profile: toDashboardProfile(profileRow, user) })
}

export async function PATCH(request: Request) {
  const { db, user } = await session()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })

  const input = await request.json().catch(() => null)
  const parsed = dashboardProfilePatchSchema.safeParse(input)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de perfil inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const update = {
    ...toProfileUpdate(parsed.data),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await db
    .from('profiles')
    .update(update)
    .eq('id', user.id)
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'No se pudo guardar el perfil' }, { status: 500 })
  }

  const authMetadata = {
    ...(parsed.data.fullName === undefined ? {} : { full_name: parsed.data.fullName }),
    ...(parsed.data.phone === undefined ? {} : { phone: parsed.data.phone }),
    ...(parsed.data.avatarUrl === undefined ? {} : { avatar_url: parsed.data.avatarUrl }),
  }

  if (Object.keys(authMetadata).length > 0) {
    const { error: authError } = await db.auth.updateUser({ data: authMetadata })
    if (authError) {
      return NextResponse.json({
        error: 'El perfil se guardó, pero la sesión no terminó de sincronizarse',
        partial: true,
        profile: toDashboardProfile(data as unknown as Record<string, unknown>, user),
      }, { status: 207 })
    }
  }

  return NextResponse.json({
    profile: toDashboardProfile(data as unknown as Record<string, unknown>, user),
    partial: false,
  })
}
