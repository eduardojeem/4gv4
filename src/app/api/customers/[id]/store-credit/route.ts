import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Saldo a favor del cliente.
 *
 * El saldo es la suma del libro mayor, no una columna mutable: asi cada peso
 * acreditado o consumido queda explicado por su movimiento de origen.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

/** Saldo actual, siempre recalculado desde el libro. */
async function readBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  customerId: string
) {
  const { data, error } = await supabase
    .from('customer_store_credits')
    .select('amount')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)

  if (error) throw error
  return (data ?? []).reduce((total, row) => total + Number(row.amount || 0), 0)
}

export const GET = withTenantAuth(
  { permission: 'crm.customers.read', module: 'crm' },
  async (request, { organization }, routeContext) => {
    try {
      const id = await getRouteId(routeContext)
      if (!id || !UUID_PATTERN.test(id)) {
        return NextResponse.json({ success: false, error: 'Cliente inválido.' }, { status: 400 })
      }

      const supabase = await createClient()
      const url = new URL(request.url)
      const requestedPage = Number(url.searchParams.get('page') || 1)
      const requestedPageSize = Number(url.searchParams.get('pageSize') || 20)
      const page = Number.isInteger(requestedPage) ? Math.max(1, requestedPage) : 1
      const pageSize = Number.isInteger(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 20
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const [{ data, error, count }, balance] = await Promise.all([
        supabase
        .from('customer_store_credits')
        .select('id, amount, reason, source_type, source_id, created_at', { count: 'exact' })
        .eq('organization_id', organization.id)
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .range(from, to),
        readBalance(supabase, organization.id, id),
      ])

      if (error) throw error

      const movements = data ?? []
      const total = count ?? movements.length

      return NextResponse.json({
        success: true,
        data: {
          balance,
          movements,
          pagination: { page, pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / pageSize) },
        },
      })
    } catch (error) {
      logger.error('Store credit API error', { error })
      return NextResponse.json({ success: false, error: 'No se pudo cargar el saldo a favor.' }, { status: 500 })
    }
  }
)

/**
 * Consume saldo a favor en una venta.
 *
 * El monto se valida contra el saldo recalculado en el servidor y no contra el
 * que vio el POS: entre que el cajero abrio el checkout y confirmo la venta,
 * otra caja pudo haber consumido el mismo saldo.
 */
export const POST = withTenantAuth(
  { permission: 'pos.sales.create', module: 'pos' },
  async (request, { user, organization }, routeContext) => {
    try {
      const id = await getRouteId(routeContext)
      if (!id || !UUID_PATTERN.test(id)) {
        return NextResponse.json({ success: false, error: 'Cliente inválido.' }, { status: 400 })
      }

      const body = await request.json().catch(() => null)
      const amount = Number(body?.amount)
      const saleId = typeof body?.saleId === 'string' ? body.saleId : ''

      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ success: false, error: 'El monto a canjear debe ser mayor que cero.' }, { status: 400 })
      }
      if (!UUID_PATTERN.test(saleId)) {
        return NextResponse.json({ success: false, error: 'Venta inválida.' }, { status: 400 })
      }

      const supabase = await createClient()

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('id, total_amount')
        .eq('id', saleId)
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (saleError) throw saleError
      if (!sale) {
        return NextResponse.json({ success: false, error: 'La venta no pertenece a tu organización.' }, { status: 404 })
      }

      // No se puede canjear mas de lo que vale la venta: el sobrante seguiria
      // siendo saldo del cliente, no vuelto.
      if (amount > Number(sale.total_amount || 0)) {
        return NextResponse.json(
          { success: false, error: 'El saldo aplicado no puede superar el total de la venta.' },
          { status: 400 }
        )
      }

      const balance = await readBalance(supabase, organization.id, id)
      if (amount > balance) {
        return NextResponse.json(
          { success: false, error: `El cliente sólo tiene ${balance} de saldo a favor disponible.` },
          { status: 409 }
        )
      }

      const { error: insertError } = await supabase.from('customer_store_credits').insert({
        organization_id: organization.id,
        customer_id: id,
        amount: -amount,
        reason: 'Aplicado en venta',
        source_type: 'sale',
        source_id: saleId,
        created_by: user.id,
      })

      if (insertError) {
        // El índice único por venta convierte el reintento en un no-op: si ya
        // se canjeó, el saldo ya está descontado y la venta está bien.
        if (insertError.code === '23505') {
          return NextResponse.json({
            success: true,
            data: { balance: await readBalance(supabase, organization.id, id), alreadyApplied: true },
          })
        }
        throw insertError
      }

      return NextResponse.json({
        success: true,
        data: { balance: balance - amount, applied: amount },
      })
    } catch (error) {
      logger.error('Store credit redeem error', { error })
      return NextResponse.json({ success: false, error: 'No se pudo aplicar el saldo a favor.' }, { status: 500 })
    }
  }
)
