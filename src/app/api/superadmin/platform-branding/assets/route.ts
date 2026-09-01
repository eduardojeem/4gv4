import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { getPlatformBranding } from '@/lib/platform/branding'

const BUCKET = 'product-images'
const FOLDER = 'branding/platform'

/** El tipo va como prefijo del nombre al subir: `logo_light-<uuid>.png`. */
function assetTypeFromName(name: string): 'logo_light' | 'logo_dark' | 'favicon' | 'other' {
  if (name.startsWith('logo_light-')) return 'logo_light'
  if (name.startsWith('logo_dark-')) return 'logo_dark'
  if (name.startsWith('favicon-')) return 'favicon'
  return 'other'
}

/**
 * Historial de assets de marca.
 *
 * Hasta ahora cada subida dejaba el archivo anterior huerfano en el bucket para
 * siempre: no habia forma de listarlos ni de borrarlos, asi que el storage
 * crecia sin limite y sin visibilidad. El listado se arma leyendo el storage
 * directamente, que es la unica fuente de verdad de lo que existe.
 */
export async function GET() {
  const me = await getSuperAdminUser()
  if (!me) {
    return NextResponse.json({ success: false, error: 'Acceso denegado.' }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin.storage.from(BUCKET).list(FOLDER, {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const branding = await getPlatformBranding()
  // Se compara sin querystring: la url guardada arrastra un `?v=<timestamp>`.
  const inUse = new Set(
    [branding.logoUrl, branding.logoDarkUrl, branding.faviconUrl]
      .filter(Boolean)
      .map((url) => (url as string).split('?')[0]),
  )

  const assets = (data ?? [])
    .filter((entry) => entry.name && !entry.name.startsWith('.'))
    .map((entry) => {
      const path = `${FOLDER}/${entry.name}`
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
      return {
        name: entry.name,
        path,
        url: pub.publicUrl,
        assetType: assetTypeFromName(entry.name),
        sizeBytes: (entry.metadata as { size?: number } | null)?.size ?? null,
        createdAt: entry.created_at ?? null,
        inUse: inUse.has(pub.publicUrl),
      }
    })

  return NextResponse.json({ success: true, assets })
}

export async function DELETE(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) {
    return NextResponse.json({ success: false, error: 'Acceso denegado.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { path?: string } | null
  const path = body?.path

  // Se acota a la carpeta de marca: sin esto, un path arbitrario permitiria
  // borrar imagenes de productos de cualquier organizacion desde este endpoint.
  if (!path || !path.startsWith(`${FOLDER}/`) || path.includes('..')) {
    return NextResponse.json({ success: false, error: 'Ruta de asset inválida.' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)
  const branding = await getPlatformBranding()
  const inUse = [branding.logoUrl, branding.logoDarkUrl, branding.faviconUrl]
    .filter(Boolean)
    .some((url) => (url as string).split('?')[0] === pub.publicUrl)

  // Borrar el asset en uso dejaria la plataforma sin logo y con un 404 servido
  // en cada pagina: primero hay que asignar otro.
  if (inUse) {
    return NextResponse.json(
      { success: false, error: 'Este asset está en uso. Asigná otro antes de eliminarlo.' },
      { status: 409 },
    )
  }

  const { error } = await admin.storage.from(BUCKET).remove([path])
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  await logSuperAdminAction({
    actorId: me.id,
    actorEmail: me.email,
    action: 'delete_platform_asset',
    resource: 'system_settings',
    resourceId: 'system',
    oldValues: { path },
    request,
  })

  return NextResponse.json({ success: true })
}
