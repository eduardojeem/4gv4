import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { routeParam } from '@/lib/api/route-params'
import { createOrgScopedClient } from '@/lib/supabase/org-scoped-server'
import { loyaltyErrorResponse } from '@/lib/loyalty/api-errors'
import { logger } from '@/lib/logger'
import { canTransitionRaffleStatus, raffleTransitionMessage, type RaffleLifecycleStatus } from '@/lib/raffles/lifecycle'

/** Detalle con participantes y ganadores, para el panel de administración. */
export const GET = withTenantAuth({ permission: ['promotions.read', 'pos.sales.create'], module: 'promotions' }, async (request, { organization }, routeContext) => {
  const id = await routeParam(routeContext, 'id')
  if (!id) return NextResponse.json({ error: 'Falta el sorteo' }, { status: 400 })

  const supabase = await createOrgScopedClient(organization.id)

  const params = new URL(request.url).searchParams
  const paged = params.has('page')
  const page = Number(params.get('page') ?? 1)
  const limit = Number(params.get('limit') ?? 25)
  if (!Number.isInteger(page) || page < 1 || page > 40000 || !Number.isInteger(limit) || limit < 1 || limit > 100) return NextResponse.json({ error: 'La página de participantes no es válida' }, { status: 400 })
  const ticketQuery = supabase.from('raffle_tickets').select('*, customer:customers(id, name, email, phone)', { count: 'exact' }).eq('raffle_id', id).eq('organization_id', organization.id).order('ticket_number')
  const [raffle, tickets, winners] = await Promise.all([
    supabase.from('raffles').select('*').eq('id', id).eq('organization_id', organization.id).maybeSingle(),
    paged ? ticketQuery.range((page - 1) * limit, page * limit - 1) : ticketQuery,
    supabase.from('raffle_winners').select('*, customer:customers(id, name, email, phone), ticket:raffle_tickets(ticket_number)').eq('raffle_id', id).eq('organization_id', organization.id).order('prize_position'),
  ])

  if (raffle.error) {
    logger.error('raffle detail failed', { error: raffle.error })
    return NextResponse.json({ error: 'No se pudo cargar el sorteo' }, { status: 500 })
  }

  if (tickets.error || winners.error) return NextResponse.json({ error: 'No se pudieron cargar los participantes o ganadores' }, { status: 500 })

  if (!raffle.data) return NextResponse.json({ error: 'El sorteo no existe' }, { status: 404 })

  if (paged && tickets.count === null) return NextResponse.json({ error: 'No se pudo consultar el total de participantes' }, { status: 500 })

  return NextResponse.json({
    ...(paged ? { ticketsPagination: { page, limit, total: tickets.count, pages: Math.ceil((tickets.count ?? 0) / limit) } } : {}),
    raffle: raffle.data,
    tickets: tickets.data ?? [],
    winners: winners.data ?? [],
  })
})

// 'completed' no está: el estado de un sorteo ya realizado no se revierte
// desde acá, y la RLS de la base también lo impide.
const patchSchema = z.object({
  status: z.enum(['draft', 'published', 'closed', 'cancelled']).optional(),
  name: z.string().min(3).optional(),
  description: z.string().max(1000).nullable().optional(),
  requirements: z.string().max(1000).nullable().optional(),
  terms: z.string().max(4000).nullable().optional(),
  ends_at: z.string().optional(),
  min_purchase_amount: z.number().nonnegative().nullable().optional(),
  auto_entry_on_sale: z.boolean().optional(),
  allow_point_purchase: z.boolean().optional(),
  point_purchase_price: z.number().positive().nullable().optional(),
})

export const PATCH = withTenantAuth({ permission: 'promotions.manage', module: 'promotions' }, async (request: NextRequest, { organization }, routeContext) => {
  const id = await routeParam(routeContext, 'id')
  if (!id) return NextResponse.json({ error: 'Falta el sorteo' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Error de validación',
        code: 'VALIDATION_FAILED',
        details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
      { status: 400 }
    )
  }

  const supabase = await createOrgScopedClient(organization.id)

  const current = await supabase
    .from('raffles')
    .select('id, status, starts_at, ends_at')
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle()

  if (current.error) {
    return loyaltyErrorResponse(current.error, 'consultar el estado del sorteo', { raffleId: id })
  }
  if (!current.data) return NextResponse.json({ error: 'El sorteo no existe' }, { status: 404 })

  if (parsed.data.status) {
    const from = current.data.status as RaffleLifecycleStatus
    const transitionError = raffleTransitionMessage(from, parsed.data.status)
    if (transitionError || !canTransitionRaffleStatus(from, parsed.data.status)) {
      return NextResponse.json({ error: transitionError ?? 'Transición de estado no permitida', code: 'INVALID_STATUS_TRANSITION' }, { status: 409 })
    }
  }

  if (parsed.data.ends_at) {
    const end = new Date(parsed.data.ends_at)
    const start = new Date(current.data.starts_at)
    if (!Number.isFinite(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'La fecha de cierre tiene que ser posterior a la de inicio', code: 'INVALID_END_DATE' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('raffles')
    .update(parsed.data)
    .eq('id', id)
    .eq('organization_id', organization.id)
    .select()
    .single()

  if (error) {
    return loyaltyErrorResponse(error, 'actualizar el sorteo', { raffleId: id })
  }

  return NextResponse.json({ raffle: data })
})
