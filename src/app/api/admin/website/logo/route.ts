import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolveWebsiteAdminOrganizationId } from '@/lib/website/admin-organization'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

async function handler(request: NextRequest, context: AdminAuthContext) {
  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Datos de formulario inválidos' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
  }
  const extension = EXTENSIONS[file.type]
  if (!extension) {
    return NextResponse.json(
      { error: 'Tipo de archivo no permitido. Use JPG, PNG o WebP.' },
      { status: 400 }
    )
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo excede el límite de 2 MB.' }, { status: 400 })
  }

  const admin = createAdminSupabase()

  const organizationId = await resolveWebsiteAdminOrganizationId(context)

  if (!organizationId) {
    return NextResponse.json({ error: 'No se encontró organización activa' }, { status: 403 })
  }

  const storagePath = `website/logos/${organizationId}/${randomUUID()}.${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('product-images')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json(
      { error: `Error al subir imagen: ${uploadError.message}` },
      { status: 500 }
    )
  }

  const { data: { publicUrl } } = admin.storage.from('product-images').getPublicUrl(storagePath)

  return NextResponse.json({ success: true, url: `${publicUrl}?v=${Date.now()}`, path: storagePath })
}

export const POST = withAdminAuth(handler)
