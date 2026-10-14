import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { todayIn, zonedToUtc } from '@/lib/agenda/time'

export function technicianMonthPeriod(month: string, timezone: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('TECHNICIAN_INVALID_PERIOD')
  const [year, m] = month.split('-').map(Number)
  if (year < 1900 || year > 9998) throw new Error('TECHNICIAN_INVALID_PERIOD')
  const fromDate = month + '-01'
  const toDate = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10)
  return { from: new Date(zonedToUtc(fromDate, '00:00', timezone)).toISOString(),
    to: new Date(zonedToUtc(toDate, '00:00', timezone)).toISOString(), fromDate, toDate }
}

export async function getTechnicianPeriod(supabase: SupabaseClient, organizationId: string, url: URL) {
  const from = url.searchParams.get('from'), to = url.searchParams.get('to')
  if (from || to) {
    const timestamp = z.union([z.iso.datetime({ offset: true }), z.iso.date()])
    if (!from || !to || !timestamp.safeParse(from).success || !timestamp.safeParse(to).success
      || Date.parse(from) >= Date.parse(to)) throw new Error('TECHNICIAN_INVALID_PERIOD')
    return { from, to, fromDate: from.slice(0, 10), toDate: to.slice(0, 10) }
  }
  const { data, error } = await supabase.from('organization_settings').select('timezone')
    .eq('organization_id', organizationId).maybeSingle()
  if (error) throw error
  const timezone = data?.timezone || 'America/Asuncion'
  return technicianMonthPeriod(url.searchParams.get('month') || todayIn(timezone).slice(0, 7), timezone)
}
