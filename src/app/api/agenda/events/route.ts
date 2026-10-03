import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const guard = { permission: 'pos.sales.read', module: 'services' } as const

/** Las últimas novedades de turnos hechas por clientes y cuántas faltan ver. */
export const GET = withTenantAuth(guard, async (_request, { organization }) => {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const [list, unseen] = await Promise.all([
    supabase
      .from('appointment_events')
      .select('id, appointment_id, kind, customer_name, service_name, starts_at, previous_starts_at, seen_at, created_at')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('appointment_events')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .is('seen_at', null),
  ])
  // Sin la migración: sin novedades, en vez de un error en la Agenda.
  if (list.error) {
    if (!/does not exist|schema cache/i.test(list.error.message)) logger.error('No se pudieron cargar las novedades de turnos', { error: list.error.message })
    return NextResponse.json({ events: [], unseen: 0, available: false })
  }
  return NextResponse.json({ events: list.data ?? [], unseen: unseen.count ?? 0, available: true })
})

/** Marca todas como vistas. */
export const PATCH = withTenantAuth(guard, async (_request, { organization }) => {
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { error } = await supabase
    .from('appointment_events')
    .update({ seen_at: new Date().toISOString() })
    .eq('organization_id', organization.id)
    .is('seen_at', null)
  if (error) {
    logger.error('No se pudieron marcar las novedades como vistas', { error: error.message })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
})
