import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { isLoyaltyModuleMissing, LOYALTY_MIGRATION_HINT } from '@/lib/loyalty/module-status'
import { logger } from '@/lib/logger'

const prizeSchema = z.object({
  position: z.number().int().positive(),
  title: z.string().min(2, 'Cada premio necesita un nombre'),
  details: z.string().max(300).optional(),
})

const raffleSchema = z.object({
  name: z.string().min(3, 'Poné un nombre para el sorteo'),
  description: z.string().max(1000).nullable().optional(),
  prizes: z.array(prizeSchema).min(1, 'Cargá al menos un premio'),
  requirements: z.string().max(1000).nullable().optional(),
  terms: z.string().max(4000).nullable().optional(),
  starts_at: z.string().min(1, 'Falta la fecha de inicio'),
  ends_at: z.string().min(1, 'Falta la fecha de cierre'),
  points_per_ticket: z.number().int().positive('Cada número tiene que costar al menos 1 punto'),
  max_tickets_per_customer: z.number().int().positive().nullable().optional(),
  max_tickets_total: z.number().int().positive().max(1_000_000).default(10_000),
  min_age: z.number().int().min(0).max(99).default(18),
  status: z.enum(['draft', 'published']).default('draft'),
}).refine((data) => new Date(data.ends_at) > new Date(data.starts_at), {
  message: 'La fecha de cierre tiene que ser posterior a la de inicio',
})

export const GET = withTenantAuth({ permission: ['promotions.read', 'pos.sales.create'], module: 'promotions' }, async (_request, { organization }) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('raffles')
    .select('*, tickets:raffle_tickets(count), winners:raffle_winners(count)')
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false })

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ moduleInstalled: false, raffles: [], message: LOYALTY_MIGRATION_HINT })
    }
    logger.error('raffles read failed', { error })
    return NextResponse.json({ error: 'No se pudieron cargar los sorteos' }, { status: 500 })
  }

  return NextResponse.json({ moduleInstalled: true, raffles: data ?? [] })
})

export const POST = withTenantAuth({ permission: 'promotions.manage', module: 'promotions' }, async (request: NextRequest, { organization, user }) => {
  const body = await request.json().catch(() => null)
  const parsed = raffleSchema.safeParse(body)

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
    .insert({
      organization_id: organization.id,
      ...parsed.data,
      description: parsed.data.description ?? null,
      requirements: parsed.data.requirements ?? null,
      terms: parsed.data.terms ?? null,
      max_tickets_per_customer: parsed.data.max_tickets_per_customer ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ error: LOYALTY_MIGRATION_HINT, code: 'MODULE_NOT_INSTALLED' }, { status: 503 })
    }
    logger.error('raffle create failed', { error })
    return NextResponse.json({ error: 'No se pudo crear el sorteo' }, { status: 500 })
  }

  return NextResponse.json({ raffle: data }, { status: 201 })
})
