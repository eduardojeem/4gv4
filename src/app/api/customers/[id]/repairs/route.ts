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

    // Se toma el costo final y, si todavia no se cerro, el estimado: es la
    // convencion del resto de la app. Filtrar por `final_cost not null` dejaba
    // fuera toda reparacion sin cerrar y el "Total Gastado" del cliente no
    // sumaba las reparaciones.
    const { data: costData } = await supabase
      .from('repairs')
      .select('final_cost, estimated_cost, status')
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)

    const totalSpent = (costData ?? []).reduce((sum, r) => {
      // Una reparacion cancelada no es plata gastada por el cliente.
      if (String(r.status ?? '').trim().toLowerCase() === 'cancelado') return sum
      const cost = Number(r.final_cost ?? r.estimated_cost ?? 0)
      return sum + (Number.isFinite(cost) && cost > 0 ? cost : 0)
    }, 0)

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
