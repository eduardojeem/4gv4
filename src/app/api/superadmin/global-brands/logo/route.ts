import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { brandSlug } from '@/lib/brands/global-catalog'
import { logger } from '@/lib/logger'

/**
 * Subida del logo oficial de una marca del catálogo.
 *
 * Antes solo se podía pegar una dirección, y quedaba colgando de un servidor
 * ajeno: si esa imagen cambiaba o desaparecía, cambiaba o desaparecía el logo
 * de la marca en todo el marketplace. Acá el archivo queda en el
 * almacenamiento de la plataforma.
 */

const BUCKET = 'product-images'
const FOLDER = 'branding/global-brands'
const MAX_SIZE = 2 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

export async function POST(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const formData = await request.formData().catch(() => null)
    const file = formData?.get('file') as File | null
    const name = String(formData?.get('name') || 'marca')

    if (!file) {
      return NextResponse.json({ success: false, error: 'Elegí un archivo de imagen.' }, { status: 400 })
    }

    const extension = EXTENSIONS[file.type]
    if (!extension) {
      return NextResponse.json({ success: false, error: 'Formato no soportado. Usá PNG, JPG, WebP, AVIF o SVG.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'El logo no puede superar 2 MB.' }, { status: 400 })
    }

    const slug = brandSlug(name) || 'marca'
    const path = `${FOLDER}/${slug}-${randomUUID()}.${extension}`

    const admin = createAdminSupabase()
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })

    if (error) throw error

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path)

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'create',
      resource: 'global_brands',
      newValues: { logo: path },
      request,
    })

    return NextResponse.json({ success: true, url: data.publicUrl, path })
  } catch (error) {
    logger.error('[superadmin/global-brands/logo] POST', { error })
    return NextResponse.json({ success: false, error: 'No se pudo subir el logo.' }, { status: 500 })
  }
}
