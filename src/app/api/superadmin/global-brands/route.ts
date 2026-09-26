import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { brandSlug, normalizeBrandName, suggestBrandLinks, type GlobalBrand } from '@/lib/brands/global-catalog'
import { groupUnmatched } from '@/lib/catalog/unmatched'
import { isSupportedImageSource } from '@/lib/image-url-policy'
import { logger } from '@/lib/logger'

/**
 * Catálogo global de marcas: lo administra solo la plataforma.
 *
 * El logo oficial vive acá porque el marketplace agrupa las marcas por nombre:
 * la imagen que cargaba una empresa pasaba a representar a esa marca para todas.
 */

const CATALOG_COLUMNS = 'id, name, slug, aliases, logo_url, website, description, is_active, created_at, updated_at'

const aliasesSchema = z.array(z.string().trim().min(1).max(120)).max(20).optional()

const brandSchema = z.object({
  name: z.string({ message: 'Poné el nombre de la marca.' }).trim().min(2, 'El nombre es muy corto.').max(120),
  slug: z.string().trim().max(140).optional().nullable(),
  aliases: aliasesSchema,
  logo_url: z.string().trim().max(600).optional().nullable(),
  website: z.string().trim().max(240).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
})

const updateSchema = brandSchema.partial().extend({ id: z.string().uuid() })

/** Un logo oficial sale de un origen permitido: no se aceptan enlaces sueltos. */
function validateLogo(logoUrl: string | null | undefined) {
  const value = (logoUrl ?? '').trim()
  if (!value) return { ok: true as const, value: null }
  if (!isSupportedImageSource(value)) {
    return { ok: false as const, error: 'El logo tiene que estar alojado en un origen permitido por la plataforma.' }
  }
  return { ok: true as const, value }
}

export async function GET(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim()
    const admin = createAdminSupabase()

    let query = admin.from('global_brands').select(CATALOG_COLUMNS, { count: 'exact' })
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error, count } = await query.order('name', { ascending: true }).limit(500)
    if (error) throw error

    // Cuántas marcas de empresas usan cada una: dice qué tan usado está el catálogo.
    const { data: usage } = await admin.from('brands').select('global_brand_id').not('global_brand_id', 'is', null)
    const usageByBrand = new Map<string, number>()
    for (const row of (usage ?? []) as Array<{ global_brand_id: string }>) {
      usageByBrand.set(row.global_brand_id, (usageByBrand.get(row.global_brand_id) ?? 0) + 1)
    }

    const brands = ((data ?? []) as Array<{ id: string }>).map((brand) => ({
      ...brand,
      linked_count: usageByBrand.get(brand.id) ?? 0,
    }))

    // Las marcas de empresas sueltas que coinciden por nombre con el catálogo:
    // se muestran una por una antes de vincular, para poder revisarlas.
    const { data: unlinked } = await admin
      .from('brands')
      .select('id, name, organization_id, organizations(name)')
      .is('global_brand_id', null)

    const catalog = (data ?? []) as unknown as GlobalBrand[]
    const catalogById = new Map(catalog.map((brand) => [brand.id, brand]))
    const rows = (unlinked ?? []) as unknown as Array<{
      id: string
      name: string
      organizations?: { name?: string } | Array<{ name?: string }> | null
    }>
    const suggestions = suggestBrandLinks(rows, catalog).map((link) => {
      const row = rows.find((item) => item.id === link.id)!
      const target = catalogById.get(link.global_brand_id)
      const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
      return {
        id: link.id,
        name: row.name,
        organizationName: organization?.name ?? null,
        targetId: link.global_brand_id,
        targetName: target?.name ?? '',
        targetLogoUrl: target?.logo_url ?? null,
        exact: link.exact,
      }
    })

    // Y las que no tienen a dónde vincularse: el catálogo recién arranca, así
    // que la mayoría de las marcas de empresas no existe todavía como oficial.
    const suggested = new Set(suggestions.map((suggestion) => suggestion.id))
    const unmatched = groupUnmatched(
      rows
        .filter((row) => !suggested.has(row.id))
        .map((row) => {
          const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
          return { id: row.id, name: row.name, organizationName: organization?.name ?? null }
        }),
      normalizeBrandName,
    )

    return NextResponse.json({
      success: true,
      data: brands,
      count: count ?? brands.length,
      tenantTotal: (usage ?? []).length + (unlinked ?? []).length,
      tenantLinked: (usage ?? []).length,
      pendingLinks: suggestions.length,
      suggestions,
      unmatched,
    })
  } catch (error) {
    logger.error('[superadmin/global-brands] GET', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar el catálogo de marcas.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null

    // Acción aparte: vincular por nombre las marcas de empresas sueltas.
    if (body?.action === 'link-existing') {
      const admin = createAdminSupabase()
      const [{ data: catalog }, { data: unlinked }] = await Promise.all([
        admin.from('global_brands').select(CATALOG_COLUMNS).eq('is_active', true),
        admin.from('brands').select('id, name').is('global_brand_id', null),
      ])

      // Se puede mandar una selección: sin ella se vincula todo lo que coincide.
      const onlyIds = Array.isArray(body.ids) ? new Set(body.ids.map(String)) : null

      const catalogRows = (catalog ?? []) as unknown as GlobalBrand[]
      const byId = new Map(catalogRows.map((brand) => [brand.id, brand]))

      let linked = 0
      for (const link of suggestBrandLinks((unlinked ?? []) as Array<{ id: string; name: string }>, catalogRows)) {
        if (onlyIds && !onlyIds.has(link.id)) continue
        const match = byId.get(link.global_brand_id)
        if (!match) continue
        const { error } = await admin
          .from('brands')
          .update({
            global_brand_id: match.id,
            name: match.name,
            logo_url: match.logo_url ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', link.id)
          .is('global_brand_id', null)
        if (!error) linked += 1
      }

      await logSuperAdminAction({
        actorId: user.id,
        actorEmail: user.email,
        action: 'update',
        resource: 'brands',
        newValues: { linked, action: 'link-existing' },
        request,
      })

      return NextResponse.json({ success: true, linked })
    }

    // Crear en el catálogo una marca que hoy solo existe en las empresas, y
    // vincular de una las filas que la usan: es el camino para las que no
    // tienen equivalente oficial todavía.
    if (body?.action === 'create-from-tenant') {
      return await createFromTenant(user, request, body.entries)
    }

    const validation = brandSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
    }

    const logo = validateLogo(validation.data.logo_url)
    if (!logo.ok) return NextResponse.json({ success: false, error: logo.error }, { status: 400 })

    const admin = createAdminSupabase()
    const slug = brandSlug(validation.data.slug || validation.data.name)

    const { data, error } = await admin
      .from('global_brands')
      .insert({
        name: validation.data.name,
        slug,
        aliases: validation.data.aliases ?? [],
        logo_url: logo.value,
        website: validation.data.website || null,
        description: validation.data.description || null,
        is_active: validation.data.is_active ?? true,
      })
      .select(CATALOG_COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'Ya hay una marca con ese nombre en el catálogo.' }, { status: 409 })
      }
      throw error
    }

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'create',
      resource: 'global_brands',
      resourceId: data.id,
      newValues: { name: data.name, slug: data.slug },
      request,
    })

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    logger.error('[superadmin/global-brands] POST', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear la marca.' }, { status: 500 })
  }
}

const createFromTenantSchema = z.object({
  entries: z
    .array(
      z.object({
        name: z.string().trim().min(2, 'El nombre es muy corto.').max(120),
        ids: z.array(z.string().uuid()).max(500).optional(),
      }),
    )
    .min(1, 'Elegí al menos una marca.')
    .max(60),
})

/** Sube al catálogo los nombres elegidos y vincula las marcas que los usan. */
async function createFromTenant(user: { id: string; email: string | null }, request: NextRequest, entries: unknown) {
  const validation = createFromTenantSchema.safeParse({ entries })
  if (!validation.success) {
    return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  let created = 0
  let linked = 0

  for (const entry of validation.data.entries) {
    const name = entry.name.trim()
    const slug = brandSlug(name)

    const { data: inserted, error } = await admin
      .from('global_brands')
      .insert({ name, slug, aliases: [], logo_url: null, website: null, description: null, is_active: true })
      .select('id, name, logo_url')
      .single()

    let target = inserted as { id: string; name: string; logo_url: string | null } | null

    if (error) {
      // Ya estaba en el catálogo (otro nombre con el mismo slug): se usa esa.
      if (error.code !== '23505') {
        logger.error('[superadmin/global-brands] create-from-tenant', { error: error.message, name })
        continue
      }
      const { data: existing } = await admin.from('global_brands').select('id, name, logo_url').eq('slug', slug).maybeSingle()
      target = (existing as { id: string; name: string; logo_url: string | null } | null) ?? null
    } else {
      created += 1
    }

    if (!target) continue

    const { data: updated } = await admin
      .from('brands')
      .update({
        global_brand_id: target.id,
        name: target.name,
        logo_url: target.logo_url ?? null,
        updated_at: new Date().toISOString(),
      })
      .is('global_brand_id', null)
      .in('id', entry.ids ?? [])
      .select('id')

    linked += (updated ?? []).length
  }

  await logSuperAdminAction({
    actorId: user.id,
    actorEmail: user.email,
    action: 'create',
    resource: 'global_brands',
    newValues: { created, linked, action: 'create-from-tenant' },
    request,
  })

  return NextResponse.json({ success: true, created, linked })
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
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (input.name !== undefined) {
      updates.name = input.name
      updates.slug = brandSlug(input.slug || input.name)
    } else if (input.slug !== undefined) {
      updates.slug = brandSlug(input.slug)
    }
    if (input.aliases !== undefined) updates.aliases = input.aliases ?? []
    if (input.website !== undefined) updates.website = input.website || null
    if (input.description !== undefined) updates.description = input.description || null
    if (input.is_active !== undefined) updates.is_active = input.is_active
    if (input.logo_url !== undefined) {
      const logo = validateLogo(input.logo_url)
      if (!logo.ok) return NextResponse.json({ success: false, error: logo.error }, { status: 400 })
      updates.logo_url = logo.value
    }

    const admin = createAdminSupabase()
    const { data, error } = await admin
      .from('global_brands')
      .update(updates)
      .eq('id', id)
      .select(CATALOG_COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'Ya hay una marca con ese nombre en el catálogo.' }, { status: 409 })
      }
      throw error
    }

    // Las marcas de las empresas vinculadas siguen a la oficial: si cambia el
    // nombre o el logo, no queda una copia vieja dando vueltas.
    const { error: syncError } = await admin
      .from('brands')
      .update({
        ...(updates.name ? { name: updates.name } : {}),
        ...(input.logo_url !== undefined ? { logo_url: updates.logo_url } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('global_brand_id', id)

    if (syncError) {
      logger.error('[superadmin/global-brands] sync tenant brands', { error: syncError.message, id })
    }

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'update',
      resource: 'global_brands',
      resourceId: id,
      newValues: updates,
      request,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('[superadmin/global-brands] PUT', { error })
    return NextResponse.json({ success: false, error: 'No se pudo guardar la marca.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Falta la marca a dar de baja.' }, { status: 400 })

    const admin = createAdminSupabase()
    // Baja lógica: borrarla desvincularía las marcas de las empresas y sus
    // productos quedarían sin marca oficial sin que nadie lo pida.
    const { data, error } = await admin
      .from('global_brands')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(CATALOG_COLUMNS)
      .single()

    if (error) throw error

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'deactivate',
      resource: 'global_brands',
      resourceId: id,
      request,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('[superadmin/global-brands] DELETE', { error })
    return NextResponse.json({ success: false, error: 'No se pudo dar de baja la marca.' }, { status: 500 })
  }
}
