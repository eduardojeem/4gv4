import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createOrgScopedClient } from '@/lib/supabase/org-scoped-server'
import { isLoyaltyModuleMissing, LOYALTY_MIGRATION_HINT } from '@/lib/loyalty/module-status'

const schema = z.object({
  customer_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
  payment_method: z.enum(['cash', 'transfer', 'card']),
  payment_reference: z.string().max(120).nullable().optional(),
})

export const POST = withTenantAuth({ permission: 'pos.sales.create', module: 'promotions' }, async (request: NextRequest, { organization }, context) => {
  const id = (context as { params?: { id?: string } }).params?.id
  if (!id) return NextResponse.json({ error: 'Falta el sorteo' }, { status: 400 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Datos de compra inválidos', details: parsed.error.issues }, { status: 400 })
  const supabase = await createOrgScopedClient(organization.id)
  const { data, error } = await supabase.rpc('purchase_points_and_redeem_raffle_tickets', {
    p_raffle_id: id, p_customer_id: parsed.data.customer_id, p_quantity: parsed.data.quantity,
    p_payment_method: parsed.data.payment_method, p_payment_reference: parsed.data.payment_reference ?? null,
  })
  if (error) {
    if (isLoyaltyModuleMissing(error)) return NextResponse.json({ error: LOYALTY_MIGRATION_HINT, code: 'MODULE_NOT_INSTALLED' }, { status: 503 })
    return NextResponse.json({ error: error.message || 'No se pudo completar la compra' }, { status: 400 })
  }
  return NextResponse.json({ tickets: data ?? [] }, { status: 201 })
})
