import { redirect } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { OrganizationsDashboard } from '@/components/superadmin/organizations/organizations-dashboard'
import { chunkValues, fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import { getEffectiveOrganizationPlan } from '@/lib/superadmin/organization-directory'
import type { SuperAdminOrganization } from '@/lib/superadmin/organization-list'
import {
  loadDirectoryStats,
  type OrganizationDirectoryStats,
} from '@/lib/superadmin/organization-directory-stats.server'
import { loadPlanNames } from '@/lib/superadmin/plan-names'
import { requireSuperAdmin } from '@/lib/superadmin/auth'

type OrganizationRow = {
  id: string
  name: string
  slug: string
  plan: string | null
  logo_url: string | null
  owner_id: string | null
  created_at: string | null
  updated_at: string | null
  business_vertical: string | null
  operating_model: string | null
  enabled_modules: string[] | null
  storefront_public: boolean | null
  erased_at: string | null
}

type SubscriptionRow = {
  organization_id: string
  plan: string | null
  status: string | null
  payment_status: string | null
  provider: string | null
  trial_ends_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean | null
}

type ProfileRow = { id: string; email: string | null; full_name: string | null }
type SettingsRow = { organization_id: string; currency: string | null; timezone: string | null }

/** Lee por tandas de ids, sin cortar en 1000 filas. */
async function fetchByOrganization<T>(
  ids: string[],
  query: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  if (!ids.length) return []
  const chunks = await Promise.all(chunkValues(ids).map((chunk) => fetchAllRows<T>((from, to) => query(chunk, from, to))))
  return chunks.flat()
}

const EMPTY_STATS: OrganizationDirectoryStats = {
  members_total: 0, members_active: 0, members_invited: 0, members_suspended: 0,
  staff_total: 0, staff_active: 0, staff_invited: 0, staff_suspended: 0, customers_total: 0,
  team_size: 0, last_access_at: null, last_sale_at: null, products_total: null,
}

export default async function SuperAdminOrganizationsPage() {
  // El layout ya lo verifica, pero un layout no se vuelve a ejecutar en cada
  // navegación del cliente y esta página lee con la service role.
  const superAdmin = await requireSuperAdmin()
  if (!superAdmin) redirect('/dashboard')

  const admin = createAdminSupabase()

  const organizations = await fetchAllRows<OrganizationRow>((from, to) =>
    admin
      .from('organizations')
      .select('id, name, slug, plan, logo_url, owner_id, created_at, updated_at, business_vertical, operating_model, enabled_modules, storefront_public, erased_at')
      .order('created_at', { ascending: false })
      .range(from, to)
  )
  const organizationIds = organizations.map((organization) => organization.id)
  const ownerIds = [...new Set(organizations.map((organization) => organization.owner_id).filter(Boolean) as string[])]

  const [subscriptions, profiles, settings, directoryStats, planNames] = await Promise.all([
    fetchByOrganization<SubscriptionRow>(organizationIds, (ids, from, to) =>
      admin
        .from('subscriptions')
        .select('organization_id, plan, status, payment_status, provider, trial_ends_at, current_period_ends_at, cancel_at_period_end')
        .in('organization_id', ids)
        .range(from, to)
    ),
    Promise.all(chunkValues(ownerIds).map(async (ids) => {
      const { data, error } = await admin.from('profiles').select('id, email, full_name').in('id', ids)
      if (error) throw new Error(error.message)
      return (data ?? []) as ProfileRow[]
    })).then((chunks) => chunks.flat()),
    // Moneda y zona horaria, para que el modal no muestre los valores por defecto.
    fetchByOrganization<SettingsRow>(organizationIds, (ids, from, to) =>
      admin.from('organization_settings').select('organization_id, currency, timezone').in('organization_id', ids).range(from, to)
    ).catch(() => [] as SettingsRow[]),
    loadDirectoryStats(admin, organizations),
    loadPlanNames(admin).catch(() => ({})),
  ])

  const subscriptionsByOrganization = new Map(subscriptions.map((subscription) => [subscription.organization_id, subscription]))
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const settingsByOrganization = new Map(settings.map((row) => [row.organization_id, row]))

  const dashboardOrganizations: SuperAdminOrganization[] = organizations.map((organization) => {
    const subscription = subscriptionsByOrganization.get(organization.id)
    const ownerProfile = organization.owner_id ? profilesById.get(organization.owner_id) : null
    const orgSettings = settingsByOrganization.get(organization.id)
    const stats = directoryStats.stats.get(organization.id) ?? EMPTY_STATS

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      plan: getEffectiveOrganizationPlan(organization.plan, subscription?.plan ?? null),
      logo_url: organization.logo_url,
      owner_id: organization.owner_id,
      owner_name: ownerProfile?.full_name || null,
      owner_email: ownerProfile?.email || null,
      created_at: organization.created_at,
      updated_at: organization.updated_at,
      subscription_status: subscription?.status || null,
      payment_status: subscription?.payment_status || null,
      subscription_provider: subscription?.provider || null,
      trial_ends_at: subscription?.trial_ends_at || null,
      current_period_ends_at: subscription?.current_period_ends_at || null,
      cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
      members_total: stats.members_total,
      members_active: stats.members_active,
      members_invited: stats.members_invited,
      members_suspended: stats.members_suspended,
      staff_total: stats.staff_total,
      staff_active: stats.staff_active,
      staff_invited: stats.staff_invited,
      staff_suspended: stats.staff_suspended,
      customers_total: stats.customers_total,
      business_vertical: organization.business_vertical || 'general',
      operating_model: organization.operating_model || 'retail',
      // `null` = las funciones del plan. Antes se convertía en `[]` y la
      // fila decía «Sin funciones habilitadas».
      enabled_modules: organization.enabled_modules,
      last_access_known: directoryStats.accessKnown && stats.team_size > 0,
      last_access_at: stats.last_access_at,
      last_sale_at: stats.last_sale_at,
      activity_known: directoryStats.accessKnown,
      products_total: stats.products_total,
      currency: orgSettings?.currency ?? null,
      timezone: orgSettings?.timezone ?? null,
      storefront_public: organization.storefront_public,
      erased_at: organization.erased_at,
    }
  })

  return (
    <OrganizationsDashboard
      organizations={dashboardOrganizations}
      referenceTime={new Date().toISOString()}
      planNames={planNames}
    />
  )
}
