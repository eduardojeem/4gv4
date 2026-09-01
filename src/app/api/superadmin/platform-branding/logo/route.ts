import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  ico: 'image/x-icon',
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

/**
 * Firma real del archivo (magic bytes).
 *
 * El `file.type` lo declara el cliente y se puede falsear, asi que no alcanza
 * para decidir que se guarda. Se dejo de aceptar SVG: puede contener <script> y
 * estos archivos se sirven publicos, con lo que era un vector de XSS almacenado.
 */
function detectImageExtension(buffer: Buffer): string | null {
  const startsWith = (...bytes: number[]) => bytes.every((b, i) => buffer[i] === b)

  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return 'png'
  if (startsWith(0xff, 0xd8, 0xff)) return 'jpg'
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return 'gif'
  if (startsWith(0x00, 0x00, 0x01, 0x00)) return 'ico'
  if (startsWith(0x52, 0x49, 0x46, 0x46) && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
  // AVIF/HEIF: caja 'ftyp' con marca 'avif' en el encabezado.
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp' && buffer.subarray(8, 12).toString('ascii').startsWith('avi')) return 'avif'

  return null
}

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

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'El archivo excede el tamaño máximo permitido de 5 MB.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // La extension sale del contenido, no del nombre ni del tipo declarado.
    const extension = detectImageExtension(buffer)
    if (!extension) {
      return NextResponse.json(
        { success: false, error: 'Formato no permitido. Utiliza PNG, JPG, WebP, GIF, AVIF o ICO.' },
        { status: 400 }
      )
    }

    const admin = createAdminSupabase()
    const sanitizedType = ['logo_light', 'logo_dark', 'favicon'].includes(assetType) ? assetType : 'logo_light'
    const storagePath = `branding/platform/${sanitizedType}-${randomUUID()}.${extension}`

    const { error: uploadError } = await admin.storage
      .from('product-images')
      .upload(storagePath, buffer, {
        // Derivado de la firma real: si se guardara el tipo declarado, un PNG
        // subido como `image/svg+xml` se serviria como SVG y volveria a abrir
        // el vector de XSS que se acaba de cerrar.
        contentType: CONTENT_TYPES[extension],
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
