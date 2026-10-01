import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import { logger } from '@/lib/logger'
import { normalizeDeviceBrand, normalizeDeviceModel } from '@/lib/products/device-compatibility'
import { DEVICE_TYPES, sortDeviceModels, summarizeDeviceUsage, type GlobalDeviceModel, type UsageRows } from '@/lib/devices/global-models'

/**
 * Catálogo global de modelos de equipos: lo administra solo la plataforma y se
 * suma a las sugerencias de marca/modelo de todas las tiendas.
 */

const COLUMNS = 'id, brand, model, device_type, aliases, release_year, is_active'

const modelSchema = z.object({
  brand: z.string({ message: 'Poné la marca.' }).trim().min(1, 'Poné la marca.').max(80),
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

/** Hasta dónde se leen productos y reparaciones para contar el uso. */
const USAGE_ROW_CAP = 20_000

/** Una página vacía corta la lectura de `fetchAllRows` al llegar al tope. */
const EMPTY_PAGE = Promise.resolve({ data: [] as never[], error: null })

/** Lo que las tiendas cargaron en productos y reparaciones. */
async function readUsage(admin: ReturnType<typeof createAdminSupabase>): Promise<UsageRows> {
  const [products, repairs] = await Promise.all([
    fetchAllRows<UsageRows['products'][number]>((from, to) => from >= USAGE_ROW_CAP
      ? EMPTY_PAGE
      : admin.from('products').select('organization_id, device_brand, device_models').not('device_brand', 'is', null).order('id').range(from, to)).catch(() => []),
    fetchAllRows<UsageRows['repairs'][number]>((from, to) => from >= USAGE_ROW_CAP
      ? EMPTY_PAGE
      : admin.from('repairs').select('organization_id, device_brand, device_model').not('device_brand', 'is', null).order('id').range(from, to)).catch(() => []),
  ])
  return { products, repairs }
}

/**
 * La marca del equipo sale del catálogo de Marcas: si lo escrito coincide con
 * una marca global (por nombre o alias), se guarda con su nombre oficial. Así
 * «samsung» no queda como otra marca distinta de la de Marcas.
 */
async function canonicalBrand(admin: ReturnType<typeof createAdminSupabase>, raw: string): Promise<string | null> {
  const brand = normalizeDeviceBrand(raw)
  if (!brand) return null
  const { data } = await admin.from('global_brands').select('name, aliases').eq('is_active', true)
  const key = brand.toLocaleLowerCase('es')
  const match = ((data ?? []) as Array<{ name: string; aliases: string[] | null }>).find((row) =>
    row.name.toLocaleLowerCase('es') === key || (row.aliases ?? []).some((alias) => alias.toLocaleLowerCase('es') === key))
  return match?.name ?? brand
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|could not find/i.test(error.message ?? '')))
}

export async function GET() {
  const user = await getSuperAdminUser()
  if (!user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const admin = createAdminSupabase()
    const [{ data, error }, usage, { data: brands }] = await Promise.all([
      admin.from('global_device_models').select(COLUMNS).limit(5000),
      readUsage(admin),
      admin.from('global_brands').select('id, name, logo_url').eq('is_active', true).order('name'),
    ])
    if (isMissingTable(error)) {
      return NextResponse.json({ success: false, missingTable: true, error: 'La tabla global_device_models no existe todavía. Ejecutá su SQL en Supabase.' }, { status: 503 })
    }
    if (error) throw error

    const catalog = (data ?? []) as GlobalDeviceModel[]
    const { storesByModel, candidates } = summarizeDeviceUsage(usage, catalog)
    const storesUsing = new Set([...usage.products, ...usage.repairs].map((row) => row.organization_id).filter(Boolean)).size

    return NextResponse.json({
      success: true,
      data: sortDeviceModels(catalog).map((item) => ({ ...item, stores: storesByModel.get(item.id) ?? 0 })),
      candidates: candidates.slice(0, 300),
      candidatesTotal: candidates.length,
      storesUsing,
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
        .map((entry) => ({ brand: entry.brand, model: entry.model, device_type: 'smartphone', aliases: [] as string[] }))

      let created = 0
      for (const row of rows) {
        row.brand = (await canonicalBrand(admin, row.brand)) ?? row.brand
        const { error } = await admin.from('global_device_models').insert(row)
        if (!error) created += 1
        else if (error.code !== '23505') logger.error('[superadmin/global-device-models] import', { error: error.message, row })
      }

      await logSuperAdminAction({
        actorId: user.id,
        actorEmail: user.email,
        action: 'create',
        resource: 'global_device_models',
        newValues: { created, action: 'import' },
        request,
      })
      return NextResponse.json({ success: true, created })
    }

    const validation = modelSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Revisá los datos.' }, { status: 400 })
    }
    const normalizedInput = normalized(validation.data)
    const { model, aliases } = normalizedInput
    const brand = normalizedInput.brand ? await canonicalBrand(admin, normalizedInput.brand) : null
    if (!brand || !model) return NextResponse.json({ success: false, error: 'Poné la marca y el modelo.' }, { status: 400 })

    const { data, error } = await admin
      .from('global_device_models')
      .insert({
        brand,
        model,
        aliases,
        device_type: validation.data.device_type ?? 'smartphone',
        release_year: validation.data.release_year ?? null,
        is_active: validation.data.is_active ?? true,
      })
      .select(COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, error: `${brand} ${model} ya está en el catálogo.` }, { status: 409 })
      throw error
    }

    await logSuperAdminAction({
      actorId: user.id,
      actorEmail: user.email,
      action: 'create',
      resource: 'global_device_models',
      resourceId: data.id,
      newValues: { brand, model },
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

    if (input.brand !== undefined || input.model !== undefined || input.aliases !== undefined) {
      const admin = createAdminSupabase()
      const { data: current } = await admin.from('global_device_models').select('brand, model, aliases').eq('id', id).maybeSingle()
      const next = normalized({
        brand: input.brand ?? (current as { brand?: string } | null)?.brand ?? '',
        model: input.model ?? (current as { model?: string } | null)?.model ?? '',
        aliases: input.aliases ?? (current as { aliases?: string[] } | null)?.aliases ?? [],
      })
      if (!next.brand || !next.model) return NextResponse.json({ success: false, error: 'Poné la marca y el modelo.' }, { status: 400 })
      Object.assign(updates, next, { brand: await canonicalBrand(admin, next.brand) })
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
