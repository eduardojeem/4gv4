import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  try {
    const me = await getSuperAdminUser()
    if (!me) {
      return NextResponse.json({ success: false, error: 'Acceso denegado. Se requiere rol Super Administrador.' }, { status: 403 })
    }

    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ success: false, error: 'Datos de formulario inválidos' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    const assetType = (formData.get('assetType') as string) || 'logo_light'

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'No se recibió ningún archivo de imagen' }, { status: 400 })
    }

    const extension = EXTENSIONS[file.type] || (file.name.endsWith('.svg') ? 'svg' : file.name.endsWith('.ico') ? 'ico' : null)
    if (!extension) {
      return NextResponse.json(
        { success: false, error: 'Formato no permitido. Utiliza PNG, JPG, WebP, SVG o ICO.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'El archivo excede el tamaño máximo permitido de 5 MB.' },
        { status: 400 }
      )
    }

    const admin = createAdminSupabase()
    const sanitizedType = ['logo_light', 'logo_dark', 'favicon'].includes(assetType) ? assetType : 'logo_light'
    const storagePath = `branding/platform/${sanitizedType}-${randomUUID()}.${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await admin.storage
      .from('product-images')
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/png',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: `Error al subir a almacenamiento: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const { data: { publicUrl } } = admin.storage
      .from('product-images')
      .getPublicUrl(storagePath)

    const finalUrl = `${publicUrl}?v=${Date.now()}`

    await logSuperAdminAction({
      actorId: me.id,
      actorEmail: me.email,
      action: 'upload_platform_asset',
      resource: 'system_settings',
      resourceId: 'system',
      newValues: { assetType: sanitizedType, url: finalUrl, path: storagePath },
      request,
    })

    return NextResponse.json({
      success: true,
      url: finalUrl,
      path: storagePath,
      assetType: sanitizedType,
    })
  } catch (err) {
    console.error('Error uploading platform brand logo:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno al procesar imagen' },
      { status: 500 }
    )
  }
}
