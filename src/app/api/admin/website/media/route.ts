import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolveWebsiteAdminOrganizationId } from '@/lib/website/admin-organization'
import {
  MAX_WEBSITE_MEDIA_COUNT,
  getWebsiteMediaLibrary,
  addWebsiteMediaItem,
  deleteWebsiteMediaItem,
  type WebsiteMediaSection,
} from '@/lib/website/website-media'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

/**
 * GET /api/admin/website/media
 * Obtiene el historial de imágenes y el uso de cuota de la organización.
 */
async function getHandler(request: NextRequest, context: AdminAuthContext) {
  const organizationId = await resolveWebsiteAdminOrganizationId(context)
  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'No se encontró una organización activa' }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const items = await getWebsiteMediaLibrary(organizationId, admin)

  return NextResponse.json({
    success: true,
    items,
    count: items.length,
    limit: MAX_WEBSITE_MEDIA_COUNT,
  })
}

/**
 * POST /api/admin/website/media
 * Sube una nueva imagen a la biblioteca de medios con límite estricto de 20 imágenes.
 */
async function postHandler(request: NextRequest, context: AdminAuthContext) {
  const organizationId = await resolveWebsiteAdminOrganizationId(context)
  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'No se encontró una organización activa' }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const currentItems = await getWebsiteMediaLibrary(organizationId, admin)

  // Validación previa de cuota
  if (currentItems.length >= MAX_WEBSITE_MEDIA_COUNT) {
    return NextResponse.json(
      {
        success: false,
        error: `Alcanzaste el límite de ${MAX_WEBSITE_MEDIA_COUNT} imágenes para tu sitio web. Eliminá imágenes desde el Historial para liberar espacio.`,
        count: currentItems.length,
        limit: MAX_WEBSITE_MEDIA_COUNT,
      },
      { status: 400 }
    )
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  const section = (formData?.get('section') as WebsiteMediaSection) || 'general'
  const customName = (formData?.get('name') as string) || file?.name || 'imagen'

  if (!file) {
    return NextResponse.json({ success: false, error: 'Seleccioná un archivo de imagen válido' }, { status: 400 })
  }

  const extension = EXTENSIONS[file.type]
  if (!extension) {
    return NextResponse.json(
      { success: false, error: 'Formato no soportado. Usá JPG, PNG, WebP, AVIF o SVG' },
      { status: 400 }
    )
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { success: false, error: 'El archivo excede el tamaño máximo permitido de 5 MB' },
      { status: 400 }
    )
  }

  const subfolder = section === 'logo' ? 'logos' : section === 'promotions' ? 'promotions' : section === 'brands' ? 'brands' : 'media'
  const storagePath = `website/${subfolder}/${organizationId}/${randomUUID()}.${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('product-images')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json(
      { success: false, error: `No se pudo subir la imagen: ${uploadError.message}` },
      { status: 500 }
    )
  }

  const { data: { publicUrl } } = admin.storage.from('product-images').getPublicUrl(storagePath)
  const fullUrl = `${publicUrl}?v=${Date.now()}`

  const addResult = await addWebsiteMediaItem(
    organizationId,
    {
      url: fullUrl,
      path: storagePath,
      name: customName,
      size: file.size,
      section,
    },
    admin
  )

  if (!addResult.success) {
    // Si falló agregar a la biblioteca, eliminamos el archivo subido para no dejar huérfanos
    await admin.storage.from('product-images').remove([storagePath])
    return NextResponse.json({ success: false, error: addResult.error }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    item: addResult.item,
    count: addResult.count,
    limit: MAX_WEBSITE_MEDIA_COUNT,
  })
}

/**
 * DELETE /api/admin/website/media
 * Elimina definitivamente una imagen del almacenamiento físico y del historial para liberar cupo.
 */
async function deleteHandler(request: NextRequest, context: AdminAuthContext) {
  const organizationId = await resolveWebsiteAdminOrganizationId(context)
  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'No se encontró una organización activa' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : undefined
  const path = typeof body?.path === 'string' ? body.path : undefined
  const url = typeof body?.url === 'string' ? body.url : undefined

  if (!id && !path && !url) {
    return NextResponse.json({ success: false, error: 'Identificador de imagen requerido' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const deleteResult = await deleteWebsiteMediaItem(organizationId, { id, path, url }, admin)

  if (!deleteResult.success) {
    return NextResponse.json({ success: false, error: deleteResult.error }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    count: deleteResult.count,
    limit: MAX_WEBSITE_MEDIA_COUNT,
  })
}

export const GET = withAdminAuth(getHandler)
export const POST = withAdminAuth(postHandler)
export const DELETE = withAdminAuth(deleteHandler)
