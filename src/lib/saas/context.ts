import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { mapLegacyRoleToOrganizationRole, type OrganizationRole } from './permissions'
import type { SaaSPlan } from './plans'

export interface OrganizationContext {
  id: string
  name: string
  slug: string
  plan: SaaSPlan
  logoUrl: string | null
  role: OrganizationRole
}

export async function getCurrentOrganizationContext(userId: string): Promise<OrganizationContext | null> {
  const headerStore = await headers()
  const requestedSlug = headerStore.get('x-tenant-slug')
  const activeOrganizationId = headerStore.get('x-organization-id')
  const supabase = await createClient()

  // Trae TODAS las membresías staff (no-cliente) activas del usuario.
  const fetchMemberships = (client: ReturnType<typeof createClient> | ReturnType<typeof createAdminSupabase>) =>
    (client as ReturnType<typeof createAdminSupabase>)
      .from('organization_members')
      .select('role, organizations!inner(id, name, slug, plan, logo_url)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('role', 'customer')

  let { data, error } = await fetchMemberships(supabase)

  // Retry con admin client si la sesión no está disponible (rutas API).
  if (error || !data || data.length === 0) {
    const admin = createAdminSupabase()
    const fallback = await fetchMemberships(admin)
    data = fallback.data
    error = fallback.error
  }

  if (error || !data || data.length === 0) {
    return null
  }

  type MembershipRow = { role: string; organizations: { id: string; name: string; slug: string; plan: string; logo_url: string | null } | { id: string; name: string; slug: string; plan: string; logo_url: string | null }[] }
  const rows = data as unknown as MembershipRow[]
  const orgOf = (row: MembershipRow) => (Array.isArray(row.organizations) ? row.organizations[0] : row.organizations)

  // Prioridad de rol para elegir la org "principal": owner > admin > resto.
  const rolePriority = (role: string) => (role === 'owner' ? 0 : role === 'admin' ? 1 : 2)
  const byBestRole = [...rows].sort((a, b) => rolePriority(a.role) - rolePriority(b.role))

  let chosen: MembershipRow | null = null
  if (requestedSlug) {
    // Ruta con slug (público/tenant): solo si el usuario es miembro de esa tienda.
    chosen = rows.find((row) => orgOf(row)?.slug === requestedSlug) ?? null
  } else {
    // Dashboard/admin: respetar el cookie de org activa si es una membresía válida;
    // si el cookie es inválido/obsoleto, caer a la mejor org (owner-preferida) en vez de null.
    if (activeOrganizationId) {
      chosen = rows.find((row) => orgOf(row)?.id === activeOrganizationId) ?? null
    }
    if (!chosen) {
      chosen = byBestRole[0] ?? null
    }
  }

  if (!chosen) return null
  const organization = orgOf(chosen)
  if (!organization) return null

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    plan: organization.plan as SaaSPlan,
    logoUrl: organization.logo_url,
    role: mapLegacyRoleToOrganizationRole(chosen.role),
  }
}

/**
 * Organizacion a la que pertenece un usuario: primero la activa, y si no hay,
 * su membresia mas antigua. Devuelve null cuando no es miembro de ninguna.
 *
 * Se comparte porque el registro de auditoria la necesita en lugares que no
 * pasan por el envoltorio de admin, y sin ella los eventos quedan invisibles en
 * /admin/security, que filtra por esa columna.
 */
export async function resolveUserOrganizationId(userId: string): Promise<string | null> {
  try {
    const activeOrganization = await getCurrentOrganizationContext(userId)
    if (activeOrganization?.id) return activeOrganization.id
  } catch {
    // Se sigue con la membresia: no poder resolver la activa no es motivo para
    // dejar el evento sin tienda.
  }

  try {
    const { createAdminSupabase } = await import('@/lib/supabase/admin')
    const { data } = await createAdminSupabase()
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return data?.organization_id ?? null
  } catch {
    return null
  }
}
