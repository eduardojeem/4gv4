import { notFound } from 'next/navigation'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { OrganizationDetailView, type FullOrganizationDetail } from '@/components/superadmin/organizations/OrganizationDetailView'

type Props = {
  params: Promise<{ id: string }>
}

export default async function SuperAdminOrganizationDetailPage({ params }: Props) {
  const { id } = await params
  const admin = createAdminSupabase()

  // Find organization by ID or by slug
  let query = admin.from('organizations').select('*')
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    query = query.eq('id', id)
  } else {
    query = query.eq('slug', id)
  }

  const { data: org, error: orgError } = await query.maybeSingle()
  if (orgError || !org) {
    notFound()
  }

  // Parallel fetch associated telemetry and models
  const [
    { data: members },
    { data: subscription },
    { data: settings },
    { data: branches },
    { count: productsCount },
    { count: salesCount },
    { count: customersCount },
  ] = await Promise.all([
    admin
      .from('organization_members')
      .select('id, user_id, role, status, created_at, profiles(id, email, full_name, avatar_url)')
      .eq('organization_id', org.id),
    admin
      .from('subscriptions')
      .select('*')
      .eq('organization_id', org.id)
      .maybeSingle(),
    admin
      .from('organization_settings')
      .select('*')
      .eq('organization_id', org.id)
      .maybeSingle(),
    admin
      .from('branches')
      .select('id, name, code, slug, address, city, phone, email, is_active, is_default, created_at')
      .eq('organization_id', org.id),
    admin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
    admin
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
  ])

  // Get plan details
  let planDetails = null
  const planTier = (subscription?.plan || org.plan || 'FREE').toLowerCase()
  const { data: planRow } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('tier', planTier)
    .maybeSingle()
  if (planRow) {
    planDetails = planRow
  }

  // Owner profile
  let ownerProfile = null
  if (org.owner_id) {
    const { data: owner } = await admin
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('id', org.owner_id)
      .maybeSingle()
    ownerProfile = owner
  }

  const detailData: FullOrganizationDetail = {
    organization: org,
    owner: ownerProfile,
    settings,
    members: (members ?? []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      created_at: m.created_at,
      profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles ?? null,
    })),
    subscription: subscription ?? null,
    plan_details: planDetails,
    branches: branches ?? [],
    counts: {
      products: productsCount ?? 0,
      sales: salesCount ?? 0,
      customers: customersCount ?? 0,
    },
  }

  return <OrganizationDetailView data={detailData} />
}
