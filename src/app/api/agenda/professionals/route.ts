import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const guard = { permission: 'settings.manage', module: 'services' } as const

const professionalSchema = z.object({
  name: z.string().trim().min(1, 'Poné el nombre').max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  phone: z.string().trim().max(40).nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
})

const COLUMNS = 'id, name, color, phone, is_active, sort_order'

export const POST = withTenantAuth(guard, async (request, { organization }) => {
  const parsed = professionalSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Revisá los datos' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agenda_professionals')
    .insert({ ...parsed.data, phone: parsed.data.phone || null, organization_id: organization.id })
    .select(COLUMNS)
    .single()
  if (error) {
    logger.error('No se pudo crear el profesional', { error: error.message })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ professional: data }, { status: 201 })
})

/** Editar o dar de baja. No se borra: los turnos viejos siguen mostrando quién atendió. */
export const PATCH = withTenantAuth(guard, async (request, { organization }) => {
  const body = await request.json().catch(() => null) as { id?: unknown } | null
  const id = z.string().uuid().safeParse(body?.id)
  const parsed = professionalSchema.partial().safeParse(body)
  if (!id.success || !parsed.success) return NextResponse.json({ error: 'Revisá los datos' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agenda_professionals')
    .update({ ...parsed.data, ...('phone' in parsed.data ? { phone: parsed.data.phone || null } : {}) })
    .eq('id', id.data)
    .eq('organization_id', organization.id)
    .select(COLUMNS)
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ professional: data })
})
