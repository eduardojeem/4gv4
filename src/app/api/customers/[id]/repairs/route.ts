import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { isCountableRepair } from '@/lib/customers/customer-spend'

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
    const requestedLimit = Number(searchParams.get('limit') || 10)
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.trunc(requestedLimit), 20))
      : 10

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

    // El conteo historico excluye canceladas. El total facturado incluye solo
    // trabajos listos o entregados: un presupuesto abierto todavia puede
    // cambiar y no debe presentarse como facturacion confirmada.
    const { data: costData, error: costError } = await supabase
      .from('repairs')
      .select('final_cost, estimated_cost, status')
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)

    if (costError) {
      return NextResponse.json({ error: 'No se pudieron calcular las reparaciones del cliente' }, { status: 500 })
    }

    const validRepairs = (costData ?? []).filter((repair) => {
      const status = String(repair.status ?? '').trim().toLowerCase()
      return status !== 'cancelado' && status !== 'cancelled'
    })
    const billableRepairs = validRepairs.filter((repair) => isCountableRepair(repair.status))
    const totalSpent = billableRepairs.reduce((sum, repair) => {
      // El costo final es la fuente principal. El estimado queda como respaldo
      // para reparaciones historicas terminadas antes de incorporar final_cost.
      const cost = Number(repair.final_cost ?? repair.estimated_cost ?? 0)
      return sum + (Number.isFinite(cost) && cost > 0 ? cost : 0)
    }, 0)

    return NextResponse.json({
      repairs: repairs ?? [],
      stats: {
        totalRepairs: validRepairs.length,
        completedRepairs: billableRepairs.length,
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
