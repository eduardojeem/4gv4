import type { SupabaseClient } from '@supabase/supabase-js'
import { utcToZoned, zonedToUtc } from '@/lib/agenda/time'
export function repairMonthWindow(now = Date.now()) {
  const timeZone = 'America/Asuncion'
  const local = utcToZoned(now, timeZone).date
  const [year, month] = local.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0,10)
  return { startsAt: new Date(zonedToUtc(local.slice(0,7)+'-01','00:00',timeZone)).toISOString(), endsAt: new Date(zonedToUtc(next,'00:00',timeZone)).toISOString(), timeZone }
}
export async function countMonthlyRepairs(client: SupabaseClient, organizationId: string, now = Date.now()) {
  const period = repairMonthWindow(now)
  const { count, error } = await client.from('repairs').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).gte('created_at',period.startsAt).lt('created_at',period.endsAt)
  if (error || count === null) throw new Error('No se pudo contar el cupo mensual de reparaciones.')
  return { ...period, current: count }
}
