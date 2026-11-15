import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createOrgScopedClient } from '@/lib/supabase/org-scoped-server'
import { isLoyaltyModuleMissing, LOYALTY_MIGRATION_HINT } from '@/lib/loyalty/module-status'
import { loyaltyErrorResponse } from '@/lib/loyalty/api-errors'
import { logger } from '@/lib/logger'

const settingsSchema = z.object({
  enabled: z.boolean(),
  earning_mode: z.enum(['amount', 'visits', 'both']).optional(),
  points_per_visit: z.number().int().min(1).max(100000).optional(),
  currency_per_point: z.number().positive('La tasa de conversión debe ser mayor a 0'),
  points_per_unit: z.number().int().positive('Los puntos por unidad deben ser mayores a 0'),
  rounding: z.enum(['floor', 'round']),
  max_points_per_customer_per_day: z.number().int().positive().nullable().optional(),
  points_expiration_months: z.number().int().positive().nullable().optional(),
  // Canje por saldo a favor: cuánto vale un punto y desde cuántos se puede canjear.
  // Sin valor, el canje está apagado.
  redemption_value: z.number().positive('El valor del punto debe ser mayor a 0').nullable().optional(),
  min_redemption_points: z.number().int().positive().nullable().optional(),
})

export const GET = withTenantAuth({ permission: ['promotions.read', 'pos.sales.create'], module: 'promotions' }, async (_request, { organization }) => {
  const supabase = await createOrgScopedClient(organization.id)

  const { data, error } = await supabase
    .from('loyalty_settings')
    .select('*')
    .eq('organization_id', organization.id)
    .maybeSingle()

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      // Este camino se tragaba el error: decía «falta la migración» y no
      // dejaba rastro de qué había fallado en realidad.
      logger.warn('loyalty settings: módulo reportado como no instalado', { code: error.code, message: error.message })
      return NextResponse.json(
        { moduleInstalled: false, message: LOYALTY_MIGRATION_HINT, reason: error.message, code: error.code },
        { status: 200 }
      )
    }
    logger.error('loyalty settings read failed', { error })
    return NextResponse.json({ error: 'No se pudo cargar la configuración de puntos' }, { status: 500 })
  }

  const capability = await supabase.rpc('loyalty_service_program_version')
  const missingCapability = capability.error && ['PGRST202', '42883'].includes(capability.error.code)
  if (capability.error && !missingCapability) {
    return NextResponse.json({ error: 'No se pudo verificar la configuración de fidelización' }, { status: 503 })
  }
  return NextResponse.json({ moduleInstalled: true, settings: data ?? null, capabilities: { serviceVisits: capability.data === 1 } })
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

  const supabase = await createOrgScopedClient(organization.id)

  if (parsed.data.earning_mode !== undefined || parsed.data.points_per_visit !== undefined) {
    const capability = await supabase.rpc('loyalty_service_program_version')
    if (capability.error || capability.data !== 1) return NextResponse.json({ error: 'Falta habilitar la migración de fidelización por turnos. No se guardaron cambios.', code: 'SERVICE_VISITS_NOT_READY' }, { status: 503 })
  }
  const row = {
    organization_id: organization.id,
    ...parsed.data,
    max_points_per_customer_per_day: parsed.data.max_points_per_customer_per_day ?? null,
    points_expiration_months: parsed.data.points_expiration_months ?? null,
    redemption_value: parsed.data.redemption_value ?? null,
    min_redemption_points: parsed.data.min_redemption_points ?? null,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }
  const save = (values: Record<string, unknown>) =>
    supabase.from('loyalty_settings').upsert(values, { onConflict: 'organization_id' }).select().single()

  const { data, error } = await save(row)

  if (error) {
    return loyaltyErrorResponse(error, 'guardar la configuración de puntos', {
      organizationId: organization.id,
    })
  }

  return NextResponse.json({ settings: data })
})
