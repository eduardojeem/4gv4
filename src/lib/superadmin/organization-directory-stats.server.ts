import 'server-only'
import type { createAdminSupabase } from '@/lib/supabase/admin'
import { chunkValues, fetchAllRows } from './fetch-all-rows'
import { summarizeOrganizationMembers } from './organization-directory'

type Admin = ReturnType<typeof createAdminSupabase>

export type OrganizationDirectoryStats = {
  members_total: number
  members_active: number
  members_invited: number
  members_suspended: number
  staff_total: number
  staff_active: number
  staff_invited: number
  staff_suspended: number
  customers_total: number
  /** Dueño + miembros que no son clientes de la tienda web. */
  team_size: number
  last_access_at: string | null
  last_sale_at: string | null
  /** `null` cuando no se pudo contar. */
  products_total: number | null
}

export type DirectoryStatsResult = {
  stats: Map<string, OrganizationDirectoryStats>
  /** `false` si no se pudo leer el último acceso: la vista no afirma «nunca entró». */
  accessKnown: boolean
}

type StatsRow = Omit<OrganizationDirectoryStats, 'products_total'> & {
  organization_id: string
  products_total: number | null
}

/**
 * Una sola llamada agregada (`superadmin_organization_directory_stats`) en
 * lugar de 2 consultas por organización, todo `auth.users` y cada fila de
 * miembros. Si la función todavía no existe (la migración no se aplicó), cae
 * a contar miembros y deja la actividad «Sin dato» en vez de inventarla.
 */
export async function loadDirectoryStats(
  admin: Admin,
  organizations: Array<{ id: string; owner_id: string | null }>,
): Promise<DirectoryStatsResult> {
  const { data, error } = await admin.rpc('superadmin_organization_directory_stats')
  if (!error && Array.isArray(data)) {
    const stats = new Map<string, OrganizationDirectoryStats>()
    for (const row of data as StatsRow[]) {
      const { organization_id, ...rest } = row
      stats.set(organization_id, rest)
    }
    return { stats, accessKnown: true }
  }

  console.warn('[superadmin/organizations] directory stats rpc unavailable, using member counts only', error?.message)
  return { stats: await loadMemberCountsOnly(admin, organizations), accessKnown: false }
}

type MemberRow = { organization_id: string; role: string; status: string }

async function loadMemberCountsOnly(admin: Admin, organizations: Array<{ id: string; owner_id: string | null }>) {
  const ids = organizations.map((organization) => organization.id)
  const members = (await Promise.all(chunkValues(ids).map((chunk) =>
    fetchAllRows<MemberRow>((from, to) =>
      admin.from('organization_members').select('organization_id, role, status').in('organization_id', chunk).range(from, to)
    )
  ))).flat()

  const byOrganization = new Map<string, MemberRow[]>()
  for (const member of members) {
    const list = byOrganization.get(member.organization_id) ?? []
    list.push(member)
    byOrganization.set(member.organization_id, list)
  }

  const stats = new Map<string, OrganizationDirectoryStats>()
  for (const organization of organizations) {
    const list = byOrganization.get(organization.id) ?? []
    const summary = summarizeOrganizationMembers(list)
    stats.set(organization.id, {
      members_total: list.length,
      members_active: list.filter((member) => member.status === 'active').length,
      members_invited: list.filter((member) => member.status === 'invited').length,
      members_suspended: list.filter((member) => member.status === 'suspended').length,
      staff_total: summary.staffTotal,
      staff_active: summary.staffActive,
      staff_invited: summary.staffInvited,
      staff_suspended: summary.staffSuspended,
      customers_total: summary.customersTotal,
      team_size: summary.staffTotal + (organization.owner_id ? 1 : 0),
      last_access_at: null,
      last_sale_at: null,
      products_total: null,
    })
  }
  return stats
}
