import type { createAdminSupabase } from '@/lib/supabase/admin'

/**
 * Vincular a mano las categorías y marcas de las empresas con el catálogo
 * global, y deshacerlo.
 *
 * Vincular por nombre solo encuentra lo que coincide: «Smartphones» nunca iba
 * a caer en «Celulares». La única salida era agregar un alias a mano y volver
 * a vincular. Acá se elige la global de destino y, si se quiere, el nombre de
 * la empresa queda como alias para que la próxima tienda se vincule sola.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export type CatalogKind = 'category' | 'brand'

const CONFIG = {
  category: { tenantTable: 'categories', foreignKey: 'global_category_id', globalTable: 'global_categories' },
  brand: { tenantTable: 'brands', foreignKey: 'global_brand_id', globalTable: 'global_brands' },
} as const

const normalized = (value: string) => value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Agrega el alias si no es el nombre ni está ya (sin distinguir mayúsculas ni tildes). */
export function withAlias(name: string, aliases: string[] | null | undefined, alias: string | null | undefined): string[] | null {
  const clean = alias?.trim()
  const current = aliases ?? []
  if (!clean) return null
  if (normalized(clean) === normalized(name) || current.some((existing) => normalized(existing) === normalized(clean))) return null
  return [...current, clean].slice(0, 20)
}

export async function linkToExisting(
  admin: Admin,
  kind: CatalogKind,
  input: { targetId: string; ids: string[]; alias?: string | null },
): Promise<{ linked: number; aliasAdded: boolean } | { error: string }> {
  const config = CONFIG[kind]
  const columns = kind === 'brand' ? 'id, name, aliases, logo_url, is_active' : 'id, name, aliases, is_active'
  const { data: target } = await admin.from(config.globalTable).select(columns).eq('id', input.targetId).maybeSingle()
  const row = target as unknown as { id: string; name: string; aliases: string[] | null; logo_url?: string | null; is_active: boolean } | null
  if (!row) return { error: kind === 'brand' ? 'La marca de destino no existe.' : 'La categoría de destino no existe.' }
  if (!row.is_active) return { error: 'Está dada de baja: reactivala antes de vincular.' }

  // Las marcas vinculadas toman el nombre y el logo oficial, igual que al
  // vincular por nombre. Las categorías conservan el nombre de la empresa.
  const updates: Record<string, unknown> = { [config.foreignKey]: row.id }
  if (kind === 'brand') Object.assign(updates, { name: row.name, logo_url: row.logo_url ?? null, updated_at: new Date().toISOString() })

  const { data: updated, error } = await admin
    .from(config.tenantTable)
    .update(updates)
    .in('id', input.ids)
    .is(config.foreignKey, null)
    .select('id')
  if (error) return { error: 'No se pudo vincular.' }

  const aliases = withAlias(row.name, row.aliases, input.alias)
  if (aliases) await admin.from(config.globalTable).update({ aliases, updated_at: new Date().toISOString() }).eq('id', row.id)

  return { linked: updated?.length ?? 0, aliasAdded: Boolean(aliases) }
}

export type CatalogUsageRow = { id: string; name: string; organizationName: string | null }

/** Las fichas de empresas vinculadas a una global. */
export async function listUsage(admin: Admin, kind: CatalogKind, globalId: string): Promise<CatalogUsageRow[]> {
  const config = CONFIG[kind]
  const { data } = await admin
    .from(config.tenantTable)
    .select('id, name, organizations(name)')
    .eq(config.foreignKey, globalId)
    .order('name')
    .limit(500)
  return ((data ?? []) as unknown as Array<{ id: string; name: string; organizations: { name?: string } | Array<{ name?: string }> | null }>).map((row) => {
    const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
    return { id: row.id, name: row.name, organizationName: organization?.name ?? null }
  })
}

/**
 * Deshace un vínculo equivocado. En una marca también se quita el logo
 * oficial, que era de la global; el nombre queda como está.
 */
export async function unlink(admin: Admin, kind: CatalogKind, ids: string[]): Promise<number | { error: string }> {
  const config = CONFIG[kind]
  const updates: Record<string, unknown> = { [config.foreignKey]: null }
  if (kind === 'brand') Object.assign(updates, { logo_url: null, updated_at: new Date().toISOString() })
  const { data, error } = await admin
    .from(config.tenantTable)
    .update(updates)
    .in('id', ids)
    .select('id')
  if (error) return { error: 'No se pudo desvincular.' }
  return data?.length ?? 0
}
