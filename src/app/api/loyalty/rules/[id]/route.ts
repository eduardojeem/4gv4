import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { loyaltyErrorResponse } from '@/lib/loyalty/api-errors'

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().max(500).nullable().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  multiplier: z.number().min(1).max(100).optional(),
  bonus_points: z.number().int().min(0).optional(),
  max_bonus_points_per_customer: z.number().int().positive().nullable().optional(),
  max_bonus_points_total: z.number().int().positive().nullable().optional(),
  min_purchase_amount: z.number().nonnegative().nullable().optional(),
  is_active: z.boolean().optional(),
})

function ruleId(routeContext: unknown): string | null {
  const params = (routeContext as { params?: { id?: string } } | undefined)?.params
  return params?.id ?? null
}

export const PATCH = withTenantAuth({ permission: 'promotions.manage', module: 'promotions' }, async (request: NextRequest, { organization }, routeContext) => {
  const id = ruleId(routeContext)
  if (!id) return NextResponse.json({ error: 'Falta el identificador de la promoción' }, { status: 400 })

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

  // `awarded_bonus_points` no se acepta nunca desde el cliente: lo lleva la
  // funcion de acreditacion y un trigger revierte cualquier intento.
  const { data, error } = await supabase
    .from('loyalty_point_rules')
    .update(parsed.data)
    .eq('id', id)
    .eq('organization_id', organization.id)
    .select()
    .single()

  if (error) {
    return loyaltyErrorResponse(error, 'actualizar la promoción', { ruleId: id })
  }

  return NextResponse.json({ rule: data })
})

export const DELETE = withTenantAuth({ permission: 'promotions.manage', module: 'promotions' }, async (_request, { organization }, routeContext) => {
  const id = ruleId(routeContext)
  if (!id) return NextResponse.json({ error: 'Falta el identificador de la promoción' }, { status: 400 })

  const supabase = await createClient()

  const { error } = await supabase
    .from('loyalty_point_rules')
    .delete()
    .eq('id', id)
    .eq('organization_id', organization.id)

  if (error) {
    return loyaltyErrorResponse(error, 'eliminar la promoción', { ruleId: id })
  }

  return NextResponse.json({ success: true })
})
