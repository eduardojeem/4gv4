import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { exchangeRateErrorMessage, type ExchangeRate } from '@/lib/products/foreign-price'
import { roleHasPermission, type OrganizationRole } from '@/lib/saas/permissions'

export const dynamic = 'force-dynamic'

const MISSING_TABLE = /does not exist|could not find|schema cache/i

/** Tipos de cambio de la empresa, cuántos productos usan cada moneda y los últimos cambios. */
export const GET = withTenantAuth({ permission: 'products.read' }, async (_request, { organization }) => {
  const supabase = await createClient()
  const [rates, settings, history, products] = await Promise.all([
    supabase.from('exchange_rates').select('currency, rate, rounding, updated_at').eq('organization_id', organization.id).order('currency'),
    supabase.from('organization_settings').select('currency').eq('organization_id', organization.id).maybeSingle(),
    supabase
      .from('exchange_rate_history')
      .select('id, currency, previous_rate, rate, products_updated, created_at')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase.from('products').select('price_currency').eq('organization_id', organization.id).not('price_currency', 'is', null).limit(10000),
  ])

  const localCurrency = (settings.data as { currency?: string } | null)?.currency || 'PYG'
  const canEdit = roleHasPermission(organization.role as OrganizationRole, 'settings.manage')
  if (rates.error) {
    // Falta correr la migración: la pantalla lo explica en vez de fallar.
    if (MISSING_TABLE.test(rates.error.message)) {
      return NextResponse.json({ available: false, canEdit, localCurrency, rates: [], history: [], usage: {} })
    }
    logger.error('No se pudieron leer los tipos de cambio', { error: rates.error.message })
    return NextResponse.json({ error: 'No se pudieron leer los tipos de cambio' }, { status: 500 })
  }

  const usage: Record<string, number> = {}
  for (const row of (products.data ?? []) as Array<{ price_currency: string }>) {
    usage[row.price_currency] = (usage[row.price_currency] ?? 0) + 1
  }

  return NextResponse.json({
    available: true,
    canEdit,
    localCurrency,
    rates: ((rates.data ?? []) as ExchangeRate[]).map((rate) => ({ ...rate, rate: Number(rate.rate), rounding: Number(rate.rounding) })),
    history: history.data ?? [],
    usage,
  })
})

const rateSchema = z.object({
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  rate: z.number().positive().max(1_000_000_000),
  rounding: z.union([z.literal(0.01), z.literal(1), z.literal(10), z.literal(50), z.literal(100), z.literal(500), z.literal(1000)]).default(1),
})

/** Guarda el tipo de cambio y recalcula los precios de los productos en esa moneda. */
export const POST = withTenantAuth({ permission: 'settings.manage' }, async (request, { organization }) => {
  const parsed = rateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Revisá la moneda y el tipo de cambio' }, { status: 400 })
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_exchange_rate', {
    p_organization_id: organization.id,
    p_currency: parsed.data.currency,
    p_rate: parsed.data.rate,
    p_rounding: parsed.data.rounding,
  })
  if (error) {
    logger.warn('No se pudo guardar el tipo de cambio', { error: error.message })
    return NextResponse.json({ error: exchangeRateErrorMessage(error) }, { status: 400 })
  }
  return NextResponse.json({ ok: true, result: data })
})

export const DELETE = withTenantAuth({ permission: 'settings.manage' }, async (request, { organization }) => {
  const currency = new URL(request.url).searchParams.get('currency') ?? ''
  if (!/^[A-Za-z]{3}$/.test(currency)) return NextResponse.json({ error: 'Moneda inválida' }, { status: 400 })
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_exchange_rate', { p_organization_id: organization.id, p_currency: currency })
  if (error) return NextResponse.json({ error: exchangeRateErrorMessage(error) }, { status: 400 })
  return NextResponse.json({ ok: true })
})
