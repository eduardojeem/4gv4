import 'server-only'
import type { createAdminSupabase } from '@/lib/supabase/admin'
import type { ProductCreditDefaults } from '@/types/website-settings'

export class CreditDefaultsConflict extends Error {
  constructor(message: string, readonly status = 409) { super(message) }
}

/** Compare-and-swap one existing settings key; never overwrite unrelated settings. */
export async function saveCreditDefaults(client: ReturnType<typeof createAdminSupabase>, input: {
  organizationId: string; actorId: string; revision: string; value: ProductCreditDefaults
}) {
  const { revision } = input
  if (!['missing', 'unversioned'].includes(revision) && (revision.length > 120 || !Number.isFinite(Date.parse(revision)))) {
    throw new CreditDefaultsConflict('La versión recibida no es válida. Recargá la configuración.', 400)
  }
  const timestamp = new Date(Math.max(Date.now(), (Date.parse(revision) || 0) + 1)).toISOString()
  const row = { organization_id: input.organizationId, key: 'product_credit_defaults', value: input.value, updated_by: input.actorId, updated_at: timestamp }
  const table = client.from('website_settings')
  let query
  if (revision === 'missing') query = table.insert(row)
  else {
    const update = table.update(row).eq('organization_id', input.organizationId).eq('key', row.key)
    query = revision === 'unversioned' ? update.is('updated_at', null) : update.eq('updated_at', revision)
  }
  const { data, error } = await query.select('key, value, updated_at').maybeSingle()
  if (error?.code === '23505' || (!error && !data)) throw new CreditDefaultsConflict('Otro administrador guardó cambios. Tu borrador se conserva; descartá y recargá antes de volver a guardar.')
  if (error) throw new CreditDefaultsConflict('No se pudo guardar la configuración. Tu borrador se conserva.', 503)
  return data
}
