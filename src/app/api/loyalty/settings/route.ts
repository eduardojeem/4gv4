import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { isLoyaltyModuleMissing, LOYALTY_MIGRATION_HINT } from '@/lib/loyalty/module-status'
import { logger } from '@/lib/logger'

const settingsSchema = z.object({
  enabled: z.boolean(),
  currency_per_point: z.number().positive('La tasa de conversión debe ser mayor a 0'),
  points_per_unit: z.number().int().positive('Los puntos por unidad deben ser mayores a 0'),
  rounding: z.enum(['floor', 'round']),
  max_points_per_customer_per_day: z.number().int().positive().nullable().optional(),
  points_expiration_months: z.number().int().positive().nullable().optional(),
})

export const GET = withTenantAuth({ permission: ['promotions.read', 'pos.sales.create'], module: 'promotions' }, async (_request, { organization }) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('loyalty_settings')
    .select('*')
    .eq('organization_id', organization.id)
    .maybeSingle()

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ moduleInstalled: false, message: LOYALTY_MIGRATION_HINT }, { status: 200 })
    }
    logger.error('loyalty settings read failed', { error })
    return NextResponse.json({ error: 'No se pudo cargar la configuración de puntos' }, { status: 500 })
  }

  return NextResponse.json({ moduleInstalled: true, settings: data ?? null })
})

export const PUT = withTenantAuth({ permission: 'promotions.manage', module: 'promotions' }, async (request: NextRequest, { organization, user }) => {
  const body = await request.json().catch(() => null)
  const parsed = settingsSchema.safeParse(body)

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
    .from('loyalty_settings')
    .upsert(
      {
        organization_id: organization.id,
        ...parsed.data,
        max_points_per_customer_per_day: parsed.data.max_points_per_customer_per_day ?? null,
        points_expiration_months: parsed.data.points_expiration_months ?? null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: 'organization_id' }
    )
    .select()
    .single()

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ error: LOYALTY_MIGRATION_HINT, code: 'MODULE_NOT_INSTALLED' }, { status: 503 })
    }
    logger.error('loyalty settings write failed', { error })
    return NextResponse.json({ error: 'No se pudo guardar la configuración' }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
})
