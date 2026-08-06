import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

/**
 * GET /api/customers/[id]/repairs
 * Devuelve las últimas reparaciones de un cliente específico.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
    const organization = await getCurrentOrganizationContext(staffAuth.user.id)

    if (!organization) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 403 })
    }

    const { id: customerId } = await context.params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 10), 20)

    const supabase = createAdminSupabase()

    const { data: repairs, error } = await supabase
      .from('repairs')
      .select('id, ticket_number, device_brand, device_model, problem_description, status, final_cost, estimated_cost, paid_amount, payment_status, delivered_at, created_at')
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calcular stats reales
    const { count: totalRepairs } = await supabase
      .from('repairs')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)

    const { data: costData } = await supabase
      .from('repairs')
      .select('final_cost')
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)
      .not('final_cost', 'is', null)

    const totalSpent = (costData ?? []).reduce((sum, r) => sum + Number(r.final_cost || 0), 0)

    return NextResponse.json({
      repairs: repairs ?? [],
      stats: {
        totalRepairs: totalRepairs ?? 0,
        totalSpent,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
