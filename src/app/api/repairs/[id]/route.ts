import { NextRequest, NextResponse } from 'next/server'
import {
  assertRepairExists,
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'

type RouteParams = { params: Promise<{ id: string }> }

type RepairPartInput = {
  name?: unknown
  cost?: unknown
  quantity?: unknown
  supplier?: unknown
  partNumber?: unknown
}

type RepairNoteInput = {
  id?: unknown
  text?: unknown
  isInternal?: unknown
}

const REPAIR_FIELD_MAP: Record<string, string> = {
  brand: 'device_brand',
  model: 'device_model',
  deviceType: 'device_type',
  issue: 'problem_description',
  description: 'diagnosis',
  accessType: 'access_type',
  accessPassword: 'access_password',
  status: 'status',
  priority: 'priority',
  urgency: 'urgency',
  customer_id: 'customer_id',
  technician_id: 'technician_id',
  estimatedCost: 'estimated_cost',
  laborCost: 'labor_cost',
  finalCost: 'final_cost',
  warrantyMonths: 'warranty_months',
  warrantyType: 'warranty_type',
  warrantyNotes: 'warranty_notes',
}

function buildRepairUpdate(payload: Record<string, unknown>) {
  const updateData: Record<string, unknown> = {}

  for (const [uiField, dbField] of Object.entries(REPAIR_FIELD_MAP)) {
    if (payload[uiField] !== undefined) {
      updateData[dbField] = payload[uiField]
    }
  }

  if (payload.warrantyMonths !== undefined) {
    const months = Number(payload.warrantyMonths || 0)
    if (months > 0) {
      const expirationDate = new Date()
      expirationDate.setMonth(expirationDate.getMonth() + months)
      updateData.warranty_expires_at = expirationDate.toISOString()
    } else {
      updateData.warranty_expires_at = null
    }
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updated_at = new Date().toISOString()
  }

  return updateData
}

function normalizeParts(parts: RepairPartInput[], repairId: string) {
  return parts.map((part) => ({
    repair_id: repairId,
    part_name: String(part.name || '').trim(),
    unit_cost: Number(part.cost || 0),
    quantity: Number(part.quantity || 1),
    supplier: typeof part.supplier === 'string' && part.supplier.trim() ? part.supplier.trim() : null,
    part_number: typeof part.partNumber === 'string' && part.partNumber.trim() ? part.partNumber.trim() : null,
  })).filter((part) => part.part_name.length > 0)
}

function normalizeNotes(notes: RepairNoteInput[], repairId: string, authorId: string) {
  return notes.map((note) => {
    const payload: Record<string, unknown> = {
      repair_id: repairId,
      author_id: authorId,
      author_name: 'Sistema',
      note_text: String(note.text || '').trim(),
      is_internal: Boolean(note.isInternal),
      updated_at: new Date().toISOString(),
    }

    if (typeof note.id === 'string' && note.id.length > 0) {
      payload.id = note.id
    }

    return payload
  }).filter((note) => String(note.note_text).length > 0)
}

function normalizeImages(images: unknown[], repairId: string) {
  return images
    .map((image) => (typeof image === 'string' ? image : (image as { url?: unknown })?.url))
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
    .map((url) => ({
      repair_id: repairId,
      image_url: url,
      image_type: 'general',
    }))
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request)
    if (isNextResponse(ctx)) return ctx

    const { id } = await context.params

    // Verificar que la reparación no está en estado terminal
    const { data: current } = await ctx.supabase
      .from('repairs')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .maybeSingle()

    if (!current) {
      return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })
    }

    if (current.status === 'entregado' || current.status === 'cancelado') {
      return NextResponse.json(
        { error: `No se puede editar una reparación en estado "${current.status}".` },
        { status: 422 }
      )
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const { parts, notes, images, ...repairPayload } = body
    const updateData = buildRepairUpdate(repairPayload)

    if (Object.keys(updateData).length > 0) {
      const { data, error } = await ctx.supabase
        .from('repairs')
        .update(updateData)
        .eq('id', id)
        .eq('organization_id', ctx.organizationId)
        .eq('branch_id', ctx.branchId)
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) {
        return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })
      }
    } else {
      const exists = await assertRepairExists(ctx, id)
      if (!exists) {
        return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })
      }
    }

    if (Array.isArray(parts)) {
      const { error: deletePartsError } = await ctx.supabase
        .from('repair_parts')
        .delete()
        .eq('repair_id', id)
      if (deletePartsError) throw deletePartsError

      const partsToInsert = normalizeParts(parts as RepairPartInput[], id)
      if (partsToInsert.length > 0) {
        const { error: insertPartsError } = await ctx.supabase
          .from('repair_parts')
          .insert(partsToInsert)
        if (insertPartsError) throw insertPartsError
      }
    }

    if (Array.isArray(notes)) {
      const { error: deleteNotesError } = await ctx.supabase
        .from('repair_notes')
        .delete()
        .eq('repair_id', id)
      if (deleteNotesError) throw deleteNotesError

      const notesToInsert = normalizeNotes(notes as RepairNoteInput[], id, ctx.userId)
      if (notesToInsert.length > 0) {
        const { error: insertNotesError } = await ctx.supabase
          .from('repair_notes')
          .insert(notesToInsert)
        if (insertNotesError) throw insertNotesError
      }
    }

    if (Array.isArray(images)) {
      const { error: deleteImagesError } = await ctx.supabase
        .from('repair_images')
        .delete()
        .eq('repair_id', id)
      if (deleteImagesError) throw deleteImagesError

      const imagesToInsert = normalizeImages(images, id)
      if (imagesToInsert.length > 0) {
        const { error: insertImagesError } = await ctx.supabase
          .from('repair_images')
          .insert(imagesToInsert)
        if (insertImagesError) throw insertImagesError
      }
    }

    const { data: repair, error: fetchError } = await fetchRepairById(ctx, id)
    if (fetchError) throw fetchError
    if (!repair) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    return NextResponse.json({ repair })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request)
    if (isNextResponse(ctx)) return ctx

    const { id } = await context.params

    // Solo permitir eliminar en estados "recibido" o "cancelado"
    const { data: current } = await ctx.supabase
      .from('repairs')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .maybeSingle()

    if (!current) {
      return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })
    }

    if (current.status !== 'recibido' && current.status !== 'cancelado') {
      return NextResponse.json(
        { error: `Solo se pueden eliminar reparaciones en estado "Recibido" o "Cancelado". Estado actual: "${current.status}".` },
        { status: 422 }
      )
    }

    const { data, error } = await ctx.supabase
      .from('repairs')
      .delete()
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

