import { NextResponse } from 'next/server'

import { chunkQueryValues } from '@/lib/analytics/query-batches'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { buildCustomerAccessReport } from '@/lib/reports/customer-access-report'
import { createAdminSupabase } from '@/lib/supabase/admin'

const PAGE_SIZE = 1000

type CustomerRow = {
  profile_id: string | null
  created_at: string | null
}

type MembershipRow = {
  user_id: string
  status: string | null
}

function parseRange(request: Request) {
  const url = new URL(request.url)
  const from = new Date(url.searchParams.get('from') || '')
  const to = new Date(url.searchParams.get('to') || '')
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return null
  return { from, to }
}

export const GET = withTenantAuth({ permission: 'analytics.read' }, async (request, { organization }) => {
  const range = parseRange(request)
  if (!range) {
    return NextResponse.json(
      { success: false, error: 'El período del reporte no es válido.' },
      { status: 400 },
    )
  }

  try {
    const supabase = createAdminSupabase()
    const customers: CustomerRow[] = []

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('customers')
        .select('profile_id, created_at')
        .eq('organization_id', organization.id)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      const page = data ?? []
      customers.push(...page)
      if (page.length < PAGE_SIZE) break
    }

    const profileIds = Array.from(new Set(
      customers.map((customer) => customer.profile_id).filter((id): id is string => Boolean(id)),
    ))
    const memberships: MembershipRow[] = []

    for (const profileIdBatch of chunkQueryValues(profileIds)) {
      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id, status')
        .eq('organization_id', organization.id)
        .in('user_id', profileIdBatch)
      if (error) throw error
      memberships.push(...(data ?? []))
    }

    const report = buildCustomerAccessReport({
      customers: customers.map((customer) => ({
        profileId: customer.profile_id,
        createdAt: customer.created_at,
      })),
      memberships: memberships.map((membership) => ({
        userId: membership.user_id,
        status: membership.status,
      })),
      from: range.from,
      to: range.to,
    })

    return NextResponse.json({
      success: true,
      data: report,
      meta: { generatedAt: new Date().toISOString() },
    })
  } catch (error) {
    logger.error('Customer access report API error', {
      organizationId: organization.id,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { success: false, error: 'No se pudo generar el reporte de acceso de clientes.' },
      { status: 500 },
    )
  }
})
