import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  APPOINTMENT_OWNER_SELECT,
  appointmentReader,
  appointmentsResponse,
  appointmentsFailure,
  mapOwnedAppointments,
  type OwnedAppointmentRow,
} from '@/lib/agenda/owned-customer-appointments'
export const dynamic = 'force-dynamic'
const querySchema = z.object({
  kind: z.enum(['upcoming', 'past']).default('upcoming'),
  cursor: z.string().max(120).optional(),
})
export async function GET(request: NextRequest) {
  const auth = await appointmentReader()
  if (auth.response) return auth.response
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()))
  if (!parsed.success)
    return appointmentsResponse({ error: 'Los filtros de turnos no son válidos.' }, 400)
  let cursor: { date: string; id: string } | null = null
  if (parsed.data.cursor) {
    const separator = parsed.data.cursor.lastIndexOf('|')
    const date = parsed.data.cursor.slice(0, separator),
      id = parsed.data.cursor.slice(separator + 1)
    if (
      separator < 1 ||
      !z.iso.datetime({ offset: true }).safeParse(date).success ||
      !z.string().uuid().safeParse(id).success
    )
      return appointmentsResponse({ error: 'La página de turnos no es válida.' }, 400)
    cursor = { date: new Date(date).toISOString(), id }
  }
  try {
    const db = createAdminSupabase()
    const upcoming = parsed.data.kind === 'upcoming'
    const now = new Date().toISOString()
    let query = db
      .from('appointments')
      .select(APPOINTMENT_OWNER_SELECT)
      .eq('customer.profile_id', auth.userId!)
      .order('starts_at', { ascending: upcoming })
      .order('id', { ascending: upcoming })
      .limit(21)
    if (upcoming) query = query.in('status', ['pending', 'confirmed']).gt('ends_at', now)
    else query = query.or('status.not.in.(pending,confirmed),ends_at.lte.' + now)
    if (cursor) {
      const op = upcoming ? 'gt' : 'lt'
      query = query.or(
        'starts_at.' +
          op +
          '.' +
          cursor.date +
          ',and(starts_at.eq.' +
          cursor.date +
          ',id.' +
          op +
          '.' +
          cursor.id +
          ')',
      )
    }
    const result = await query
    if (result.error) return appointmentsFailure(result.error)
    const rows = (result.data ?? []) as unknown as OwnedAppointmentRow[]
    const page = rows.slice(0, 20)
    const items = await mapOwnedAppointments(db, page, auth.userId!)
    const last = page.at(-1)
    return appointmentsResponse({
      items,
      nextCursor:
        rows.length > 20 && last ? new Date(last.starts_at).toISOString() + '|' + last.id : null,
      kind: parsed.data.kind,
    })
  } catch {
    return appointmentsFailure(null)
  }
}
