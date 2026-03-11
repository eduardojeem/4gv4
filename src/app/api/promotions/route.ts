import { NextRequest, NextResponse } from 'next/server'
import type { PromotionType } from '@/types/promotion'
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

function normalizePromotionType(value: unknown): PromotionType | null {
  if (value === 'percentage' || value === 'fixed') return value
  return null
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
    type: row.type as PromotionType,
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

// GET - Obtener promociones con filtros
export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')
    const type = searchParams.get('type')
    const category = searchParams.get('category')
    const productId = searchParams.get('product_id')
    const currentDate = searchParams.get('current_date')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)))

    const supabase = await createClient()
    let query = supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false })

    if (active !== null) {
      query = query.eq('is_active', active === 'true')
    }

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Failed to fetch promotions', { error: error.message })
      throw error
    }

    let rows = (data || []) as PromotionRow[]

    if (category) {
      rows = rows.filter((row) => Array.isArray(row.applicable_categories) && row.applicable_categories.includes(category))
    }

    if (productId) {
      rows = rows.filter((row) => Array.isArray(row.applicable_products) && row.applicable_products.includes(productId))
    }

    if (currentDate) {
      const date = new Date(currentDate)
      if (Number.isFinite(date.getTime())) {
        rows = rows.filter((row) => {
          const start = row.start_date ? new Date(row.start_date) : null
          const end = row.end_date ? new Date(row.end_date) : null
          const startsBefore = !start || start.getTime() <= date.getTime()
          const endsAfter = !end || end.getTime() >= date.getTime()
          return startsBefore && endsAfter
        })
      }
    }

    const total = rows.length
    const offset = (page - 1) * limit
    const promotions = rows.slice(offset, offset + limit).map(mapPromotionRow)

    return NextResponse.json({
      promotions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error('Promotions GET API error', { error })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST - Crear nueva promoción (staff only)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const body = await request.json()
    const type = normalizePromotionType(body?.type)

    if (!body?.name || !body?.code || !type) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, code, type (percentage|fixed)' },
        { status: 400 }
      )
    }

    if (body.start_date && body.end_date) {
      const start = new Date(body.start_date)
      const end = new Date(body.end_date)
      if (start.getTime() >= end.getTime()) {
        return NextResponse.json(
          { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
          { status: 400 }
        )
      }
    }

    const supabase = await createClient()

    const { data: existingByCode, error: existingError } = await supabase
      .from('promotions')
      .select('id')
      .eq('code', String(body.code))
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to validate promotion code uniqueness', { error: existingError.message })
      throw existingError
    }

    if (existingByCode) {
      return NextResponse.json({ error: 'Ya existe una promoción con ese código' }, { status: 409 })
    }

    const insertPayload = {
      code: String(body.code).trim(),
      name: String(body.name).trim(),
      description: body.description ? String(body.description) : null,
      type,
      value: toSafeNumber(body.value, 0),
      min_purchase: body.min_purchase == null ? 0 : toSafeNumber(body.min_purchase, 0),
      max_discount: body.max_discount == null ? null : toSafeNumber(body.max_discount, 0),
      applicable_products: Array.isArray(body.applicable_products) ? body.applicable_products : null,
      applicable_categories: Array.isArray(body.applicable_categories) ? body.applicable_categories : null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      is_active: body.is_active !== false,
      usage_count: 0,
      usage_limit: body.usage_limit == null ? null : toSafeNumber(body.usage_limit, 0),
    }

    const { data: created, error } = await supabase
      .from('promotions')
      .insert(insertPayload)
      .select('*')
      .single()

    if (error) {
      logger.error('Failed to create promotion', { error: error.message })
      throw error
    }

    return NextResponse.json(mapPromotionRow(created as PromotionRow), { status: 201 })
  } catch (error) {
    logger.error('Promotions POST API error', { error })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PUT - Actualización masiva de promociones (staff only)
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const body = await request.json()
    const promotions = Array.isArray(body?.promotions) ? body.promotions : null

    if (!promotions) {
      return NextResponse.json({ error: 'Se requiere un array de promociones' }, { status: 400 })
    }

    const supabase = await createClient()
    const updatedRows: PromotionRow[] = []

    for (const promotion of promotions) {
      if (!promotion?.id) continue

      const patch: Record<string, unknown> = {}
      if (promotion.name !== undefined) patch.name = String(promotion.name)
      if (promotion.description !== undefined) patch.description = promotion.description ? String(promotion.description) : null
      if (promotion.code !== undefined) patch.code = String(promotion.code)
      if (promotion.type !== undefined) {
        const normalized = normalizePromotionType(promotion.type)
        if (!normalized) {
          return NextResponse.json(
            { error: `Tipo de promoción inválido para ${promotion.id}` },
            { status: 400 }
          )
        }
        patch.type = normalized
      }
      if (promotion.value !== undefined) patch.value = toSafeNumber(promotion.value, 0)
      if (promotion.min_purchase !== undefined) patch.min_purchase = promotion.min_purchase == null ? 0 : toSafeNumber(promotion.min_purchase, 0)
      if (promotion.max_discount !== undefined) patch.max_discount = promotion.max_discount == null ? null : toSafeNumber(promotion.max_discount, 0)
      if (promotion.applicable_products !== undefined) patch.applicable_products = Array.isArray(promotion.applicable_products) ? promotion.applicable_products : null
      if (promotion.applicable_categories !== undefined) patch.applicable_categories = Array.isArray(promotion.applicable_categories) ? promotion.applicable_categories : null
      if (promotion.start_date !== undefined) patch.start_date = promotion.start_date || null
      if (promotion.end_date !== undefined) patch.end_date = promotion.end_date || null
      if (promotion.is_active !== undefined) patch.is_active = Boolean(promotion.is_active)
      if (promotion.usage_count !== undefined) patch.usage_count = toSafeNumber(promotion.usage_count, 0)
      if (promotion.usage_limit !== undefined) patch.usage_limit = promotion.usage_limit == null ? null : toSafeNumber(promotion.usage_limit, 0)

      const { data: updated, error } = await supabase
        .from('promotions')
        .update(patch)
        .eq('id', String(promotion.id))
        .select('*')
        .maybeSingle()

      if (error) {
        logger.error('Failed to update promotion in bulk', {
          promotionId: promotion.id,
          error: error.message,
        })
        throw error
      }

      if (updated) {
        updatedRows.push(updated as PromotionRow)
      }
    }

    return NextResponse.json({
      updated: updatedRows.map(mapPromotionRow),
      count: updatedRows.length,
    })
  } catch (error) {
    logger.error('Promotions PUT API error', { error })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
