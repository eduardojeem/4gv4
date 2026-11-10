import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const guard = { permission: 'settings.manage', module: 'services' } as const

/**
 * Con qué empleado del sistema se vincula un profesional de la agenda. Sirve
 * para las comisiones: el servicio de un turno lo comisiona el profesional que
 * atendió, no quien cobró en el POS.
 */
async function employees(organizationId: string) {
  const admin = createAdminSupabase()
  const { data: members, error } = await admin
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .neq('role', 'customer')
  if (error) throw error
  const ids = (members ?? []).map((member) => member.user_id)
  const { data: profiles } = ids.length
    ? await admin.from('profiles').select('id, full_name, email').in('id', ids)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> }
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || profile.email || 'Usuario']))
  return (members ?? [])
    .map((member) => ({ id: member.user_id as string, role: member.role as string, name: names.get(member.user_id) ?? 'Usuario' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export const GET = withTenantAuth(guard, async (request, { organization }) => {
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get('id'))
  if (!id.success) return NextResponse.json({ error: 'Profesional no válido' }, { status: 400 })
  try {
    const { data, error } = await createAdminSupabase()
      .from('agenda_professionals')
      .select('id, user_id')
      .eq('organization_id', organization.id)
      .eq('id', id.data)
      .maybeSingle()
    if (error) {
      // Sin la migración de comisiones todavía no existe la columna.
      if (/user_id/.test(error.message)) return NextResponse.json({ available: false, employees: [], userId: null })
      throw error
    }
    if (!data) return NextResponse.json({ error: 'Profesional no encontrado' }, { status: 404 })
    return NextResponse.json({ available: true, employees: await employees(organization.id), userId: data.user_id ?? null })
  } catch (error) {
    logger.error('[agenda-professional-employee] GET', { error: error instanceof Error ? error.message : error })
    return NextResponse.json({ error: 'No se pudo leer el vínculo' }, { status: 500 })
  }
})

const linkSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid().nullable() })

export const PUT = withTenantAuth(guard, async (request, { organization }) => {
  const parsed = linkSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisá los datos' }, { status: 400 })
  const { id, userId } = parsed.data
  try {
    if (userId && !(await employees(organization.id)).some((employee) => employee.id === userId)) {
      return NextResponse.json({ error: 'Ese usuario no es un empleado activo del negocio.' }, { status: 422 })
    }
    const { data, error } = await createAdminSupabase()
      .from('agenda_professionals')
      .update({ user_id: userId })
      .eq('organization_id', organization.id)
      .eq('id', id)
      .select('id, user_id')
      .maybeSingle()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Ese empleado ya está vinculado a otro profesional.' }, { status: 409 })
      if (/user_id/.test(error.message)) return NextResponse.json({ error: 'Falta aplicar la migración de comisiones.' }, { status: 503 })
      throw error
    }
    if (!data) return NextResponse.json({ error: 'Profesional no encontrado' }, { status: 404 })
    return NextResponse.json({ userId: data.user_id ?? null })
  } catch (error) {
    logger.error('[agenda-professional-employee] PUT', { error: error instanceof Error ? error.message : error })
    return NextResponse.json({ error: 'No se pudo guardar el vínculo' }, { status: 500 })
  }
})
