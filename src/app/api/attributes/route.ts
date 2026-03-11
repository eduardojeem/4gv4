import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireStaff, getAuthResponse } from '@/lib/auth/require-auth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type AttributeType = 'color' | 'size' | 'text' | 'number'

type VariantAttributeOptionRow = {
  id: string
  attribute_id: string
  value: string
  display_value: string | null
  color_hex: string | null
  sort_order: number | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

type VariantAttributeRow = {
  id: string
  name: string
  type: string
  required: boolean | null
  sort_order: number | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  options?: VariantAttributeOptionRow[] | null
}

function normalizeAttributeType(value: unknown): AttributeType | null {
  if (value === 'color' || value === 'size' || value === 'text' || value === 'number') {
    return value
  }
  return null
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function mapAttributeRow(row: VariantAttributeRow) {
  const options = Array.isArray(row.options) ? row.options : []

  return {
    id: row.id,
    name: row.name,
    type: normalizeAttributeType(row.type) ?? 'text',
    required: row.required === true,
    options: options
      .slice()
      .sort((a, b) => toSafeNumber(a.sort_order, 0) - toSafeNumber(b.sort_order, 0))
      .map((option) => ({
        id: option.id,
        attribute_id: option.attribute_id,
        value: option.value,
        display_value: option.display_value ?? undefined,
        color_hex: option.color_hex ?? undefined,
        sort_order: toSafeNumber(option.sort_order, 0),
        active: option.is_active !== false,
      })),
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  }
}

// GET /api/attributes - Obtener todos los atributos
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const active = searchParams.get('active')

    const normalizedType = type ? normalizeAttributeType(type) : null
    if (type && !normalizedType) {
      return NextResponse.json(
        { success: false, error: 'Tipo de atributo no válido. Use: color, size, text, number' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    let query = supabase
      .from('variant_attributes')
      .select('*, options:variant_attribute_options(*)')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (normalizedType) {
      query = query.eq('type', normalizedType)
    }

    if (active !== null) {
      query = query.eq('is_active', active === 'true')
    }

    const { data, error } = await query

    if (error) {
      logger.error('Failed to fetch variant attributes', { error: error.message })
      throw error
    }

    const rows = (data || []) as VariantAttributeRow[]

    return NextResponse.json({
      success: true,
      data: rows.map(mapAttributeRow),
    })
  } catch (error) {
    logger.error('Attributes GET API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/attributes - Crear nuevo atributo (staff only)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const body = await request.json()
    const name = String(body?.name || '').trim()
    const type = normalizeAttributeType(body?.type)
    const required = body?.required === true

    if (!name || !type) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: name, type' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: existingByName, error: existingError } = await supabase
      .from('variant_attributes')
      .select('id')
      .ilike('name', name)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to validate variant attribute uniqueness', {
        name,
        error: existingError.message,
      })
      throw existingError
    }

    if (existingByName) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un atributo con ese nombre' },
        { status: 409 }
      )
    }

    const rawSortOrder = body?.sort_order
    let sortOrder = Number.isFinite(Number(rawSortOrder)) ? Number(rawSortOrder) : null

    if (sortOrder == null) {
      const { data: lastAttribute, error: sortError } = await supabase
        .from('variant_attributes')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sortError) {
        logger.error('Failed to compute next variant attribute sort order', {
          error: sortError.message,
        })
        throw sortError
      }

      sortOrder = toSafeNumber(lastAttribute?.sort_order, 0) + 1
    }

    const { data: insertedAttribute, error: insertError } = await supabase
      .from('variant_attributes')
      .insert({
        name,
        type,
        required,
        sort_order: sortOrder,
        is_active: body?.active !== false,
      })
      .select('*')
      .single()

    if (insertError) {
      logger.error('Failed to insert variant attribute', {
        name,
        error: insertError.message,
      })
      throw insertError
    }

    const options = Array.isArray(body?.options) ? body.options : []

    if (options.length > 0) {
      const optionPayload = options
        .filter((option) => option && typeof option.value === 'string' && option.value.trim().length > 0)
        .map((option, index) => ({
          attribute_id: insertedAttribute.id,
          value: String(option.value).trim(),
          display_value:
            typeof option.display_value === 'string' && option.display_value.trim().length > 0
              ? option.display_value.trim()
              : null,
          color_hex:
            typeof option.color_hex === 'string' && option.color_hex.trim().length > 0
              ? option.color_hex.trim()
              : null,
          sort_order: Number.isFinite(Number(option.sort_order)) ? Number(option.sort_order) : index + 1,
          is_active: option.active !== false,
        }))

      if (optionPayload.length > 0) {
        const { error: optionInsertError } = await supabase
          .from('variant_attribute_options')
          .insert(optionPayload)

        if (optionInsertError) {
          logger.error('Failed to insert variant attribute options', {
            attributeId: insertedAttribute.id,
            error: optionInsertError.message,
          })
          throw optionInsertError
        }
      }
    }

    const { data: fullAttribute, error: reloadError } = await supabase
      .from('variant_attributes')
      .select('*, options:variant_attribute_options(*)')
      .eq('id', insertedAttribute.id)
      .single()

    if (reloadError) {
      logger.error('Failed to reload variant attribute after insert', {
        attributeId: insertedAttribute.id,
        error: reloadError.message,
      })
      throw reloadError
    }

    return NextResponse.json(
      {
        success: true,
        data: mapAttributeRow(fullAttribute as VariantAttributeRow),
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Attributes POST API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/attributes - Actualización masiva de atributos (staff only)
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const body = await request.json()
    const attributes = Array.isArray(body?.attributes) ? body.attributes : null

    if (!attributes) {
      return NextResponse.json(
        { success: false, error: 'Se esperaba un array de atributos' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const updatedRows: VariantAttributeRow[] = []

    for (const attributeData of attributes) {
      if (!attributeData?.id) continue

      const patch: Record<string, unknown> = {}
      if (attributeData.name !== undefined) patch.name = String(attributeData.name).trim()
      if (attributeData.type !== undefined) {
        const normalizedType = normalizeAttributeType(attributeData.type)
        if (!normalizedType) {
          return NextResponse.json(
            { success: false, error: `Tipo inválido para atributo ${attributeData.id}` },
            { status: 400 }
          )
        }
        patch.type = normalizedType
      }
      if (attributeData.required !== undefined) patch.required = attributeData.required === true
      if (attributeData.sort_order !== undefined) patch.sort_order = toSafeNumber(attributeData.sort_order, 0)
      if (attributeData.active !== undefined) patch.is_active = attributeData.active === true

      if (Object.keys(patch).length === 0) continue

      const { data: updated, error } = await supabase
        .from('variant_attributes')
        .update(patch)
        .eq('id', String(attributeData.id))
        .select('*, options:variant_attribute_options(*)')
        .maybeSingle()

      if (error) {
        logger.error('Failed to update variant attribute in bulk', {
          attributeId: attributeData.id,
          error: error.message,
        })
        throw error
      }

      if (updated) {
        updatedRows.push(updated as VariantAttributeRow)
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedRows.map(mapAttributeRow),
      message: `${updatedRows.length} atributos actualizados`,
    })
  } catch (error) {
    logger.error('Attributes PUT API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
