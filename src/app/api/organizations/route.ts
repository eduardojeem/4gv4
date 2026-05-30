import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { ACTIVE_ORGANIZATION_COOKIE } from '@/lib/saas/active-organization'
import type { OrganizationRole } from '@/lib/saas/permissions'
import type { SaaSPlan } from '@/lib/saas/plans'

type OrganizationMembershipRow = {
  organization_id: string
  role: OrganizationRole
  status: string
  organizations:
    | {
        id: string
        name: string
        slug: string
        plan: SaaSPlan
        logo_url: string | null
      }
    | Array<{
        id: string
        name: string
        slug: string
        plan: SaaSPlan
        logo_url: string | null
      }>
    | null
}

function normalizeMembership(row: OrganizationMembershipRow) {
  const organization = Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations

  if (!organization) return null

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    plan: organization.plan,
    logo_url: organization.logo_url,
    role: row.role,
  }
}

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('organization_members')
    .select('organization_id, role, status, organizations!inner(id, name, slug, plan, logo_url)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load organizations' }, { status: 500 })
  }

  const organizations = ((data ?? []) as unknown as OrganizationMembershipRow[])
    .map(normalizeMembership)
    .filter((organization): organization is NonNullable<ReturnType<typeof normalizeMembership>> => Boolean(organization))

  const requestedActiveId = request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value
  const activeOrganization =
    organizations.find((organization) => organization.id === requestedActiveId) ??
    organizations[0] ??
    null

  const response = NextResponse.json({
    organizations,
    activeOrganization,
  })

  if (activeOrganization && activeOrganization.id !== requestedActiveId) {
    response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, activeOrganization.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return response
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { organizationId?: unknown } | null
  const organizationId = typeof body?.organizationId === 'string' ? body.organizationId : ''

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('organization_members')
    .select('organization_id, role, status, organizations!inner(id, name, slug, plan, logo_url)')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to switch organization' }, { status: 500 })
  }

  const activeOrganization = data
    ? normalizeMembership(data as unknown as OrganizationMembershipRow)
    : null

  if (!activeOrganization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const response = NextResponse.json({ activeOrganization })
  response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, activeOrganization.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  return response
}
