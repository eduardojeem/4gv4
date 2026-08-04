import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'

/**
 * GET /api/debug/repairs-diagnosis?org=4g-celulares
 * Diagnóstico: qué customer y qué reparaciones ve el usuario actual.
 * Solo disponible en NODE_ENV !== production.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgSlug = request.nextUrl.searchParams.get('org')
  const admin = createAdminSupabase()

  const organization = orgSlug
    ? await resolvePublicOrganizationBySlug(orgSlug, admin)
    : null

  // 1. Perfil del usuario
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, full_name, role, status')
    .eq('id', user.id)
    .maybeSingle()

  // 2. Membership en la organización
  const { data: membership } = organization
    ? await admin
        .from('organization_members')
        .select('role, status')
        .eq('organization_id', organization.id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null }

  // 3. TODOS los customers ligados a este profile (todas las orgs)
  const { data: allCustomers } = await admin
    .from('customers')
    .select('id, name, email, phone, organization_id, profile_id, created_at')
    .eq('profile_id', user.id)

  // 4. Customer filtrado por org (como lo hace la page)
  let customerQuery = supabase
    .from('customers')
    .select('id, name, organization_id, profile_id')
    .eq('profile_id', user.id)

  if (organization) {
    customerQuery = customerQuery.eq('organization_id', organization.id)
  }

  const { data: customerData, error: customerError } = await customerQuery.maybeSingle()

  // 5. Reparaciones que ve el usuario (con RLS del user client)
  let repairsQuery = supabase
    .from('repairs')
    .select('id, ticket_number, device_brand, device_model, status, customer_id, organization_id, created_at')
    .order('created_at', { ascending: false })

  if (customerData) {
    repairsQuery = repairsQuery.eq('customer_id', customerData.id)
  }
  if (organization) {
    repairsQuery = repairsQuery.eq('organization_id', organization.id)
  }

  const { data: repairs, error: repairsError } = await repairsQuery.limit(20)

  // 6. Reparaciones con admin (sin RLS) para comparar
  let adminRepairsQuery = admin
    .from('repairs')
    .select('id, ticket_number, device_brand, device_model, status, customer_id, organization_id, created_at')
    .order('created_at', { ascending: false })

  if (customerData) {
    adminRepairsQuery = adminRepairsQuery.eq('customer_id', customerData.id)
  }
  if (organization) {
    adminRepairsQuery = adminRepairsQuery.eq('organization_id', organization.id)
  }

  const { data: adminRepairs } = await adminRepairsQuery.limit(20)

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    profile,
    organization: organization ? { id: organization.id, name: organization.name, slug: organization.slug } : null,
    membership,
    allCustomersLinkedToProfile: allCustomers,
    customerResolvedByPage: customerData,
    customerError: customerError?.message,
    repairsViaUserClient: repairs,
    repairsError: repairsError?.message,
    repairsViaAdminClient: adminRepairs,
    diagnosis: {
      customerCount: allCustomers?.length ?? 0,
      hasCustomerForThisOrg: !!customerData,
      userClientRepairsCount: repairs?.length ?? 0,
      adminClientRepairsCount: adminRepairs?.length ?? 0,
      mismatch: (repairs?.length ?? 0) !== (adminRepairs?.length ?? 0),
    }
  })
}
