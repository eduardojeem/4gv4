import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { ACTIVE_ORGANIZATION_COOKIE } from '@/lib/saas/active-organization'
import type { OrganizationContext } from '@/lib/saas/context'
import type { OrganizationRole } from '@/lib/saas/permissions'
import type { SaaSPlan } from '@/lib/saas/plans'
import { listAccessibleBranchesForUser } from '@/lib/branches/server'

type OrganizationMembershipRow = {
  organization_id: string
  role: OrganizationRole
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

function normalizeMembership(row: OrganizationMembershipRow): OrganizationContext | null {
  const organization = Array.isArray(row.organizations)
    ? row.organizations[0]
    : row.organizations

  if (!organization) return null

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    plan: organization.plan,
    logoUrl: organization.logo_url,
    role: row.role,
  }
}

async function resolveFallbackOrganization(userId: string) {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('organization_members')
    .select('organization_id, role, organizations!inner(id, name, slug, plan, logo_url)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return normalizeMembership(data as unknown as OrganizationMembershipRow)
}

export async function GET() {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse

  try {
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const organization = await getCurrentOrganizationContext(auth.user.id)
      ?? (auth.role === 'super_admin' || auth.role === 'admin' ? null : await resolveFallbackOrganization(auth.user.id))

    if (!organization && (auth.role === 'super_admin' || auth.role === 'admin')) {
      return NextResponse.json({ branches: [] })
    }

    if (!organization && auth.role !== 'super_admin' && auth.role !== 'admin') {
      return NextResponse.json({ error: 'No se pudo resolver la organizacion activa.' }, { status: 403 })
    }

    const branches = organization
      ? await listAccessibleBranchesForUser({
          userId: auth.user.id,
          role: auth.role,
          organizationId: organization.id,
        })
      : []

    const response = NextResponse.json({ branches })
    if (organization) {
      response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organization.id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
