import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { QUOTE_STATUSES } from '@/lib/quotes/quote-math'

export const dynamic = 'force-dynamic'

const MISSING_TABLE = /does not exist|could not find|schema cache/i
const QUOTE_READ_COLUMNS = 'id, number, customer_name, status, total, currency, valid_until, created_at'

export const GET = withTenantAuth({ permission: 'pos.sales.read', module: 'pos' }, async (request, { organization }) => {
  const { searchParams } = new URL(request.url)
  const requestedPage = Number(searchParams.get('page') || 1)
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1
  const pageSize = 30
  const requestedStatus = searchParams.get('status') ?? 'open'
  const status = requestedStatus === 'open' || requestedStatus === 'closed' || requestedStatus === 'all' || (QUOTE_STATUSES as readonly string[]).includes(requestedStatus)
    ? requestedStatus
    : 'open'
  const term = (searchParams.get('q') ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 120)
  const supabase = await createClient()

  let query = supabase
    .from('quotes')
    .select(QUOTE_READ_COLUMNS, { count: 'exact' })
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status === 'open') query = query.in('status', ['draft', 'sent'])
  else if (status === 'closed') query = query.in('status', ['rejected', 'cancelled'])
  else if (status !== 'all') query = query.eq('status', status)
  if (term) {
    const number = Number(term.replace(/^p-?/i, ''))
    query = Number.isInteger(number) && number > 0
      ? query.or(`number.eq.${number},customer_name.ilike.%${term}%`)
      : query.ilike('customer_name', `%${term}%`)
  }

  const { data, error, count } = await query
  if (error) {
    if (MISSING_TABLE.test(error.message)) {
      return NextResponse.json({ available: false, quotes: [], pagination: { page, pageSize, total: 0 } })
    }
    logger.error('[mobile-quotes] No se pudieron leer los presupuestos', { code: error.code })
    return NextResponse.json({ error: 'No se pudieron leer los presupuestos.' }, { status: 500 })
  }

  return NextResponse.json({
    available: true,
    quotes: data ?? [],
    pagination: { page, pageSize, total: count ?? 0 },
  })
})
