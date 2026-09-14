import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { loadCustomerSpend } from '@/lib/customers/customer-spend-server'
import { logger } from '@/lib/logger'

/** Tope por pedido. El navegador parte listas más grandes en varias llamadas. */
const CUSTOMER_SPEND_MAX_IDS = 2000

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(CUSTOMER_SPEND_MAX_IDS),
})

/**
 * POST /api/customers/spend
 * Lo gastado por cada cliente pedido, con la regla única. Va por POST para que
 * la lista de IDs no viaje en la URL.
 */
export const POST = withTenantAuth({ permission: 'crm.customers.read', module: 'crm' }, async (request, { organization }) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'La lista de clientes no es válida.' }, { status: 400 })
  }

  try {
    const data = await loadCustomerSpend(createAdminSupabase(), organization.id, parsed.data.ids)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('Customer spend API error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo calcular lo gastado por los clientes.' }, { status: 500 })
  }
})
