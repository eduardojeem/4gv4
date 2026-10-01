import type { SupabaseClient } from '@supabase/supabase-js'
import { errorMessage } from '@/lib/health/core'

/** Forma de `public.get_system_health_catalog()` (migración 20260927160000). */
export interface CatalogPolicy {
  name: string
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL'
  permissive: boolean
  roles: string[]
  using: string | null
  with_check: string | null
}

export interface CatalogTable {
  name: string
  rls_enabled: boolean
  rls_forced: boolean
  has_organization_id: boolean
  has_branch_id: boolean
  estimated_rows: number
  anon_select: boolean
  authenticated_select: boolean
  policies: CatalogPolicy[]
}

export interface CatalogView {
  name: string
  kind: 'view' | 'materialized'
  security_invoker: boolean
  has_organization_id: boolean
  anon_select: boolean
  authenticated_select: boolean
}

export interface CatalogBucket {
  id: string
  public: boolean
  file_size_limit: number | null
  object_count: number
  total_bytes: number
}

export interface HealthCatalog {
  collected_at: string
  tables: CatalogTable[]
  views: CatalogView[]
  anon_security_definer_functions: string[]
  storage_buckets: CatalogBucket[]
  auth_users: {
    total: number
    confirmed: number
    banned: number
    signed_in_30d: number
    created_30d: number
  } | null
  migrations: { count: number; latest: string | null; versions: string[] | null } | null
}

export type CatalogResult =
  | { available: true; catalog: HealthCatalog }
  | { available: false; reason: string }

export const HEALTH_MIGRATION = 'supabase/migrations/20260927160000_system_health_center.sql'

export function isMissingObjectError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST202' || // RPC no encontrada en el schema cache
    error.code === 'PGRST205' || // tabla no encontrada en el schema cache
    error.code === '42883' ||
    error.code === '42P01' ||
    /does not exist|could not find/i.test(error.message ?? '')
  )
}

export async function loadHealthCatalog(admin: SupabaseClient): Promise<CatalogResult> {
  try {
    const [{ data, error }, migrationVersions] = await Promise.all([
      admin.rpc('get_system_health_catalog'),
      admin.rpc('get_system_health_migration_versions'),
    ])
    if (error) {
      return {
        available: false,
        reason: isMissingObjectError(error)
          ? `La RPC get_system_health_catalog() no existe todavía. Aplicar ${HEALTH_MIGRATION}.`
          : `get_system_health_catalog() falló: ${errorMessage(error)}`,
      }
    }
    if (!data || typeof data !== 'object') {
      return { available: false, reason: 'get_system_health_catalog() no devolvió datos.' }
    }
    const catalog = data as HealthCatalog
    if (catalog.migrations) {
      catalog.migrations.versions = migrationVersions.error || !Array.isArray(migrationVersions.data)
        ? null
        : migrationVersions.data.map(String)
    }
    return { available: true, catalog }
  } catch (error) {
    return { available: false, reason: errorMessage(error) }
  }
}
