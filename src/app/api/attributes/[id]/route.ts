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

// GET /api/attributes/[id] - Obtener atributo específico
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('variant_attributes')
      .select('*, options:variant_attribute_options(*)')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      logger.error('Failed to fetch variant attribute by id', {
        attributeId: id,
        error: error.message,
      })
      throw error
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Atributo no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: mapAttributeRow(data as VariantAttributeRow),
    })
  } catch (error) {
    logger.error('Attributes [id] GET API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/attributes/[id] - Actualizar atributo específico (staff only)
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
      .from('variant_attributes')
      .select('id, name')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to load variant attribute before update', {
        attributeId: id,
        error: existingError.message,
      })
      throw existingError
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Atributo no encontrado' },
        { status: 404 }
      )
    }

    const patch: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const normalizedName = String(body.name).trim()
      if (!normalizedName) {
        return NextResponse.json(
          { success: false, error: 'El nombre no puede estar vacío' },
          { status: 400 }
        )
      }

      if (normalizedName.toLowerCase() !== String(existing.name).toLowerCase()) {
        const { data: duplicateByName, error: duplicateError } = await supabase
          .from('variant_attributes')
          .select('id')
          .neq('id', id)
          .ilike('name', normalizedName)
          .maybeSingle()

        if (duplicateError) {
          logger.error('Failed to validate variant attribute uniqueness on update', {
            attributeId: id,
            error: duplicateError.message,
          })
          throw duplicateError
        }

        if (duplicateByName) {
          return NextResponse.json(
            { success: false, error: 'Ya existe un atributo con ese nombre' },
            { status: 409 }
          )
        }
      }

      patch.name = normalizedName
    }

    if (body.type !== undefined) {
      const normalizedType = normalizeAttributeType(body.type)
      if (!normalizedType) {
        return NextResponse.json(
          { success: false, error: 'Tipo inválido. Use: color, size, text, number' },
          { status: 400 }
        )
      }
      patch.type = normalizedType
    }

    if (body.required !== undefined) patch.required = body.required === true
    if (body.sort_order !== undefined) patch.sort_order = toSafeNumber(body.sort_order, 0)
    if (body.active !== undefined) patch.is_active = body.active === true

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await supabase
        .from('variant_attributes')
        .update(patch)
        .eq('id', id)

      if (updateError) {
        logger.error('Failed to update variant attribute', {
          attributeId: id,
          error: updateError.message,
        })
        throw updateError
      }
    }

    if (Array.isArray(body.options)) {
      const { error: deleteOptionsError } = await supabase
        .from('variant_attribute_options')
        .delete()
        .eq('attribute_id', id)

      if (deleteOptionsError) {
        logger.error('Failed to replace variant attribute options - delete phase', {
          attributeId: id,
          error: deleteOptionsError.message,
        })
        throw deleteOptionsError
      }

      const optionPayload = body.options
        .filter((option: unknown) => {
          if (!option || typeof option !== 'object') return false
          const optionValue = (option as { value?: unknown }).value
          return typeof optionValue === 'string' && optionValue.trim().length > 0
        })
        .map((option: { value: string; display_value?: string; color_hex?: string; sort_order?: number; active?: boolean }, index: number) => ({
          attribute_id: id,
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
        const { error: insertOptionsError } = await supabase
          .from('variant_attribute_options')
          .insert(optionPayload)

        if (insertOptionsError) {
          logger.error('Failed to replace variant attribute options - insert phase', {
            attributeId: id,
            error: insertOptionsError.message,
          })
          throw insertOptionsError
        }
      }
    }

    const { data: updated, error: reloadError } = await supabase
      .from('variant_attributes')
      .select('*, options:variant_attribute_options(*)')
      .eq('id', id)
      .maybeSingle()

    if (reloadError) {
      logger.error('Failed to reload variant attribute after update', {
        attributeId: id,
        error: reloadError.message,
      })
      throw reloadError
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Atributo no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: mapAttributeRow(updated as VariantAttributeRow),
    })
  } catch (error) {
    logger.error('Attributes [id] PUT API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE /api/attributes/[id] - Eliminar atributo específico (staff only)
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
      .from('variant_attributes')
      .select('*, options:variant_attribute_options(*)')
      .eq('id', id)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to load variant attribute before delete', {
        attributeId: id,
        error: existingError.message,
      })
      throw existingError
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Atributo no encontrado' },
        { status: 404 }
      )
    }

    const { error: deleteError } = await supabase
      .from('variant_attributes')
      .delete()
      .eq('id', id)

    if (deleteError) {
      logger.error('Failed to delete variant attribute', {
        attributeId: id,
        error: deleteError.message,
      })
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Atributo eliminado exitosamente',
        deleted_attribute: mapAttributeRow(existing as VariantAttributeRow),
      },
    })
  } catch (error) {
    logger.error('Attributes [id] DELETE API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
