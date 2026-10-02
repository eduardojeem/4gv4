import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { siteUrl } from '@/lib/site-url'
import { CONVERTIBLE_STATUSES, EDITABLE_STATUSES, type QuoteStatus } from '@/lib/quotes/quote-math'
import { QUOTE_COLUMNS, quoteInputSchema, quoteRows, validationError } from '@/lib/quotes/quote-api'
import { assertQuoteProducts, loadQuote, organizationCurrency } from '@/lib/quotes/quote-server'

export const dynamic = 'force-dynamic'

const guard = { permission: 'pos.sales.create', module: 'pos' } as const
const idSchema = z.string().uuid()

function quoteId(routeContext: unknown): Promise<string | null> {
  return Promise.resolve((routeContext as { params: Promise<{ id: string }> }).params).then(({ id }) =>
    idSchema.safeParse(id).success ? id : null,
  )
}

export const GET = withTenantAuth(guard, async (_request, { organization }, routeContext) => {
  const id = await quoteId(routeContext)
  if (!id) return NextResponse.json({ error: 'Presupuesto inválido' }, { status: 400 })
  const supabase = await createClient()
  const quote = await loadQuote(supabase, organization.id, id)
  if (!quote) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })

  let sale: { id: string; code: string } | null = null
  if (quote.sale_id) {
    const { data } = await supabase.from('sales').select('id, code').eq('id', quote.sale_id).maybeSingle()
    sale = (data as { id: string; code: string } | null) ?? null
  }
  return NextResponse.json({
    quote,
    sale,
    storeName: organization.name,
    shareUrl: siteUrl(`/presupuesto/${quote.share_token}`),
  })
})

/** Guardar cambios: solo mientras el cliente no respondió. */
export const PUT = withTenantAuth(guard, async (request, { organization }, routeContext) => {
  const id = await quoteId(routeContext)
  if (!id) return NextResponse.json({ error: 'Presupuesto inválido' }, { status: 400 })
  const parsed = quoteInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })

  const supabase = await createClient()
  const current = await loadQuote(supabase, organization.id, id)
  if (!current) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
  if (!EDITABLE_STATUSES.includes(current.status as QuoteStatus)) {
    return NextResponse.json({ error: 'Este presupuesto ya no se puede modificar. Duplicalo para hacer uno nuevo.' }, { status: 409 })
  }

  const productError = await assertQuoteProducts(supabase, organization.id, parsed.data.items)
  if (productError) return NextResponse.json({ error: productError }, { status: 400 })

  const { header, items } = quoteRows(parsed.data, organization.id, await organizationCurrency(supabase, organization.id))
  const { error } = await supabase.from('quotes').update(header).eq('id', id).eq('organization_id', organization.id)
  if (error) {
    logger.error('No se pudo actualizar el presupuesto', { error: error.message })
    return NextResponse.json({ error: 'No se pudo guardar el presupuesto' }, { status: 500 })
  }

  // Las líneas se reemplazan enteras: es un documento, no un historial.
  const { error: deleteError } = await supabase.from('quote_items').delete().eq('quote_id', id)
  const { error: insertError } = deleteError
    ? { error: deleteError }
    : await supabase.from('quote_items').insert(items.map((item) => ({ ...item, quote_id: id })))
  if (insertError) {
    logger.error('No se pudieron reemplazar las líneas del presupuesto', { error: insertError.message })
    return NextResponse.json({ error: 'No se pudieron guardar las líneas. Volvé a intentar.' }, { status: 500 })
  }

  return NextResponse.json({ quote: await loadQuote(supabase, organization.id, id) })
})

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('mark_sent') }),
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('reject') }),
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('reopen') }),
  z.object({ action: z.literal('convert'), sale_id: z.string().uuid() }),
])

/** Qué estado deja cada acción y desde cuáles se permite. */
const TRANSITIONS: Record<string, { to: QuoteStatus; from: QuoteStatus[] }> = {
  mark_sent: { to: 'sent', from: ['draft', 'sent'] },
  accept: { to: 'accepted', from: ['draft', 'sent'] },
  reject: { to: 'rejected', from: ['draft', 'sent', 'accepted'] },
  cancel: { to: 'cancelled', from: ['draft', 'sent', 'accepted', 'rejected'] },
  reopen: { to: 'sent', from: ['rejected', 'cancelled', 'accepted'] },
  convert: { to: 'converted', from: CONVERTIBLE_STATUSES },
}

export const PATCH = withTenantAuth(guard, async (request, { organization }, routeContext) => {
  const id = await quoteId(routeContext)
  if (!id) return NextResponse.json({ error: 'Presupuesto inválido' }, { status: 400 })
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })

  const supabase = await createClient()
  const { data: current } = await supabase
    .from('quotes')
    .select('id, status, sent_at')
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle()
  if (!current) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })

  const transition = TRANSITIONS[parsed.data.action]
  const status = (current as { status: QuoteStatus }).status
  if (!transition.from.includes(status)) {
    return NextResponse.json({ error: 'El presupuesto ya cambió de estado. Actualizá la página.' }, { status: 409 })
  }

  const update: Record<string, unknown> = { status: transition.to }
  if (parsed.data.action === 'mark_sent' && !(current as { sent_at: string | null }).sent_at) update.sent_at = new Date().toISOString()
  if (parsed.data.action === 'convert') {
    // La venta tiene que ser de la empresa.
    const { data: sale } = await supabase.from('sales').select('id').eq('id', parsed.data.sale_id).eq('organization_id', organization.id).maybeSingle()
    if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 400 })
    update.sale_id = parsed.data.sale_id
    update.converted_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('quotes')
    .update(update)
    .eq('id', id)
    .eq('organization_id', organization.id)
    .eq('status', status)
    .select(QUOTE_COLUMNS)
    .maybeSingle()
  if (error || !data) {
    if (error) logger.error('No se pudo cambiar el estado del presupuesto', { error: error.message })
    return NextResponse.json({ error: 'No se pudo cambiar el estado. Actualizá la página.' }, { status: 409 })
  }
  return NextResponse.json({ quote: data })
})

/** Un borrador se borra; lo que ya se mandó al cliente se anula, para que quede el registro. */
export const DELETE = withTenantAuth(guard, async (_request, { organization }, routeContext) => {
  const id = await quoteId(routeContext)
  if (!id) return NextResponse.json({ error: 'Presupuesto inválido' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', id)
    .eq('organization_id', organization.id)
    .eq('status', 'draft')
    .select('id')
  if (error) return NextResponse.json({ error: 'No se pudo borrar el presupuesto' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Solo se pueden borrar borradores. Los enviados se anulan.' }, { status: 409 })
  return NextResponse.json({ ok: true })
})
