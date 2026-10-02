import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolveWebsiteAdminOrganizationId } from '@/lib/website/admin-organization'
import { optimizeServerImage } from '@/lib/images/server-upload-optimizer'
import { PUBLIC_IMAGE_CACHE_CONTROL } from '@/lib/images/upload-profiles'

const MAX_SIZE = 5 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

async function handler(request: NextRequest, context: AdminAuthContext) {
  const organizationId = await resolveWebsiteAdminOrganizationId(context)
  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'No se encontró una organización activa' }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  const brandId = String(formData?.get('brandId') || 'brand').replace(/[^a-zA-Z0-9_-]/g, '')
  const extension = file ? EXTENSIONS[file.type] : undefined

  if (!file) {
    return NextResponse.json({ success: false, error: 'Seleccioná un archivo de imagen o logo válido' }, { status: 400 })
  }
  if (!extension) {
    return NextResponse.json({ success: false, error: 'Formato no soportado. Usá PNG, JPG, SVG o WebP' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: 'El logo no puede superar 5 MB' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  // Verificar cuota de 20 imágenes
  const { getWebsiteMediaLibrary, addWebsiteMediaItem, MAX_WEBSITE_MEDIA_COUNT } = await import('@/lib/website/website-media')
  const currentItems = await getWebsiteMediaLibrary(organizationId, admin)
  if (currentItems.length >= MAX_WEBSITE_MEDIA_COUNT) {
    return NextResponse.json(
      { success: false, error: `Alcanzaste el límite de ${MAX_WEBSITE_MEDIA_COUNT} imágenes para tu sitio web. Eliminá imágenes desde el Historial para liberar espacio.` },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const optimized = await optimizeServerImage(buffer, file.type, file.name, 'logo')
  const storagePath = `website/brands/${organizationId}/${brandId}-${randomUUID()}.${optimized.extension}`
  const { error } = await admin.storage
    .from('product-images')
    .upload(storagePath, optimized.buffer, {
      contentType: optimized.mimeType,
      cacheControl: PUBLIC_IMAGE_CACHE_CONTROL,
      upsert: false,
    })

  if (error) {
    return NextResponse.json({ success: false, error: `No se pudo subir el logo: ${error.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('product-images').getPublicUrl(storagePath)
  const finalUrl = publicUrl

  await addWebsiteMediaItem(
    organizationId,
    {
      url: finalUrl,
      path: storagePath,
      name: `Logo marca ${brandId}`,
      size: optimized.buffer.byteLength,
      section: 'brands',
    },
    admin
  )

  return NextResponse.json({
    success: true,
    url: finalUrl,
    path: storagePath,
  })
}

export const POST = withAdminAuth(handler)
