import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { getAfterSalesStatusAliases, type AfterSalesStatus } from '@/lib/after-sales/compat'

/**
 * Totales de posventa, contados en la base.
 *
 * El panel los calculaba sobre la pagina cargada (200 casos), asi que a partir
 * del caso 201 los numeros empezaban a mentir hacia abajo sin avisar. Contar
 * del lado del servidor los deja bien sin importar el volumen.
 */

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function countByStatus(
  supabase: SupabaseServerClient,
  organizationId: string,
  status: AfterSalesStatus
) {
  const { count, error } = await supabase
    .from('after_sales_cases')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('status', getAfterSalesStatusAliases(status))

  if (error) throw error
  return count ?? 0
}

export const GET = withTenantAuth(
  { permission: 'crm.customers.read', module: 'crm' },
  async (_request, { organization }) => {
    try {
      const supabase = await createClient()

      const [open, approved, completed, rejected] = await Promise.all([
        countByStatus(supabase, organization.id, 'open'),
        countByStatus(supabase, organization.id, 'approved'),
        countByStatus(supabase, organization.id, 'completed'),
        countByStatus(supabase, organization.id, 'rejected'),
      ])

      // Reintegros efectivamente pagados y mercaderia que volvio con falla:
      // los dos salen de casos completados, asi que se traen juntos.
      const { data: resolved, error: resolvedError } = await supabase
        .from('after_sales_cases')
        .select('refund_amount, restock_action, quantity')
        .eq('organization_id', organization.id)
        .in('status', getAfterSalesStatusAliases('completed'))

      if (resolvedError) throw resolvedError

      const rows = resolved ?? []
      const refunds = rows.reduce((sum, row) => sum + (Number(row.refund_amount) || 0), 0)
      const quarantined = rows
        .filter((row) => row.restock_action === 'quarantine')
        .reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)

      return NextResponse.json({
        success: true,
        data: { open, approved, completed, rejected, refunds, quarantined },
      })
    } catch (error) {
      logger.error('After-sales summary API error', { error })
      return NextResponse.json(
        { success: false, error: 'No se pudieron calcular los totales.' },
        { status: 500 }
      )
    }
  }
)
