import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import {
  normalizeTenantSlug,
  suggestTenantSlug,
  validateTenantSlug,
  type TenantSlugProblem,
} from '@/lib/saas/reserved-slugs'

/**
 * Disponibilidad del subdominio de una tienda, para consultarla mientras se
 * escribe el nombre de la empresa.
 *
 * Antes la colision solo se detectaba al enviar el formulario completo, y como
 * el captcha se reinicia en cada intento fallido, descubrir que el subdominio
 * estaba tomado obligaba a resolverlo de nuevo.
 *
 * Es publico a proposito: los slugs de las tiendas ya se ven en el directorio
 * del marketplace y en las URLs, asi que no expone nada nuevo. Igual se limita
 * por IP para que no sirva de sonda masiva.
 */

export type CheckSlugResponse = {
  slug: string
  available: boolean
  reason?: TenantSlugProblem | 'taken'
  message?: string
  suggestion?: string | null
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request)
  const allowed = await rateLimiter.check(`check-slug:${clientIp}`, 40, 60 * 1000)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Esperá unos segundos.' },
      { status: 429 }
    )
  }

  const crudo = request.nextUrl.searchParams.get('slug') ?? ''
  // Se normaliza igual que en el registro para que lo que se consulta sea
  // exactamente lo que se guardaria.
  const slug = normalizeTenantSlug(crudo)

  const formato = validateTenantSlug(slug)
  if (formato.ok === false) {
    const { reason, message } = formato
    return NextResponse.json<CheckSlugResponse>({
      slug,
      available: false,
      reason,
      message,
      // Un slug reservado si tiene alternativa; uno vacio o muy corto, no.
      suggestion: reason === 'reserved' ? `${slug}-tienda` : null,
    })
  }

  const admin = createAdminSupabase()

  // Se traen las variantes de una sola vez: la exacta y las numeradas, para
  // poder sugerir una libre sin encadenar consultas.
  const candidatos = [slug, ...Array.from({ length: 12 }, (_, i) => `${slug}-${i + 2}`)]
  const { data, error } = await admin
    .from('organizations')
    .select('slug')
    .in('slug', candidatos)

  if (error) {
    // Un fallo de la consulta no puede afirmar que esta libre: eso llevaria al
    // usuario a completar el formulario para chocar igual al final.
    return NextResponse.json(
      { error: 'No se pudo verificar la dirección.' },
      { status: 503 }
    )
  }

  const tomados = new Set((data ?? []).map((row) => String(row.slug)))

  if (!tomados.has(slug)) {
    return NextResponse.json<CheckSlugResponse>({ slug, available: true })
  }

  return NextResponse.json<CheckSlugResponse>({
    slug,
    available: false,
    reason: 'taken',
    message: 'Esa dirección ya está en uso.',
    suggestion: suggestTenantSlug(slug, (candidato) => tomados.has(candidato)),
  })
}
