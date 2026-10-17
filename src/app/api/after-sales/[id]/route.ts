import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { normalizeAfterSalesCase } from '@/lib/after-sales/compat'
import { mutateAfterSalesCase } from '@/lib/after-sales/resolution'

const updateCaseSchema = z.object({
 status: z.enum(['approved','rejected','completed','cancelled']).optional(),
 notes: z.string().trim().max(2000).optional().nullable(),
 refund_amount: z.number().min(0).max(9999999999).optional().nullable(),
 refund_method: z.enum(['cash','store_credit']).optional().nullable(),
 restock_action: z.enum(['sellable','quarantine','none']).optional().nullable(),
}).strict().refine(data => Object.keys(data).length > 0, 'No hay cambios para aplicar.')

const SELECT_COLUMNS = 'id, case_number, source_type, request_type, status, customer_id, repair_id, sale_id, sale_item_id, product_id, quantity, reason, notes, refund_amount, refund_method, restock_action, generated_repair_id, approved_at, resolved_at, created_by, resolved_by, created_at, updated_at'

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'crm' }, async (_request, { organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id) return NextResponse.json({ success: false, error: 'Caso inválido.' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('after_sales_cases')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ success: false, error: 'Caso no encontrado.' }, { status: 404 })

    return NextResponse.json({ success: true, data: normalizeAfterSalesCase(data) })
  } catch (error) {
    logger.error('After-sales detail API error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar el caso.' }, { status: 500 })
  }
})

export const PATCH = withTenantAuth({ permission: 'crm.customers.manage', module: 'crm' }, async (request, { user, organization }, routeContext) => {
 try {
  const id = z.string().uuid().safeParse(await getRouteId(routeContext))
  if (!id.success) return NextResponse.json({ success: false, error: 'Caso inválido.' }, { status: 400 })
  const parsed = updateCaseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Revisá los datos del caso.', details: parsed.error.issues }, { status: 400 })
  return await mutateAfterSalesCase(user.id, organization.id, parsed.data, id.data)
 } catch (error) {
  logger.error('After-sales atomic update failed', { error })
  return NextResponse.json({ success: false, error: 'No se pudo actualizar el caso.' }, { status: 500 })
 }
})
