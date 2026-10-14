import { NextRequest, NextResponse } from 'next/server'
import { isNextResponse, resolveRepairRouteContext } from '@/app/api/repairs/_lib'
import { suggestRepairPrice, type PricedRepairHistory } from '@/lib/repairs/price-suggestion'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`)

/**
 * GET /api/repairs/price-suggestion?brand=&model=&issue=&excludeId=
 * Lo que la sucursal ya cobró por el mismo modelo y una falla parecida.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.read')
    if (isNextResponse(ctx)) return ctx
    const params = request.nextUrl.searchParams
    const brand = (params.get('brand') ?? '').trim().slice(0, 100)
    const model = (params.get('model') ?? '').trim().slice(0, 100)
    const issue = (params.get('issue') ?? '').trim().slice(0, 300)
    const excludeId = params.get('excludeId')
    if (!brand || !model || !issue) return NextResponse.json({ suggestion: null })

    let query = ctx.supabase
      .from('repairs')
      .select('device_brand, device_model, problem_description, final_cost, delivered_at, updated_at')
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .in('status', ['entregado', 'listo'])
      .gt('final_cost', 0)
      .ilike('device_brand', escapeLike(brand))
      .ilike('device_model', escapeLike(model))
      .order('updated_at', { ascending: false })
      .limit(60)
    if (excludeId) query = query.neq('id', excludeId)
    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ suggestion: suggestRepairPrice({ brand, model, issue }, (data ?? []) as PricedRepairHistory[]) })
  } catch (error) {
    logger.error('[repairs/price-suggestion] GET', { error: error instanceof Error ? error.message : error })
    return NextResponse.json({ suggestion: null })
  }
}
