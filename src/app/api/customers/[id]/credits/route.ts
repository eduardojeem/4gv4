import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

/**
 * GET /api/customers/[id]/credits
 * Devuelve los créditos activos y el resumen de créditos del cliente.
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
    const supabase = createAdminSupabase()

    // 1. Obtener créditos de la tabla customer_credits
    const { data: credits, error } = await supabase
      .from('customer_credits')
      .select('*')
      .eq('customer_id', customerId)
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
    let pendingBalance = 0
    let totalInstallments = 0
    let pendingInstallments = 0
    // Lo financiado y lo cobrado salen de las cuotas, no del capital: con
    // interes el total a pagar es mayor al principal, y el detalle del cliente
    // tiene que cuadrar (financiado = pagado + faltante).
    let financedTotal = 0
    let paidTotal = 0

    if (creditIds.length > 0) {
      const { data: installments } = await supabase
        .from('credit_installments')
        .select('id, amount, amount_paid, status')
        .in('credit_id', creditIds)

      if (installments) {
        totalInstallments = installments.length
        pendingInstallments = installments.filter((i) => i.status !== 'paid').length
        pendingBalance = installments.reduce((sum, i) => {
          const amt = Number(i.amount || 0)
          const paid = Number(i.amount_paid || 0)
          return sum + Math.max(0, amt - paid)
        }, 0)
        financedTotal = installments.reduce((sum, i) => sum + Math.max(0, Number(i.amount || 0)), 0)
        paidTotal = installments.reduce((sum, i) => {
          const amt = Math.max(0, Number(i.amount || 0))
          // Una cuota marcada como pagada cuenta entera aunque no registre el
          // monto abonado; el resto cuenta lo que efectivamente se cobro.
          const paid = i.status === 'paid' ? amt : Math.min(amt, Math.max(0, Number(i.amount_paid || 0)))
          return sum + paid
        }, 0)
      }
    }

    return NextResponse.json({
      success: true,
      credits: creditList,
      stats: {
        totalCredits,
        activeCredits,
        totalPrincipal,
        financedTotal,
        paidTotal,
        pendingBalance,
        totalInstallments,
        pendingInstallments,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}
