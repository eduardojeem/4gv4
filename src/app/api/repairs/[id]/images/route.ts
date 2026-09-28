import { NextRequest, NextResponse } from 'next/server'
import {
  assertRepairExists,
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'
import { repairPhotoLimit } from '@/lib/saas/plan-features'
import {
  REPAIR_IMAGE_BUCKET,
  isOwnedRepairImagePath,
  repairImagePath,
} from '@/lib/repairs/repair-image-storage'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx

    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as {
      imageType?: unknown
      images?: unknown
    }

    type RawImagePayload = { storagePath?: unknown; description?: unknown; imageType?: unknown }
    const rawImages = Array.isArray(body.images) ? body.images as RawImagePayload[] : []
    const imageType = typeof body.imageType === 'string' && body.imageType.trim()
      ? body.imageType.trim()
      : 'general'

    if (rawImages.length === 0) {
      return NextResponse.json({ error: 'No hay imagenes para agregar.' }, { status: 400 })
    }

    const normalizedImages = rawImages.map((image) => ({
      storagePath: typeof image?.storagePath === 'string'
        ? repairImagePath(image.storagePath)
        : null,
      description: typeof image?.description === 'string' && image.description.trim()
        ? image.description.trim()
        : null,
      imageType: typeof image?.imageType === 'string' && image.imageType.trim()
        ? image.imageType.trim()
        : imageType,
    }))

    if (normalizedImages.some((image) => (
      !image.storagePath || !isOwnedRepairImagePath(
        image.storagePath,
        ctx.organizationId,
        ctx.userId,
      )
    ))) {
      return NextResponse.json(
        { error: 'Una o más imágenes no pertenecen a esta reparación.' },
        { status: 400 },
      )
    }

    const exists = await assertRepairExists(ctx, id)
    if (!exists) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    const orgId = ctx.organizationId
    if (orgId) {
      const { data: org } = await ctx.supabase
        .from('organizations')
        .select('subscription_plan')
        .eq('id', orgId)
        .maybeSingle()

      const userPlan = (org?.subscription_plan || 'free').toUpperCase() as import('@/lib/saas/plan-features').PlanCode
      const photoLimit = repairPhotoLimit(userPlan)
      if (photoLimit === 0) {
        return NextResponse.json(
          { error: 'La opción de agregar fotos a las reparaciones está disponible exclusivamente en el Plan Enterprise.' },
          { status: 402 }
        )
      }
    }

    const rowsToInsert = normalizedImages.map((image) => ({
      repair_id: id,
      image_url: image.storagePath as string,
      image_type: image.imageType,
      description: image.description,
      uploaded_by: ctx.userId || null,
    }))

    const { error } = await ctx.supabase
      .from('repair_images')
      .insert(rowsToInsert)

    if (error) throw error

    const { data: repair, error: fetchError } = await fetchRepairById(ctx, id)
    if (fetchError) throw fetchError

    return NextResponse.json({ repair })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx

    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as { imageId?: unknown }

    if (typeof body.imageId !== 'string' || !body.imageId.trim()) {
      return NextResponse.json({ error: 'Falta imageId para eliminar la imagen.' }, { status: 400 })
    }

    const exists = await assertRepairExists(ctx, id)
    if (!exists) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    const { data: storedImage, error: lookupError } = await ctx.supabase
      .from('repair_images')
      .select('id, image_url')
      .eq('id', body.imageId)
      .eq('repair_id', id)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (!storedImage) {
      return NextResponse.json({ error: 'Imagen no encontrada.' }, { status: 404 })
    }

    const storagePath = repairImagePath(storedImage.image_url)
    if (!storagePath) {
      return NextResponse.json({ error: 'La referencia de la imagen no es válida.' }, { status: 409 })
    }

    const { error: storageError } = await ctx.supabase.storage
      .from(REPAIR_IMAGE_BUCKET)
      .remove([storagePath])
    if (storageError) throw storageError

    // Storage goes first so a transient object deletion failure leaves the row
    // available for a safe retry. Removing an already absent object is
    // idempotent if the following database delete must be retried.
    const { error } = await ctx.supabase
      .from('repair_images')
      .delete()
      .eq('repair_id', id)
      .eq('id', body.imageId)
    if (error) throw error

    const { data: repair, error: fetchError } = await fetchRepairById(ctx, id)
    if (fetchError) throw fetchError

    return NextResponse.json({ success: true, repair })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
