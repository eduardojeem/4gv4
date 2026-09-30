import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { linkToExisting, listUsage, unlink, type CatalogKind } from '@/lib/catalog/manual-link'

/**
 * Acciones de vínculo manual que comparten las rutas de categorías y marcas
 * globales. Devuelve `null` si el pedido no es una de estas acciones.
 */

const linkSchema = z.object({
  targetId: z.string().uuid('Elegí a qué vincularla.'),
  ids: z.array(z.string().uuid()).min(1, 'No hay fichas para vincular.').max(500),
  alias: z.string().trim().max(120).nullable().optional(),
})

const unlinkSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) })

const resource = (kind: CatalogKind) => (kind === 'brand' ? 'brands' : 'categories')

export async function handleManualLinkAction(
  kind: CatalogKind,
  body: Record<string, unknown> | null,
  user: { id: string; email: string | null },
  request: NextRequest,
): Promise<NextResponse | null> {
  if (body?.action === 'link-to') {
    const validation = linkSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
    }
    const result = await linkToExisting(createAdminSupabase(), kind, validation.data)
    if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'update',
      resource: resource(kind),
      resourceId: validation.data.targetId,
      newValues: { action: 'link-to', linked: result.linked, alias: result.aliasAdded ? validation.data.alias : null },
      request,
    })
    return NextResponse.json({ success: true, ...result })
  }

  if (body?.action === 'unlink') {
    const validation = unlinkSchema.safeParse(body)
    if (!validation.success) return NextResponse.json({ success: false, error: 'No hay fichas para desvincular.' }, { status: 400 })
    const result = await unlink(createAdminSupabase(), kind, validation.data.ids)
    if (typeof result !== 'number') return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'update',
      resource: resource(kind),
      newValues: { action: 'unlink', count: result },
      request,
    })
    return NextResponse.json({ success: true, unlinked: result })
  }

  return null
}

/** GET ?usage=<id>: qué fichas de empresas usan una global. */
export async function handleUsageRequest(kind: CatalogKind, request: NextRequest): Promise<NextResponse | null> {
  const usage = new URL(request.url).searchParams.get('usage')
  if (!usage) return null
  if (!z.string().uuid().safeParse(usage).success) return NextResponse.json({ success: false, error: 'Pedido inválido.' }, { status: 400 })
  const rows = await listUsage(createAdminSupabase(), kind, usage)
  return NextResponse.json({ success: true, data: rows })
}
