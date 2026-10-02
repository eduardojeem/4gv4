import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { QUOTE_STATUSES } from '@/lib/quotes/quote-math'
import { QUOTE_COLUMNS, quoteInputSchema, quoteRows, validationError } from '@/lib/quotes/quote-api'
import { assertQuoteProducts, organizationCurrency } from '@/lib/quotes/quote-server'

export const dynamic = 'force-dynamic'

const MISSING_TABLE = /does not exist|could not find|schema cache/i
const guard = { permission: 'pos.sales.create', module: 'pos' } as const

export const GET = withTenantAuth(guard, async (request, { organization }) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const term = (searchParams.get('q') ?? '').replace(/[,()%*\\]/g, ' ').trim()
  const supabase = await createClient()

  let query = supabase
    .from('quotes')
    .select(QUOTE_COLUMNS)
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false })
    .limit(300)
  if (status && (QUOTE_STATUSES as readonly string[]).includes(status)) query = query.eq('status', status)
  if (term) {
    const number = Number(term.replace(/^p-?/i, ''))
    query = Number.isInteger(number) && number > 0
      ? query.or(`number.eq.${number},customer_name.ilike.%${term}%`)
      : query.or(`customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) {
    if (MISSING_TABLE.test(error.message)) return NextResponse.json({ available: false, quotes: [] })
    logger.error('No se pudieron leer los presupuestos', { error: error.message })
    return NextResponse.json({ error: 'No se pudieron leer los presupuestos' }, { status: 500 })
  }
  return NextResponse.json({ available: true, quotes: data ?? [] })
})

export const POST = withTenantAuth(guard, async (request, { organization, user }) => {
  const parsed = quoteInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: validationError(parsed.error) }, { status: 400 })

  const supabase = await createClient()
  const productError = await assertQuoteProducts(supabase, organization.id, parsed.data.items)
  if (productError) return NextResponse.json({ error: productError }, { status: 400 })

  const currency = await organizationCurrency(supabase, organization.id)
  const { header, items } = quoteRows(parsed.data, organization.id, currency)

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({ ...header, organization_id: organization.id, created_by: user.id, status: 'draft' })
    .select(QUOTE_COLUMNS)
    .single()
  if (error || !quote) {
    logger.error('No se pudo crear el presupuesto', { error: error?.message })
    return NextResponse.json({ error: 'No se pudo crear el presupuesto' }, { status: 500 })
  }

  const { error: itemsError } = await supabase
    .from('quote_items')
    .insert(items.map((item) => ({ ...item, quote_id: (quote as { id: string }).id })))
  if (itemsError) {
    // Sin líneas el presupuesto no sirve: se deshace.
    await supabase.from('quotes').delete().eq('id', (quote as { id: string }).id)
    logger.error('No se pudieron guardar las líneas del presupuesto', { error: itemsError.message })
    return NextResponse.json({ error: 'No se pudieron guardar las líneas del presupuesto' }, { status: 500 })
  }

  return NextResponse.json({ quote }, { status: 201 })
})
