import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapSettingsToDB,
  type SystemSettingsPartial,
} from '@/lib/validations/system-settings'

export async function saveSystemSettingsViaSupabase(
  supabase: SupabaseClient,
  settings: SystemSettingsPartial
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const dbData = mapSettingsToDB(settings)

  const { data, error } = await supabase
    .from('system_settings')
    .upsert(
      {
        id: 'system',
        ...dbData,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}
