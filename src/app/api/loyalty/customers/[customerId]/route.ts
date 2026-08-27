import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { isLoyaltyModuleMissing, LOYALTY_MIGRATION_HINT } from '@/lib/loyalty/module-status'
import { logger } from '@/lib/logger'

function customerId(routeContext: unknown): string | null {
  const params = (routeContext as { params?: { customerId?: string } } | undefined)?.params
  return params?.customerId ?? null
}

/** Historial completo del cliente: saldo, movimientos, números y premios. */
export const GET = withTenantAuth({ permission: 'crm.customers.read', module: 'promotions' }, async (_request, { organization }, routeContext) => {
  const id = customerId(routeContext)
  if (!id) return NextResponse.json({ error: 'Falta el cliente' }, { status: 400 })

  const supabase = await createClient()

  const [account, ledger, tickets, winners] = await Promise.all([
    supabase.from('loyalty_accounts').select('*').eq('customer_id', id).eq('organization_id', organization.id).maybeSingle(),
    supabase.from('loyalty_ledger').select('*').eq('customer_id', id).eq('organization_id', organization.id).order('created_at', { ascending: false }).limit(200),
    supabase.from('raffle_tickets').select('*, raffle:raffles(id, name, status, ends_at, drawn_at)').eq('customer_id', id).eq('organization_id', organization.id).order('created_at', { ascending: false }),
    supabase.from('raffle_winners').select('*, raffle:raffles(id, name, drawn_at)').eq('customer_id', id).eq('organization_id', organization.id).order('created_at', { ascending: false }),
  ])

  const firstError = account.error || ledger.error || tickets.error || winners.error

  if (firstError) {
    if (isLoyaltyModuleMissing(firstError)) {
      return NextResponse.json({ moduleInstalled: false, message: LOYALTY_MIGRATION_HINT })
    }
    logger.error('loyalty customer history failed', { error: firstError })
    return NextResponse.json({ error: 'No se pudo cargar el historial de puntos' }, { status: 500 })
  }

  return NextResponse.json({
    moduleInstalled: true,
    account: account.data ?? null,
    ledger: ledger.data ?? [],
    tickets: tickets.data ?? [],
    winners: winners.data ?? [],
  })
})

const adjustSchema = z.object({
  points: z.number().int().refine((n) => n !== 0, 'El ajuste no puede ser cero'),
  reason: z.string().min(4, 'Explicá el motivo del ajuste: queda en el historial'),
})

/** Ajuste manual. Pasa por la función, que exige motivo y bloquea negativos. */
export const POST = withTenantAuth({ permission: 'promotions.manage', module: 'promotions' }, async (request: NextRequest, _context, routeContext) => {
  const id = customerId(routeContext)
  if (!id) return NextResponse.json({ error: 'Falta el cliente' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const parsed = adjustSchema.safeParse(body)

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

  const { data, error } = await supabase.rpc('adjust_loyalty_points', {
    p_customer_id: id,
    p_points: parsed.data.points,
    p_reason: parsed.data.reason,
  })

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ error: LOYALTY_MIGRATION_HINT, code: 'MODULE_NOT_INSTALLED' }, { status: 503 })
    }
    logger.error('loyalty adjust failed', { error })
    // El mensaje de la funcion ya esta redactado para el usuario.
    return NextResponse.json({ error: error.message || 'No se pudo ajustar el saldo' }, { status: 400 })
  }

  return NextResponse.json({ entry: data })
})

const exclusionSchema = z.object({
  // null levanta la autoexclusión; una fecha futura la registra.
  self_excluded_until: z.string().datetime().nullable(),
})

/**
 * Autoexclusión de sorteos, a pedido del cliente.
 *
 * Registrarla la puede hacer el mostrador; levantarla exige permiso de gestión,
 * y eso lo decide la función de la base, no esta ruta.
 */
export const PATCH = withTenantAuth({ permission: 'pos.sales.create', module: 'promotions' }, async (request: NextRequest, _context, routeContext) => {
  const id = customerId(routeContext)
  if (!id) return NextResponse.json({ error: 'Falta el cliente' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const parsed = exclusionSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Error de validación',
        code: 'VALIDATION_FAILED',
        details: parsed.error.issues.map((i) => ({ field: i.path.map(String).join('.'), message: i.message })),
      },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('set_loyalty_self_exclusion', {
    p_customer_id: id,
    p_until: parsed.data.self_excluded_until,
  })

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ error: LOYALTY_MIGRATION_HINT, code: 'MODULE_NOT_INSTALLED' }, { status: 503 })
    }
    logger.warn('self exclusion rejected', { error })
    return NextResponse.json({ error: error.message || 'No se pudo registrar la autoexclusión' }, { status: 400 })
  }

  return NextResponse.json({ account: data })
})
