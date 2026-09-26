import { NextRequest, NextResponse } from 'next/server'
import {
  assertRepairExists,
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'
import { repairPhotoLimit } from '@/lib/saas/plan-features'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx

    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as {
      urls?: unknown
      imageType?: unknown
      images?: unknown
    }

    type RawImagePayload = { url: string; description?: string; imageType?: string }
    const rawImages = Array.isArray(body.images)
      ? (body.images as unknown[]).filter((img): img is RawImagePayload => {
          const item = img as RawImagePayload | null
          return typeof item?.url === 'string' && item.url.length > 0
        })
      : []
    const urls = Array.isArray(body.urls)
      ? body.urls.filter((url): url is string => typeof url === 'string' && url.length > 0)
      : []
    const imageType = typeof body.imageType === 'string' && body.imageType.trim()
      ? body.imageType.trim()
      : 'general'

    if (urls.length === 0 && rawImages.length === 0) {
      return NextResponse.json({ error: 'No hay imagenes para agregar.' }, { status: 400 })
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

    const rowsToInsert = rawImages.length > 0
      ? rawImages.map((img) => ({
          repair_id: id,
          image_url: img.url,
          image_type: img.imageType || imageType,
          description: img.description || null,
          uploaded_by: ctx.userId || null,
        }))
      : urls.map((url) => ({
          repair_id: id,
          image_url: url,
          image_type: imageType,
          description: null,
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
    const body = await request.json().catch(() => ({})) as { imageId?: string; url?: string }

    if (!body.imageId && !body.url) {
      return NextResponse.json({ error: 'Falta imageId o url para eliminar la imagen.' }, { status: 400 })
    }

    const exists = await assertRepairExists(ctx, id)
    if (!exists) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    let query = ctx.supabase.from('repair_images').delete().eq('repair_id', id)
    if (body.imageId) {
      query = query.eq('id', body.imageId)
    } else if (body.url) {
      query = query.eq('image_url', body.url)
    }

    const { error } = await query
    if (error) throw error

    const { data: repair, error: fetchError } = await fetchRepairById(ctx, id)
    if (fetchError) throw fetchError

    return NextResponse.json({ success: true, repair })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
