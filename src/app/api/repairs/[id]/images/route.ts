import { NextRequest, NextResponse } from 'next/server'
import {
  assertRepairExists,
  fetchRepairById,
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.update')
    if (isNextResponse(ctx)) return ctx

    const { id } = await context.params
    const body = await request.json().catch(() => ({})) as {
      urls?: unknown
      imageType?: unknown
    }

    const urls = Array.isArray(body.urls)
      ? body.urls.filter((url): url is string => typeof url === 'string' && url.length > 0)
      : []
    const imageType = typeof body.imageType === 'string' && body.imageType.trim()
      ? body.imageType.trim()
      : 'general'

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No hay imagenes para agregar.' }, { status: 400 })
    }

    const exists = await assertRepairExists(ctx, id)
    if (!exists) return NextResponse.json({ error: 'Reparacion no encontrada.' }, { status: 404 })

    const { error } = await ctx.supabase
      .from('repair_images')
      .insert(urls.map((url) => ({
        repair_id: id,
        image_url: url,
        image_type: imageType,
      })))

    if (error) throw error

    const { data: repair, error: fetchError } = await fetchRepairById(ctx, id)
    if (fetchError) throw fetchError

    return NextResponse.json({ repair })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
