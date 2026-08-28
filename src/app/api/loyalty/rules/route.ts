import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { isLoyaltyModuleMissing, LOYALTY_MIGRATION_HINT } from '@/lib/loyalty/module-status'
import { loyaltyErrorResponse } from '@/lib/loyalty/api-errors'
import { logger } from '@/lib/logger'

const ruleSchema = z.object({
  name: z.string().min(2, 'Poné un nombre reconocible para la promoción'),
  description: z.string().max(500).nullable().optional(),
  starts_at: z.string().min(1, 'Falta la fecha de inicio'),
  ends_at: z.string().min(1, 'Falta la fecha de cierre'),
  kind: z.enum(['multiplier', 'bonus_per_purchase']),
  multiplier: z.number().min(1).max(100),
  bonus_points: z.number().int().min(0),
  max_bonus_points_per_customer: z.number().int().positive().nullable().optional(),
  max_bonus_points_total: z.number().int().positive().nullable().optional(),
  min_purchase_amount: z.number().nonnegative().nullable().optional(),
  is_active: z.boolean().default(true),
}).refine((data) => new Date(data.ends_at) > new Date(data.starts_at), {
  message: 'La fecha de cierre tiene que ser posterior a la de inicio',
})

function validationError(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>) {
  return NextResponse.json(
    {
      error: 'Error de validación',
      code: 'VALIDATION_FAILED',
      details: issues.map((i) => ({ field: i.path.map(String).join('.'), message: i.message })),
    },
    { status: 400 }
  )
}

export const GET = withTenantAuth({ permission: ['promotions.read', 'pos.sales.create'], module: 'promotions' }, async (_request, { organization }) => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('loyalty_point_rules')
    .select('*')
    .eq('organization_id', organization.id)
    .order('starts_at', { ascending: false })

  if (error) {
    if (isLoyaltyModuleMissing(error)) {
      return NextResponse.json({ moduleInstalled: false, rules: [], message: LOYALTY_MIGRATION_HINT })
    }
    logger.error('loyalty rules read failed', { error })
    return NextResponse.json({ error: 'No se pudieron cargar las promociones de puntos' }, { status: 500 })
  }

  return NextResponse.json({ moduleInstalled: true, rules: data ?? [] })
})

export const POST = withTenantAuth({ permission: 'promotions.manage', module: 'promotions' }, async (request: NextRequest, { organization, user }) => {
  const body = await request.json().catch(() => null)
  const parsed = ruleSchema.safeParse(body)

  if (!parsed.success) return validationError(parsed.error.issues)

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('loyalty_point_rules')
    .insert({
      organization_id: organization.id,
      ...parsed.data,
      description: parsed.data.description ?? null,
      max_bonus_points_per_customer: parsed.data.max_bonus_points_per_customer ?? null,
      max_bonus_points_total: parsed.data.max_bonus_points_total ?? null,
      min_purchase_amount: parsed.data.min_purchase_amount ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return loyaltyErrorResponse(error, 'crear la promoción de puntos', {
      organizationId: organization.id,
    })
  }

  return NextResponse.json({ rule: data }, { status: 201 })
})
