import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { categorySlug, sortGlobalCategories, suggestCategoryLinks, type GlobalCategory } from '@/lib/categories/global-catalog'
import { logger } from '@/lib/logger'

/**
 * Taxonomía global de categorías: la administra solo la plataforma.
 *
 * Cada empresa tiene sus propias categorías y el marketplace las agrupa por la
 * global, para que «Celulares» de una tienda y «Telefonía» de otra caigan en el
 * mismo lugar. Sin esta pantalla, la taxonomía solo se podía tocar a mano en la
 * base: hay 116 categorías de empresas y ninguna vinculada.
 */

const COLUMNS = 'id, name, slug, description, parent_id, level, aliases, icon, sort_order, is_active'

const categorySchema = z.object({
  name: z.string({ message: 'Poné el nombre de la categoría.' }).trim().min(2, 'El nombre es muy corto.').max(120),
  slug: z.string().trim().max(140).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  aliases: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  icon: z.string().trim().max(60).optional().nullable(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
})

const updateSchema = categorySchema.partial().extend({ id: z.string().uuid() })

export async function GET() {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const admin = createAdminSupabase()
    const [{ data, error }, { data: tenantCategories }] = await Promise.all([
      admin.from('global_categories').select(COLUMNS),
      admin.from('categories').select('id, name, global_category_id, organization_id, organizations(name)'),
    ])

    if (error) throw error

    const linkedCount = new Map<string, number>()
    for (const row of (tenantCategories ?? []) as Array<{ global_category_id: string | null }>) {
      if (!row.global_category_id) continue
      linkedCount.set(row.global_category_id, (linkedCount.get(row.global_category_id) ?? 0) + 1)
    }

    const categories = sortGlobalCategories((data ?? []) as GlobalCategory[]).map((category) => ({
      ...category,
      linked_count: linkedCount.get(category.id) ?? 0,
    }))

    // Las categorías de empresas que se vincularían por nombre, una por una:
    // el trabajo pendiente se revisa antes de aplicarlo.
    const rows = (tenantCategories ?? []) as unknown as Array<{
      id: string
      name: string
      global_category_id?: string | null
      organizations?: { name?: string } | Array<{ name?: string }> | null
    }>
    const catalogById = new Map(((data ?? []) as GlobalCategory[]).map((category) => [category.id, category]))
    const suggestions = suggestCategoryLinks(rows, (data ?? []) as GlobalCategory[]).map((link) => {
      const row = rows.find((item) => item.id === link.id)!
      const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
      return {
        id: link.id,
        name: row.name,
        organizationName: organization?.name ?? null,
        targetId: link.global_category_id,
        targetName: catalogById.get(link.global_category_id)?.name ?? '',
        exact: link.exact,
      }
    })

    return NextResponse.json({
      success: true,
      data: categories,
      tenantTotal: rows.length,
      tenantLinked: rows.filter((row) => row.global_category_id).length,
      pendingLinks: suggestions.length,
      suggestions,
    })
  } catch (error) {
    logger.error('[superadmin/global-categories] GET', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar la taxonomía.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null

    // Acción aparte: vincular por nombre las categorías de empresas sueltas.
    if (body?.action === 'link-existing') {
      return await linkExisting(user, request, body.ids)
    }

    const validation = categorySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
    }

    const admin = createAdminSupabase()
    const parentId = validation.data.parent_id || null
    let level = 0
    if (parentId) {
      const { data: parent } = await admin.from('global_categories').select('level').eq('id', parentId).maybeSingle()
      level = Math.min(2, Number(parent?.level ?? 0) + 1)
    }

    const { data, error } = await admin
      .from('global_categories')
      .insert({
        name: validation.data.name,
        slug: categorySlug(validation.data.slug || validation.data.name),
        description: validation.data.description || null,
        parent_id: parentId,
        level,
        aliases: validation.data.aliases ?? [],
        icon: validation.data.icon || null,
        sort_order: validation.data.sort_order ?? 0,
        is_active: validation.data.is_active ?? true,
      })
      .select(COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'Ya hay una categoría con ese nombre.' }, { status: 409 })
      }
      throw error
    }

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'create',
      resource: 'global_categories',
      resourceId: data.id,
      newValues: { name: data.name, slug: data.slug },
      request,
    })

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    logger.error('[superadmin/global-categories] POST', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear la categoría.' }, { status: 500 })
  }
}

/** Vincula por nombre las categorías de empresas que hoy están sueltas. */
async function linkExisting(user: { id: string; email: string | null }, request: NextRequest, ids?: unknown) {
  const admin = createAdminSupabase()
  const [{ data: catalog }, { data: tenantCategories }] = await Promise.all([
    admin.from('global_categories').select(COLUMNS),
    admin.from('categories').select('id, name, global_category_id'),
  ])

  const plan = suggestCategoryLinks(
    (tenantCategories ?? []) as Array<{ id: string; name: string; global_category_id?: string | null }>,
    (catalog ?? []) as GlobalCategory[],
  )

  // Se puede mandar una selección: sin ella se vincula todo lo que coincide.
  const onlyIds = Array.isArray(ids) ? new Set(ids.map(String)) : null

  let linked = 0
  for (const link of plan) {
    if (onlyIds && !onlyIds.has(link.id)) continue
    const { error } = await admin
      .from('categories')
      .update({ global_category_id: link.global_category_id })
      .eq('id', link.id)
      .is('global_category_id', null)
    if (!error) linked += 1
  }

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'update',
    resource: 'categories',
    newValues: { linked, action: 'link-existing' },
    request,
  })

  return NextResponse.json({ success: true, linked })
}

export async function PUT(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const validation = updateSchema.safeParse(await request.json().catch(() => null))
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
    }

    const { id, ...input } = validation.data
    if (input.parent_id === id) {
      return NextResponse.json({ success: false, error: 'Una categoría no puede ser su propia madre.' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.name !== undefined) {
      updates.name = input.name
      updates.slug = categorySlug(input.slug || input.name)
    } else if (input.slug !== undefined) {
      updates.slug = categorySlug(input.slug)
    }
    if (input.description !== undefined) updates.description = input.description || null
    if (input.aliases !== undefined) updates.aliases = input.aliases ?? []
    if (input.icon !== undefined) updates.icon = input.icon || null
    if (input.sort_order !== undefined) updates.sort_order = input.sort_order
    if (input.is_active !== undefined) updates.is_active = input.is_active

    const admin = createAdminSupabase()
    if (input.parent_id !== undefined) {
      const parentId = input.parent_id || null
      updates.parent_id = parentId
      let level = 0
      if (parentId) {
        const { data: parent } = await admin.from('global_categories').select('level').eq('id', parentId).maybeSingle()
        level = Math.min(2, Number(parent?.level ?? 0) + 1)
      }
      updates.level = level
    }

    const { data, error } = await admin.from('global_categories').update(updates).eq('id', id).select(COLUMNS).single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'Ya hay una categoría con ese nombre.' }, { status: 409 })
      }
      throw error
    }

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'update',
      resource: 'global_categories',
      resourceId: id,
      newValues: updates,
      request,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('[superadmin/global-categories] PUT', { error })
    return NextResponse.json({ success: false, error: 'No se pudo guardar la categoría.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Falta la categoría a dar de baja.' }, { status: 400 })

    // Baja lógica: borrarla desvincularía las categorías de las empresas y sus
    // productos saldrían de la agrupación del marketplace sin que nadie lo pida.
    const admin = createAdminSupabase()
    const { data, error } = await admin
      .from('global_categories')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLUMNS)
      .single()

    if (error) throw error

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'deactivate',
      resource: 'global_categories',
      resourceId: id,
      request,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('[superadmin/global-categories] DELETE', { error })
    return NextResponse.json({ success: false, error: 'No se pudo dar de baja la categoría.' }, { status: 500 })
  }
}
