import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolveWebsiteAdminOrganizationId } from '@/lib/website/admin-organization'
import { isOrganizationPromotionPath } from '@/lib/website/promotional-carousel-storage'

const MAX_SIZE = 5 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

async function handler(request: NextRequest, context: AdminAuthContext) {
  const organizationId = await resolveWebsiteAdminOrganizationId(context)
  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'No se encontró una organización activa' }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  const slideId = String(formData?.get('slideId') || '')
  const extension = file ? EXTENSIONS[file.type] : undefined

  if (!file || !slideId) {
    return NextResponse.json({ success: false, error: 'Seleccioná una imagen válida' }, { status: 400 })
  }
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(slideId)) {
    return NextResponse.json({ success: false, error: 'Identificador de diapositiva inválido' }, { status: 400 })
  }
  if (!extension) {
    return NextResponse.json({ success: false, error: 'Usá una imagen JPG, PNG, WebP o AVIF' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: 'La imagen no puede superar 5 MB' }, { status: 400 })
  }

  const storagePath = `website/promotions/${organizationId}/${slideId}-${randomUUID()}.${extension}`
  const admin = createAdminSupabase()
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await admin.storage
    .from('product-images')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (error) {
    return NextResponse.json({ success: false, error: `No se pudo subir la imagen: ${error.message}` }, { status: 500 })
  }

  const { data: { publicUrl } } = admin.storage.from('product-images').getPublicUrl(storagePath)
  return NextResponse.json({
    success: true,
    url: `${publicUrl}?v=${Date.now()}`,
    path: storagePath,
  })
}

export const POST = withAdminAuth(handler)

async function deleteHandler(request: NextRequest, context: AdminAuthContext) {
  const organizationId = await resolveWebsiteAdminOrganizationId(context)
  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'No se encontró una organización activa' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const path = typeof body?.path === 'string' ? body.path : ''
  if (!isOrganizationPromotionPath(path, organizationId)) {
    return NextResponse.json({ success: false, error: 'La imagen no pertenece a esta organización' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { error } = await admin.storage.from('product-images').remove([path])
  if (error) {
    return NextResponse.json({ success: false, error: `No se pudo eliminar la imagen: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export const DELETE = withAdminAuth(deleteHandler)
