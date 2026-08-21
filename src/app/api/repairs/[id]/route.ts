import { NextRequest, NextResponse } from 'next/server'
import { resolveWarrantyExpiration } from '@/lib/warranty-utils'
import { parseRepairPartsInput } from '@/lib/repairs/create-repair-input'
import {
  RepairPartsStockError,
  deleteRepairWithInventory,
  replaceRepairPartsWithInventory,
} from '@/lib/repairs/replace-parts'
import { RepairPricingWriteError, resolveRepairPricingWrite } from '@/lib/repairs/pricing-write'
import type { RepairPricingMode } from '@/lib/repairs/pricing'
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
  internalCost?: unknown
  quantity?: unknown
  supplier?: unknown
  partNumber?: unknown
  productId?: unknown
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
  pricingMode: 'pricing_mode',
  discountAmount: 'discount_amount',
  priceOverrideReason: 'price_override_reason',
  warrantyMonths: 'warranty_months',
  warrantyType: 'warranty_type',
  warrantyNotes: 'warranty_notes',
}

function buildRepairUpdate(
  payload: Record<string, unknown>,
  anchors: { deliveredAt?: string | null; completedAt?: string | null } = {}
) {
  const updateData: Record<string, unknown> = {}

  for (const [uiField, dbField] of Object.entries(REPAIR_FIELD_MAP)) {
    if (payload[uiField] !== undefined) {
      updateData[dbField] = payload[uiField]
    }
  }

  if (payload.warrantyMonths !== undefined) {
    // La garantia corre desde que el cliente recibe el equipo. Si todavia no se
    // entrego ni finalizo, queda en null: la fecha definitiva se fija al
    // entregar (ver /api/repairs/[id]/delivery).
    updateData.warranty_expires_at = resolveWarrantyExpiration(
      Number(payload.warrantyMonths || 0),
      anchors
    )
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updated_at = new Date().toISOString()
  }

  return updateData
}

function normalizeParts(parts: RepairPartInput[]) {
  return parts.map((part) => ({
    part_name: String(part.name || '').trim(),
    unit_price: Number(part.cost || 0),
    unit_cost: part.internalCost === undefined ? undefined : Number(part.internalCost),
    quantity: Number(part.quantity || 1),
    supplier: typeof part.supplier === 'string' && part.supplier.trim() ? part.supplier.trim() : null,
    part_number: typeof part.partNumber === 'string' && part.partNumber.trim() ? part.partNumber.trim() : null,
    product_id: typeof part.productId === 'string' && part.productId.trim() ? part.productId.trim() : null,
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
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx

    const { id } = await context.params

    // Verificar que la reparación no está en estado terminal
    const { data: current, error: currentError } = await ctx.supabase
      .from('repairs')
      .select('id, status, delivered_at, completed_at, labor_cost, final_cost, estimated_cost, paid_amount, pricing_mode, discount_amount, price_override_reason')
      .eq('id', id)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .maybeSingle()

    if (currentError) throw currentError

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
    const parsedParts = Array.isArray(parts)
      ? parseRepairPartsInput(normalizeParts(parts as RepairPartInput[]))
      : null

    if (parsedParts && !parsedParts.success) {
      return NextResponse.json(
        { error: 'Revisa los repuestos, precios y cantidades antes de guardar.' },
        { status: 400 }
      )
    }


    const existingPartsResult = parsedParts?.success
      ? null
      : await ctx.supabase
          .from('repair_parts')
          .select('unit_price, unit_cost, quantity')
          .eq('repair_id', id)
    if (existingPartsResult?.error) throw existingPartsResult.error
    let pricingParts = parsedParts?.success ? parsedParts.data : (existingPartsResult?.data ?? [])
    if (parsedParts?.success) {
      const productIds = [...new Set(parsedParts.data.flatMap((part) => part.product_id ? [part.product_id] : []))]
      if (productIds.length > 0) {
        const { data: products, error: productsError } = await ctx.supabase
          .from('products')
          .select('id, purchase_price')
          .eq('organization_id', ctx.organizationId)
          .in('id', productIds)
        if (productsError) throw productsError
        const purchaseCosts = new Map((products ?? []).map((product) => [product.id, Number(product.purchase_price) || 0]))
        if (productIds.some((productId) => !purchaseCosts.has(productId))) {
          return NextResponse.json({ error: 'Uno de los repuestos no pertenece a la organizacion.' }, { status: 400 })
        }
        pricingParts = parsedParts.data.map((part) => ({
          ...part,
          unit_cost: part.product_id ? purchaseCosts.get(part.product_id) ?? 0 : part.unit_cost,
        }))
      }
    }
    const { data: organizationSettings } = await ctx.supabase
      .from('organization_settings')
      .select('currency')
      .eq('organization_id', ctx.organizationId)
      .maybeSingle()

    const requestedMode = (repairPayload.pricingMode ?? current.pricing_mode ?? 'automatic') as RepairPricingMode
    const resolvedPricing = resolveRepairPricingWrite({
      mode: requestedMode,
      currency: organizationSettings?.currency || 'PYG',
      estimatedCost: Number(repairPayload.estimatedCost ?? current.estimated_cost ?? 0),
      laborCost: Number(repairPayload.laborCost ?? current.labor_cost ?? 0),
      finalCost: repairPayload.finalCost === undefined
        ? (current.final_cost === null ? null : Number(current.final_cost))
        : (repairPayload.finalCost === null ? null : Number(repairPayload.finalCost)),
      discountAmount: Number(repairPayload.discountAmount ?? current.discount_amount ?? 0),
      paidAmount: Number(current.paid_amount ?? 0),
      parts: pricingParts,
      role: ctx.organizationRole,
      overrideReason: String(repairPayload.priceOverrideReason ?? current.price_override_reason ?? ''),
    })

    const updateData = buildRepairUpdate(repairPayload, {
      deliveredAt: current.delivered_at as string | null,
      completedAt: current.completed_at as string | null,
    })
    updateData.estimated_cost = resolvedPricing.estimatedCost
    updateData.labor_cost = resolvedPricing.laborCost
    updateData.final_cost = resolvedPricing.finalCost
    updateData.pricing_mode = resolvedPricing.pricingMode
    updateData.discount_amount = resolvedPricing.discountAmount
    updateData.price_override_reason = resolvedPricing.overrideReason
    updateData.pricing_updated_by = ctx.userId
    updateData.pricing_updated_at = new Date().toISOString()
    updateData.updated_at = new Date().toISOString()

    if (Array.isArray(parts)) {
      delete updateData.estimated_cost
      delete updateData.labor_cost
      delete updateData.final_cost
      delete updateData.pricing_mode
      delete updateData.discount_amount
      delete updateData.price_override_reason
      delete updateData.pricing_updated_by
      delete updateData.pricing_updated_at
    }

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

    // Keep inventory last so a notes/images failure cannot leave stock and
    // repair parts changed while the request reports an error.
    if (Array.isArray(parts)) {
      await replaceRepairPartsWithInventory({
        supabase: ctx.supabase,
        repairId: id,
        organizationId: ctx.organizationId,
        branchId: ctx.branchId,
        actorId: ctx.userId,
        parts: parsedParts?.success ? parsedParts.data : [],
        pricing: {
          laborCost: resolvedPricing.laborCost,
          finalCost: resolvedPricing.finalCost,
          estimatedCost: resolvedPricing.estimatedCost,
          mode: resolvedPricing.pricingMode,
          discountAmount: resolvedPricing.discountAmount,
          overrideReason: resolvedPricing.overrideReason,
          updatedBy: ctx.userId,
        },
      })
    }

    const { data: repair, error: fetchError } = await fetchRepairById(ctx, id)
    if (fetchError) throw fetchError
    if (!repair) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    return NextResponse.json({ repair })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json(
      {
        error: message,
        code: error instanceof RepairPartsStockError
          ? 'REPAIR_STOCK_CHANGED'
          : error instanceof RepairPricingWriteError
            ? error.code
            : undefined,
      },
      {
        status: error instanceof RepairPartsStockError
          ? 409
          : error instanceof RepairPricingWriteError
            ? error.status
            : 500,
      }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
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

    const deleted = await deleteRepairWithInventory({
      supabase: ctx.supabase,
      repairId: id,
      organizationId: ctx.organizationId,
      branchId: ctx.branchId,
      actorId: ctx.userId,
    })
    if (!deleted) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
