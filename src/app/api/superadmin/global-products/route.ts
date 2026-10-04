import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { isSupportedImageSource } from '@/lib/image-url-policy'
import { logger } from '@/lib/logger'
import { gtinKey } from '@/lib/products/barcode-catalog'
import { bulkResultSucceeded, isBulkCatalogResult } from '@/lib/catalog/bulk-result'
import { parseCatalogAdminQuery } from '@/lib/catalog/admin-query'

/**
 * Catálogo global de productos por código de barras: lo administra solo la
 * plataforma. Las tiendas lo usan al escanear (/api/products/barcode-lookup).
 */

const COLUMNS = 'id, gtin, name, brand_name, global_brand_id, global_category_id, description, image_url, is_active, created_at'

const productSchema = z.object({
  gtin: z.string({ message: 'Poné el código de barras.' }).trim().min(8, 'El código de barras es muy corto.').max(14),
  name: z.string({ message: 'Poné el nombre.' }).trim().min(2, 'El nombre es muy corto.').max(200),
  brand_name: z.string().trim().max(120).optional().nullable(),
  global_brand_id: z.string().uuid().optional().nullable(),
  global_category_id: z.string().uuid().optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  image_url: z.string().trim().max(600).optional().nullable(),
  is_active: z.boolean().optional(),
})

const updateSchema = productSchema.partial().extend({ id: z.string().uuid() })

/** Asignar la misma categoría o marca a varias fichas de una vez. */
const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Elegí al menos un producto.').max(500),
  global_category_id: z.string().uuid().nullable().optional(),
  global_brand_id: z.string().uuid().nullable().optional(),
}).refine((value) => value.global_category_id !== undefined || value.global_brand_id !== undefined, {
  message: 'Elegí la categoría o la marca a asignar.',
})

const importSchema = z.object({
  entries: z.array(z.object({
    gtin: z.string().trim().min(8).max(14),
    name: z.string().trim().min(2).max(200),
    brandName: z.string().trim().max(120).nullable().optional(),
    globalBrandId: z.string().uuid().nullable().optional(),
    globalCategoryId: z.string().uuid().nullable().optional(),
    imageUrl: z.string().trim().max(600).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })).min(1, 'Elegí al menos un producto.').max(200),
})

/** La foto sale de un origen permitido: no se aceptan enlaces sueltos. */
function imageOrNull(value: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  const url = (value ?? '').trim()
  if (!url) return { ok: true, value: null }
  if (!isSupportedImageSource(url)) return { ok: false, error: 'La foto tiene que estar alojada en un origen permitido por la plataforma.' }
  return { ok: true, value: url }
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|could not find/i.test(error.message ?? '')))
}

export async function GET(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const admin = createAdminSupabase()
    const query = parseCatalogAdminQuery(new URL(request.url).searchParams)
    const [{ data: result, error }, { data: brands }, { data: categories }] = await Promise.all([
      admin.rpc('get_global_products_admin', {
        p_q: query.q, p_status: query.status, p_brand: query.brand, p_category: query.category,
        p_sort: query.sort, p_page: query.page, p_page_size: query.pageSize,
      }),
      admin.from('global_brands').select('id, name').eq('is_active', true).order('name'),
      admin.from('global_categories').select('id, name, parent_id, sort_order').eq('is_active', true).order('name'),
    ])
    if (isMissingTable(error)) {
      return NextResponse.json({ success: false, missingTable: true, error: 'La tabla global_products no existe todavía. Ejecutá su SQL en Supabase.' }, { status: 503 })
    }
    if (error) throw error

    const payload = result as Record<string, unknown> | null
    if (!payload || !Array.isArray(payload.items)) throw new Error('Invalid catalog query result')

    return NextResponse.json({
      success: true,
      data: payload.items,
      page: payload.page,
      pageSize: payload.pageSize,
      total: payload.total,
      metrics: payload.metrics,
      candidates: payload.candidates,
      candidatesTotal: payload.candidatesTotal,
      truncated: payload.truncated,
      productsWithBarcode: (payload.metrics as { productsWithBarcode?: number } | undefined)?.productsWithBarcode ?? 0,
      brands: brands ?? [],
      categories: categories ?? [],
    })
  } catch (error) {
    logger.error('[superadmin/global-products] GET', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar el catálogo de productos.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const admin = createAdminSupabase()

    if (body?.action === 'bulk-update') {
      const validation = bulkSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
      }
      const { ids, global_category_id, global_brand_id } = validation.data
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (global_category_id !== undefined) updates.global_category_id = global_category_id
      if (global_brand_id !== undefined) {
        updates.global_brand_id = global_brand_id
        // Con marca del catálogo, el texto suelto sobra.
        if (global_brand_id) updates.brand_name = null
      }
      const { data, error } = await admin.from('global_products').update(updates).in('id', ids).select('id')
      if (error) throw error
      await logSuperAdminAction({
        actorId: user.id,
        actorEmail: user.email,
        action: 'update',
        resource: 'global_products',
        newValues: { ...updates, count: data?.length ?? 0, action: 'bulk-update' },
        request,
      })
      return NextResponse.json({ success: true, updated: data?.length ?? 0 })
    }

    // Sumar los productos que ya cargaron las tiendas con su código.
    if (body?.action === 'import') {
      const validation = importSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
      }
      const entries = validation.data.entries.flatMap((entry) => {
        const gtin = gtinKey(entry.gtin)
        if (!gtin) return []
        const image = imageOrNull(entry.imageUrl)
        return [{
          gtin,
          name: entry.name,
          brand_name: entry.brandName || null,
          global_brand_id: entry.globalBrandId || null,
          global_category_id: entry.globalCategoryId || null,
          description: entry.description || null,
          image_url: 'error' in image ? null : image.value,
        }]
      })
      const { data: result, error } = await admin.rpc('import_global_product_candidates', {
        p_entries: entries,
        p_actor_user_id: user.id,
      })
      if (error || !isBulkCatalogResult(result)) throw error ?? new Error('Invalid product import result')
      await logSuperAdminAction({
        actorId: user.id,
        actorEmail: user.email,
        action: 'create',
        resource: 'global_products',
        newValues: { ...result, action: 'import' },
        request,
      })
      return NextResponse.json({ success: bulkResultSucceeded(result), ...result }, { status: bulkResultSucceeded(result) ? 200 : 409 })
    }

    const validation = productSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
    }
    const gtin = gtinKey(validation.data.gtin)
    if (!gtin) {
      return NextResponse.json({ success: false, error: 'No es un código de fabricante válido (EAN-13, EAN-8 o UPC-A). Los códigos internos 2xx no van al catálogo.' }, { status: 400 })
    }
    const image = imageOrNull(validation.data.image_url)
    if ('error' in image) return NextResponse.json({ success: false, error: image.error }, { status: 400 })

    const { data, error } = await admin
      .from('global_products')
      .insert({
        gtin,
        name: validation.data.name,
        brand_name: validation.data.brand_name || null,
        global_brand_id: validation.data.global_brand_id || null,
        global_category_id: validation.data.global_category_id || null,
        description: validation.data.description || null,
        image_url: 'error' in image ? null : image.value,
        is_active: validation.data.is_active ?? true,
      })
      .select(COLUMNS)
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, error: 'Ese código ya está en el catálogo.' }, { status: 409 })
      throw error
    }

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'create',
      resource: 'global_products',
      resourceId: data.id,
      newValues: { gtin, name: data.name },
      request,
    })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    logger.error('[superadmin/global-products] POST', { error })
    return NextResponse.json({ success: false, error: 'No se pudo guardar el producto.' }, { status: 500 })
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

    if (input.gtin !== undefined) {
      const gtin = gtinKey(input.gtin)
      if (!gtin) return NextResponse.json({ success: false, error: 'No es un código de fabricante válido.' }, { status: 400 })
      updates.gtin = gtin
    }
    if (input.name !== undefined) updates.name = input.name
    if (input.brand_name !== undefined) updates.brand_name = input.brand_name || null
    if (input.global_brand_id !== undefined) updates.global_brand_id = input.global_brand_id || null
    if (input.global_category_id !== undefined) updates.global_category_id = input.global_category_id || null
    if (input.description !== undefined) updates.description = input.description || null
    if (input.image_url !== undefined) {
      const image = imageOrNull(input.image_url)
      if ('error' in image) return NextResponse.json({ success: false, error: image.error }, { status: 400 })
      updates.image_url = 'error' in image ? null : image.value
    }
    if (input.is_active !== undefined) updates.is_active = input.is_active

    const admin = createAdminSupabase()
    const { data, error } = await admin.from('global_products').update(updates).eq('id', id).select(COLUMNS).single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, error: 'Ese código ya está en el catálogo.' }, { status: 409 })
      throw error
    }

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'update',
      resource: 'global_products',
      resourceId: id,
      newValues: updates,
      request,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('[superadmin/global-products] PUT', { error })
    return NextResponse.json({ success: false, error: 'No se pudo guardar el producto.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Falta el producto a dar de baja.' }, { status: 400 })

    // Baja lógica: deja de ofrecerse al escanear; los productos de las tiendas no cambian.
    const admin = createAdminSupabase()
    const { data, error } = await admin
      .from('global_products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLUMNS)
      .single()
    if (error) throw error

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'deactivate',
      resource: 'global_products',
      resourceId: id,
      request,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('[superadmin/global-products] DELETE', { error })
    return NextResponse.json({ success: false, error: 'No se pudo dar de baja el producto.' }, { status: 500 })
  }
}
