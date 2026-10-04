import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { logger } from '@/lib/logger'
import { normalizeDeviceBrand, normalizeDeviceModel } from '@/lib/products/device-compatibility'
import { DEVICE_TYPES } from '@/lib/devices/global-models'
import { bulkResultSucceeded, isBulkCatalogResult } from '@/lib/catalog/bulk-result'
import { parseCatalogAdminQuery } from '@/lib/catalog/admin-query'

/**
 * Catálogo global de modelos de equipos: lo administra solo la plataforma y se
 * suma a las sugerencias de marca/modelo de todas las tiendas.
 */

const COLUMNS = 'id, global_brand_id, brand, model, device_type, aliases, release_year, is_active, global_brands(name)'

const modelSchema = z.object({
  brand: z.string({ message: 'Poné la marca.' }).trim().min(1, 'Poné la marca.').max(80),
  global_brand_id: z.string().uuid().optional().nullable(),
  model: z.string({ message: 'Poné el modelo.' }).trim().min(1, 'Poné el modelo.').max(80),
  device_type: z.enum(DEVICE_TYPES).optional(),
  aliases: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  release_year: z.number().int().min(1990).max(2100).nullable().optional(),
  is_active: z.boolean().optional(),
})

const updateSchema = modelSchema.partial().extend({ id: z.string().uuid() })

const importSchema = z.object({
  entries: z.array(z.object({ brand: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(80) }))
    .min(1, 'Elegí al menos un modelo.')
    .max(200),
})

/** Marca y modelo escritos igual que los guardan productos y reparaciones. */
function normalized(input: { brand: string; model: string; aliases?: string[] }) {
  const brand = normalizeDeviceBrand(input.brand)
  const model = normalizeDeviceModel(input.model)
  const aliases = [...new Set((input.aliases ?? []).map((alias) => normalizeDeviceModel(alias)).filter((alias): alias is string => Boolean(alias)))]
    .filter((alias) => alias.toLowerCase() !== model?.toLowerCase())
  return { brand, model, aliases }
}

/**
 * La marca del equipo sale del catálogo de Marcas: si lo escrito coincide con
 * una marca global (por nombre o alias), se guarda con su nombre oficial. Así
 * «samsung» no queda como otra marca distinta de la de Marcas.
 */
async function canonicalBrand(admin: ReturnType<typeof createAdminSupabase>, raw: string): Promise<{ id: string; name: string } | null> {
  const brand = normalizeDeviceBrand(raw)
  if (!brand) return null
  const { data } = await admin.from('global_brands').select('id, name, aliases').eq('is_active', true)
  const key = brand.toLocaleLowerCase('es')
  const matches = ((data ?? []) as Array<{ id: string; name: string; aliases: string[] | null }>).filter((row) =>
    row.name.toLocaleLowerCase('es') === key || (row.aliases ?? []).some((alias) => alias.toLocaleLowerCase('es') === key))
  return matches.length === 1 ? { id: matches[0].id, name: matches[0].name } : null
}

async function activeBrand(admin: ReturnType<typeof createAdminSupabase>, id: string) {
  const { data } = await admin.from('global_brands').select('id, name').eq('id', id).eq('is_active', true).maybeSingle()
  return data as { id: string; name: string } | null
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
    const [{ data: result, error }, { data: brands }] = await Promise.all([
      admin.rpc('get_global_device_models_admin', {
        p_q: query.q, p_status: query.status, p_brand: query.brand,
        p_sort: query.sort, p_page: query.page, p_page_size: query.pageSize,
      }),
      admin.from('global_brands').select('id, name, logo_url').eq('is_active', true).order('name'),
    ])
    if (isMissingTable(error)) {
      return NextResponse.json({ success: false, missingTable: true, error: 'La tabla global_device_models no existe todavía. Ejecutá su SQL en Supabase.' }, { status: 503 })
    }
    if (error) throw error

    const payload = result as Record<string, unknown> | null
    if (!payload || !Array.isArray(payload.items)) throw new Error('Invalid device catalog query result')
    const items = (payload.items as Array<Record<string, unknown>>).map((item) => ({
      ...item,
      brand: String(item.resolved_brand ?? item.brand ?? ''),
    }))

    return NextResponse.json({
      success: true,
      data: items,
      page: payload.page,
      pageSize: payload.pageSize,
      total: payload.total,
      metrics: payload.metrics,
      candidates: payload.candidates,
      candidatesTotal: payload.candidatesTotal,
      truncated: payload.truncated,
      storesUsing: (payload.metrics as { storesUsing?: number } | undefined)?.storesUsing ?? 0,
      // Las marcas del catálogo de Marcas: de ahí se elige la del equipo.
      brands: brands ?? [],
    })
  } catch (error) {
    logger.error('[superadmin/global-device-models] GET', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar el catálogo de modelos.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const admin = createAdminSupabase()

    // Sumar de una los modelos que ya usan las tiendas.
    if (body?.action === 'import') {
      const validation = importSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
      }
      const rows = validation.data.entries
        .map((entry) => normalized(entry))
        .filter((entry): entry is { brand: string; model: string; aliases: string[] } => Boolean(entry.brand && entry.model))
      const entries = await Promise.all(rows.map(async (row) => ({
        global_brand_id: (await canonicalBrand(admin, row.brand))?.id ?? null,
        model: row.model,
        device_type: 'smartphone',
      })))
      const { data: result, error } = await admin.rpc('import_global_device_model_candidates', {
        p_entries: entries,
        p_actor_user_id: user.id,
      })
      if (error || !isBulkCatalogResult(result)) throw error ?? new Error('Invalid device model import result')

      await logSuperAdminAction({
        actorId: user.id,
        actorEmail: user.email,
        action: 'create',
        resource: 'global_device_models',
        newValues: { ...result, action: 'import' },
        request,
      })
      return NextResponse.json({ success: bulkResultSucceeded(result), ...result }, { status: bulkResultSucceeded(result) ? 200 : 409 })
    }

    const validation = modelSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
    }
    const normalizedInput = normalized(validation.data)
    const { model, aliases } = normalizedInput
    const brand = validation.data.global_brand_id
      ? await activeBrand(admin, validation.data.global_brand_id)
      : normalizedInput.brand ? await canonicalBrand(admin, normalizedInput.brand) : null
    if (!brand) return NextResponse.json({ success: false, error: 'La marca elegida no está activa o es ambigua.' }, { status: 400 })
    if (!model) return NextResponse.json({ success: false, error: 'Poné la marca y el modelo.' }, { status: 400 })

    const { data, error } = await admin
      .from('global_device_models')
      .insert({
        global_brand_id: brand.id,
        brand: brand.name,
        model,
        aliases,
        device_type: validation.data.device_type ?? 'smartphone',
        release_year: validation.data.release_year ?? null,
        is_active: validation.data.is_active ?? true,
      })
      .select(COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, error: `${brand.name} ${model} ya está en el catálogo.` }, { status: 409 })
      throw error
    }

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'create',
      resource: 'global_device_models',
      resourceId: data.id,
      newValues: { global_brand_id: brand.id, brand: brand.name, model },
      request,
    })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    logger.error('[superadmin/global-device-models] POST', { error })
    return NextResponse.json({ success: false, error: 'No se pudo guardar el modelo.' }, { status: 500 })
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

    if (input.global_brand_id !== undefined || input.brand !== undefined || input.model !== undefined || input.aliases !== undefined) {
      const admin = createAdminSupabase()
      const { data: current } = await admin.from('global_device_models').select('global_brand_id, brand, model, aliases').eq('id', id).maybeSingle()
      const next = normalized({
        brand: input.brand ?? (current as { brand?: string } | null)?.brand ?? '',
        model: input.model ?? (current as { model?: string } | null)?.model ?? '',
        aliases: input.aliases ?? (current as { aliases?: string[] } | null)?.aliases ?? [],
      })
      if (!next.brand || !next.model) return NextResponse.json({ success: false, error: 'Poné la marca y el modelo.' }, { status: 400 })
      const brandId = input.global_brand_id ?? (current as { global_brand_id?: string | null } | null)?.global_brand_id
      const brand = brandId ? await activeBrand(admin, brandId) : await canonicalBrand(admin, next.brand)
      if (!brand) return NextResponse.json({ success: false, error: 'La marca elegida no está activa o es ambigua.' }, { status: 400 })
      Object.assign(updates, next, { global_brand_id: brand.id, brand: brand.name })
    }
    if (input.device_type !== undefined) updates.device_type = input.device_type
    if (input.release_year !== undefined) updates.release_year = input.release_year
    if (input.is_active !== undefined) updates.is_active = input.is_active

    const admin = createAdminSupabase()
    const { data, error } = await admin.from('global_device_models').update(updates).eq('id', id).select(COLUMNS).single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, error: 'Ese modelo ya está en el catálogo.' }, { status: 409 })
      throw error
    }

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'update',
      resource: 'global_device_models',
      resourceId: id,
      newValues: updates,
      request,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('[superadmin/global-device-models] PUT', { error })
    return NextResponse.json({ success: false, error: 'No se pudo guardar el modelo.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Falta el modelo a dar de baja.' }, { status: 400 })

    // Baja lógica, como marcas y categorías: deja de sugerirse y se puede reactivar.
    const admin = createAdminSupabase()
    const { data, error } = await admin
      .from('global_device_models')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLUMNS)
      .single()
    if (error) throw error

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'deactivate',
      resource: 'global_device_models',
      resourceId: id,
      request,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('[superadmin/global-device-models] DELETE', { error })
    return NextResponse.json({ success: false, error: 'No se pudo dar de baja el modelo.' }, { status: 500 })
  }
}
