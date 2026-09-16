import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { brandSlug, findGlobalBrandByName, type GlobalBrand } from '@/lib/brands/global-catalog'
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

    // Marcas de empresas sueltas que coinciden por nombre con el catálogo: el
    // trabajo pendiente, a la vista antes de tocar nada.
    const { data: unlinked } = await admin.from('brands').select('id, name').is('global_brand_id', null)
    const catalog = (data ?? []) as unknown as GlobalBrand[]
    const pendingLinks = ((unlinked ?? []) as Array<{ name: string }>)
      .filter((brand) => findGlobalBrandByName(brand.name, catalog)).length

    return NextResponse.json({
      success: true,
      data: brands,
      count: count ?? brands.length,
      tenantTotal: (usage ?? []).length + (unlinked ?? []).length,
      tenantLinked: (usage ?? []).length,
      pendingLinks,
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

      let linked = 0
      for (const brand of ((unlinked ?? []) as Array<{ id: string; name: string }>)) {
        const match = findGlobalBrandByName(brand.name, (catalog ?? []) as unknown as GlobalBrand[])
        if (!match) continue
        const { error } = await admin
          .from('brands')
          .update({
            global_brand_id: match.id,
            name: match.name,
            logo_url: match.logo_url ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', brand.id)
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
