import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, getAuthResponse } from '@/lib/auth/require-auth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type PromotionRow = {
  id: string
  code: string
  name: string
  description: string | null
  type: string
  value: number | null
  min_purchase: number | null
  max_discount: number | null
  applicable_products: string[] | null
  applicable_categories: string[] | null
  start_date: string | null
  end_date: string | null
  is_active: boolean | null
  usage_count: number | null
  usage_limit: number | null
  created_at: string | null
  updated_at: string | null
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapPromotionRow(row: PromotionRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    type: row.type,
    value: toSafeNumber(row.value, 0),
    min_purchase: row.min_purchase == null ? undefined : toSafeNumber(row.min_purchase, 0),
    max_discount: row.max_discount == null ? undefined : toSafeNumber(row.max_discount, 0),
    applicable_products: Array.isArray(row.applicable_products) ? row.applicable_products : undefined,
    applicable_categories: Array.isArray(row.applicable_categories) ? row.applicable_categories : undefined,
    start_date: row.start_date,
    end_date: row.end_date,
    is_active: row.is_active !== false,
    usage_count: toSafeNumber(row.usage_count, 0),
    usage_limit: row.usage_limit,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  }
}

// GET - Obtener promoción específica
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      logger.error('Failed to fetch promotion by id', { promotionId: id, error: error.message })
      throw error
    }

    if (!data) {
      return NextResponse.json({ error: 'Promoción no encontrada' }, { status: 404 })
    }

    const promotion = mapPromotionRow(data as PromotionRow)
    const now = new Date()
    const start = promotion.start_date ? new Date(promotion.start_date) : null
    const end = promotion.end_date ? new Date(promotion.end_date) : null

    const stats = {
      usage_percentage:
        promotion.usage_limit && promotion.usage_limit > 0
          ? ((promotion.usage_count || 0) / promotion.usage_limit) * 100
          : 0,
      is_expired: Boolean(end && now.getTime() > end.getTime()),
      is_active_now:
        promotion.is_active &&
        (!start || now.getTime() >= start.getTime()) &&
        (!end || now.getTime() <= end.getTime()),
      days_remaining:
        end == null ? null : Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
    }

    return NextResponse.json({
      ...promotion,
      stats,
    })
  } catch (error) {
    logger.error('Promotions [id] GET API error', { error })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PUT - Actualizar promoción específica (staff only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('promotions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to load promotion before update', { promotionId: id, error: existingError.message })
      throw existingError
    }

    if (!existing) {
      return NextResponse.json({ error: 'Promoción no encontrada' }, { status: 404 })
    }

    if (body.name) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from('promotions')
        .select('id')
        .neq('id', id)
        .eq('name', String(body.name))
        .maybeSingle()

      if (duplicateError) {
        logger.error('Failed to validate promotion name uniqueness', {
          promotionId: id,
          error: duplicateError.message,
        })
        throw duplicateError
      }

      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe otra promoción con ese nombre' },
          { status: 409 }
        )
      }
    }

    const startDate = body.start_date ?? existing.start_date
    const endDate = body.end_date ?? existing.end_date
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (start.getTime() >= end.getTime()) {
        return NextResponse.json(
          { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
          { status: 400 }
        )
      }
    }

    const patch: Record<string, unknown> = {}
    const allowedKeys = [
      'name',
      'code',
      'description',
      'type',
      'value',
      'min_purchase',
      'max_discount',
      'applicable_products',
      'applicable_categories',
      'start_date',
      'end_date',
      'is_active',
      'usage_count',
      'usage_limit',
    ]

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        patch[key] = body[key]
      }
    }

    const { data: updated, error } = await supabase
      .from('promotions')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) {
      logger.error('Failed to update promotion by id', { promotionId: id, error: error.message })
      throw error
    }

    if (!updated) {
      return NextResponse.json({ error: 'Promoción no encontrada' }, { status: 404 })
    }

    return NextResponse.json(mapPromotionRow(updated as PromotionRow))
  } catch (error) {
    logger.error('Promotions [id] PUT API error', { error })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE - Eliminar promoción específica (staff only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { id } = await params
    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('promotions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to load promotion before delete', { promotionId: id, error: existingError.message })
      throw existingError
    }

    if (!existing) {
      return NextResponse.json({ error: 'Promoción no encontrada' }, { status: 404 })
    }

    if (toSafeNumber(existing.usage_count, 0) > 0) {
      const { data: deactivated, error: deactivateError } = await supabase
        .from('promotions')
        .update({ is_active: false })
        .eq('id', id)
        .select('*')
        .single()

      if (deactivateError) {
        logger.error('Failed to deactivate promotion with usage before delete', {
          promotionId: id,
          error: deactivateError.message,
        })
        throw deactivateError
      }

      return NextResponse.json({
        message: 'Promoción desactivada debido a uso existente',
        promotion: mapPromotionRow(deactivated as PromotionRow),
      })
    }

    const { error } = await supabase.from('promotions').delete().eq('id', id)
    if (error) {
      logger.error('Failed to delete promotion by id', { promotionId: id, error: error.message })
      throw error
    }

    return NextResponse.json({
      message: 'Promoción eliminada exitosamente',
      promotion: mapPromotionRow(existing as PromotionRow),
    })
  } catch (error) {
    logger.error('Promotions [id] DELETE API error', { error })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PATCH - Operaciones específicas en la promoción (staff only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { id } = await params
    const body = await request.json()
    const operation = String(body?.operation || '').trim()
    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('promotions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to load promotion before patch operation', {
        promotionId: id,
        error: existingError.message,
      })
      throw existingError
    }

    if (!existing) {
      return NextResponse.json({ error: 'Promoción no encontrada' }, { status: 404 })
    }

    let patch: Record<string, unknown> | null = null

    if (operation === 'increment_usage') {
      const increment = Math.max(1, toSafeNumber(body?.amount, 1))
      const nextUsage = toSafeNumber(existing.usage_count, 0) + increment
      if (existing.usage_limit && nextUsage > existing.usage_limit) {
        return NextResponse.json(
          { error: 'Se excedería el límite de uso de la promoción' },
          { status: 400 }
        )
      }
      patch = { usage_count: nextUsage }
    } else if (operation === 'reset_usage') {
      patch = { usage_count: 0 }
    } else if (operation === 'toggle_active') {
      patch = { is_active: existing.is_active === false }
    } else if (operation === 'extend_date') {
      const newEndDate = body?.new_end_date
      if (!newEndDate) {
        return NextResponse.json(
          { error: 'Se requiere new_end_date para extender la promoción' },
          { status: 400 }
        )
      }
      const startDate = existing.start_date ? new Date(existing.start_date) : null
      const nextEnd = new Date(newEndDate)
      if (startDate && nextEnd.getTime() <= startDate.getTime()) {
        return NextResponse.json(
          { error: 'La nueva fecha de fin debe ser posterior a la fecha de inicio' },
          { status: 400 }
        )
      }
      patch = { end_date: newEndDate }
    } else {
      return NextResponse.json({ error: 'Operación no válida' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('promotions')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      logger.error('Failed to apply patch operation to promotion', {
        promotionId: id,
        operation,
        error: error.message,
      })
      throw error
    }

    return NextResponse.json({
      message: 'Operación completada exitosamente',
      promotion: mapPromotionRow(updated as PromotionRow),
    })
  } catch (error) {
    logger.error('Promotions [id] PATCH API error', { error })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
