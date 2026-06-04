import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/promotions/check-code?code=XYZ&exclude=<promotion_id>
 *
 * Returns { available: boolean } indicating whether the code can be used.
 * Replaces the previous N+1 approach that fetched the first 100 promos
 * and filtered client-side (falsely passed checks when codes existed in
 * positions 101+).
 */
export const GET = withTenantAuth(
  { permission: ['promotions.create', 'promotions.update', 'promotions.manage'] },
  async (request: NextRequest, { organization }) => {
    const { searchParams } = new URL(request.url)
    const code = (searchParams.get('code') || '').trim().toUpperCase()
    const excludeId = searchParams.get('exclude')?.trim() || null

    if (!code) {
      return NextResponse.json({ available: false, error: 'Código requerido' }, { status: 400 })
    }

    const supabase = await createClient()
    let query = supabase
      .from('promotions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id)
      .eq('code', code)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { count, error } = await query

    if (error) {
      return NextResponse.json({ available: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ available: (count ?? 0) === 0 })
  }
)
