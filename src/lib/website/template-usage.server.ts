import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { summarizeTemplateUsage } from './template-usage'

/** Paginate both sources: Supabase caps rows, and organizations without settings also count. */
export async function loadTemplateUsage() {
 const admin = createAdminSupabase()
 const ids: string[] = []
 const settings: { organization_id: string; value: unknown }[] = []
 const pageSize = 500
 for (let offset = 0; ; offset += pageSize) {
  const { data, error } = await admin.from('organizations').select('id').order('id').range(offset, offset + pageSize - 1)
  if (error) throw error
  ids.push(...(data ?? []).map(row => row.id))
  if ((data?.length ?? 0) < pageSize) break
 }
 for (let offset = 0; ; offset += pageSize) {
  const { data, error } = await admin.from('website_settings').select('organization_id, value').eq('key', 'company_info').order('organization_id').range(offset, offset + pageSize - 1)
  if (error) throw error
  settings.push(...(data ?? []))
  if ((data?.length ?? 0) < pageSize) break
 }
 return summarizeTemplateUsage(ids, settings)
}
