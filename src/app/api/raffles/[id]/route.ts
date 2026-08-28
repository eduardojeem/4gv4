import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { loyaltyErrorResponse } from '@/lib/loyalty/api-errors'
import { logger } from '@/lib/logger'

function raffleId(routeContext: unknown): string | null {
  const params = (routeContext as { params?: { id?: string } } | undefined)?.params
  return params?.id ?? null
}

/** Detalle con participantes y ganadores, para el panel de administración. */
export const GET = withTenantAuth({ permission: ['promotions.read', 'pos.sales.create'], module: 'promotions' }, async (_request, { organization }, routeContext) => {
  const id = raffleId(routeContext)
  if (!id) return NextResponse.json({ error: 'Falta el sorteo' }, { status: 400 })

  const supabase = await createClient()

  const [raffle, tickets, winners] = await Promise.all([
    supabase.from('raffles').select('*').eq('id', id).eq('organization_id', organization.id).maybeSingle(),
    supabase.from('raffle_tickets').select('*, customer:customers(id, name, email, phone)').eq('raffle_id', id).order('ticket_number'),
    supabase.from('raffle_winners').select('*, customer:customers(id, name, email, phone), ticket:raffle_tickets(ticket_number)').eq('raffle_id', id).order('prize_position'),
  ])

  if (raffle.error) {
    logger.error('raffle detail failed', { error: raffle.error })
    return NextResponse.json({ error: 'No se pudo cargar el sorteo' }, { status: 500 })
  }

  if (!raffle.data) return NextResponse.json({ error: 'El sorteo no existe' }, { status: 404 })

  return NextResponse.json({
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
})

export const PATCH = withTenantAuth({ permission: 'promotions.manage', module: 'promotions' }, async (request: NextRequest, { organization }, routeContext) => {
  const id = raffleId(routeContext)
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

  const supabase = await createClient()

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
