import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { DEFAULT_TIMEZONE } from '@/lib/agenda/time'
import { isMissingTable } from '@/lib/agenda/agenda-server'
import { buildAgendaAnalytics, buildAgendaInsights, type AgendaAppointmentRow } from '@/lib/analytics/agenda-analytics'

export const dynamic = 'force-dynamic'

/** Los mismos permisos que la agenda: quien ve la agenda ve sus números. */
const guard = { permission: 'pos.sales.read', module: 'services' } as const

const COLUMNS = 'id, status, source, price, sale_id, starts_at, ends_at, professional_id, service_product_id, service_name, customer_id, customer_phone, customer_name'
const PAGE = 1000
/** Tope de turnos leídos: años de agenda de un local grande. */
const MAX_ROWS = 50_000
const MAX_RANGE_DAYS = 400

/**
 * GET /api/admin/analytics/agenda?from=<ISO>&to=<ISO>
 * Turnos, asistencia, facturación, servicios y profesionales del período.
 */
export const GET = withTenantAuth(guard, async (request, { organization }) => {
  const params = new URL(request.url).searchParams
  const from = Date.parse(params.get('from') ?? '')
  const to = Date.parse(params.get('to') ?? '')
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || to - from > MAX_RANGE_DAYS * 86_400_000) {
    return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 })
  }

  const supabase = (await createClient()) as unknown as SupabaseClient
  const now = Date.now()
  // Hasta el fin del período o la semana que viene: la historia anterior dice
  // quién es cliente nuevo y lo que viene alimenta «Próximos 7 días».
  const until = new Date(Math.max(to, now + 7 * 86_400_000)).toISOString()

  try {
    const rows: AgendaAppointmentRow[] = []
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      const { data, error } = await supabase
        .from('appointments')
        .select(COLUMNS)
        .eq('organization_id', organization.id)
        .lte('starts_at', until)
        .order('starts_at', { ascending: true })
        .range(offset, offset + PAGE - 1)
      if (error) {
        if (isMissingTable(error)) return NextResponse.json({ data: null, available: false })
        throw error
      }
      rows.push(...((data ?? []) as AgendaAppointmentRow[]))
      if (!data || data.length < PAGE) break
    }

    const [{ data: professionals }, { data: settings }] = await Promise.all([
      supabase.from('agenda_professionals').select('id, name').eq('organization_id', organization.id),
      supabase.from('organization_settings').select('timezone').eq('organization_id', organization.id).maybeSingle(),
    ])
    const professionalNames = Object.fromEntries(
      ((professionals ?? []) as Array<{ id: string; name: string }>).map((professional) => [professional.id, professional.name]),
    )

    const data = buildAgendaAnalytics(rows, {
      from,
      to,
      now,
      timeZone: (settings as { timezone?: string | null } | null)?.timezone || DEFAULT_TIMEZONE,
      professionalNames,
    })
    return NextResponse.json({ data, insights: buildAgendaInsights(data), available: true, truncated: rows.length >= MAX_ROWS })
  } catch (error) {
    logger.error('[analytics/agenda] GET', { error, organizationId: organization.id })
    return NextResponse.json({ error: 'No se pudieron calcular los números de la agenda.' }, { status: 500 })
  }
})
