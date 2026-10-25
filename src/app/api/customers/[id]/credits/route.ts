import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { summarizeCustomerCreditBalances } from '@/lib/customers/credit-balance'

async function getCustomerId(routeContext: unknown): Promise<string | null> {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = params ? await Promise.resolve(params) : null
  return resolved?.id ?? null
}

/**
 * GET /api/customers/[id]/credits
 * Devuelve los créditos activos y el resumen de créditos del cliente.
 */
export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'crm' }, async (_request, { organization }, routeContext) => {
  try {
    const customerId = await getCustomerId(routeContext)
    if (!customerId) return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })
    const supabase = createAdminSupabase()

    // Este cliente se salta RLS. Primero se valida la pertenencia y luego se
    // acota también cada tabla que expone organization_id.
    const customer = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (customer.error) {
      return NextResponse.json({ error: 'No se pudo validar el cliente' }, { status: 500 })
    }
    if (!customer.data) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // 1. Obtener créditos de la tabla customer_credits
    const { data: credits, error } = await supabase
      .from('customer_credits')
      .select('*')
      .eq('customer_id', customerId)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const creditList = credits ?? []
    const totalCredits = creditList.length
    const activeCredits = creditList.filter((c) => c.status === 'active' || c.status === 'pending' || c.status === 'late').length
    const totalPrincipal = creditList.reduce((sum, c) => sum + Number(c.principal || c.amount || 0), 0)

    // 2. Obtener saldo pendiente total de cuotas si existen
    const creditIds = creditList.map((c) => c.id)
    let balanceSummary = { totalInstallments: 0, pendingInstallments: 0, financedTotal: 0, paidTotal: 0, pendingBalance: 0 }

    if (creditIds.length > 0) {
      const { data: installments, error: installmentsError } = await supabase
        .from('credit_installments')
        .select('id, credit_id, amount, amount_paid, status')
        .in('credit_id', creditIds)

      if (installmentsError) {
        return NextResponse.json({ error: 'No se pudieron cargar las cuotas' }, { status: 500 })
      }

      balanceSummary = summarizeCustomerCreditBalances(creditList, installments ?? [])
    }

    return NextResponse.json({
      success: true,
      credits: creditList,
      stats: {
        totalCredits,
        activeCredits,
        totalPrincipal,
        ...balanceSummary,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
})
