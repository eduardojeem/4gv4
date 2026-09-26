import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { canCreateResource } from '@/lib/saas/subscription-service'
import { logger } from '@/lib/logger'
import { startOfDayInTimeZone, DEFAULT_TIME_ZONE } from '@/lib/date/timezone'
import {
  parseBranchInventoryInitialization,
  type BranchInventoryInitialization,
} from '@/lib/branches/inventory-initialization'

type BranchPayload = {
  organization_id?: unknown
  name?: unknown
  code?: unknown
  slug?: unknown
  address?: unknown
  city?: unknown
  phone?: unknown
  email?: unknown
  manager_name?: unknown
  is_active?: unknown
  is_default?: unknown
  inventory_initialization?: unknown
}

type OrganizationSummary = {
  id: string
  name: string
  slug?: string | null
}

function toText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toOptionalText(value: unknown) {
  const normalized = toText(value)
  return normalized.length > 0 ? normalized : null
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function loadOrganizationMap(organizationIds: string[]) {
  const supabase = createAdminSupabase()
  const uniqueIds = Array.from(new Set(organizationIds.filter(Boolean)))
  const organizations = new Map<string, OrganizationSummary>()

  if (uniqueIds.length === 0) {
    return organizations
  }

  const [{ data: orgRows }, { data: settingRows }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug')
      .in('id', uniqueIds),
    supabase
      .from('organization_settings')
      .select('organization_id, display_name')
      .in('organization_id', uniqueIds),
  ])

  const settingsByOrgId = new Map(
    (settingRows ?? []).map((row: { organization_id: string; display_name?: string | null }) => [
      row.organization_id,
      row.display_name,
    ])
  )

  for (const organization of orgRows ?? []) {
    organizations.set(organization.id, {
      id: organization.id,
      name: settingsByOrgId.get(organization.id) || organization.name || 'Organizacion sin nombre',
      slug: organization.slug ?? null,
    })
  }

  return organizations
}

async function listOrganizations() {
  const organizationMap = await loadOrganizationMap([])
  const supabase = createAdminSupabase()
  const [{ data: orgRows }, { data: settingRows }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug')
      .order('name', { ascending: true }),
    supabase
      .from('organization_settings')
      .select('organization_id, display_name'),
  ])

  const settingsByOrgId = new Map(
    (settingRows ?? []).map((row: { organization_id: string; display_name?: string | null }) => [
      row.organization_id,
      row.display_name,
    ])
  )

  for (const organization of orgRows ?? []) {
    organizationMap.set(organization.id, {
      id: organization.id,
      name: settingsByOrgId.get(organization.id) || organization.name || 'Organizacion sin nombre',
      slug: organization.slug ?? null,
    })
  }

  return Array.from(organizationMap.values()).sort((left, right) => left.name.localeCompare(right.name, 'es'))
}

async function resolveWritableOrganizationId(ctx: AdminAuthContext, requestedOrganizationId: unknown) {
  if (ctx.organizationId) {
    return ctx.organizationId
  }

  const organizationId = toText(requestedOrganizationId)
  if (!organizationId) {
    return null
  }

  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.id
}

const INVENTORY_PAGE_SIZE = 1000
const INVENTORY_INSERT_BATCH_SIZE = 500

async function loadAllRows<T>(loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>) {
  const rows: T[] = []

  for (let from = 0; ; from += INVENTORY_PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + INVENTORY_PAGE_SIZE - 1)
    if (error) throw new Error(error.message || 'No se pudo preparar el inventario inicial.')

    const page = data ?? []
    rows.push(...page)
    if (page.length < INVENTORY_PAGE_SIZE) return rows
  }
}

async function initializeBranchInventory(params: {
  supabase: ReturnType<typeof createAdminSupabase>
  organizationId: string
  branchId: string
  initialization: BranchInventoryInitialization
}) {
  const { supabase, organizationId, branchId, initialization } = params

  if (initialization.mode === 'copy') {
    const { data: sourceBranch, error: sourceError } = await supabase
      .from('branches')
      .select('id')
      .eq('id', initialization.sourceBranchId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle()

    if (sourceError) throw sourceError
    if (!sourceBranch) {
      throw new Error('La sucursal de origen no existe, esta inactiva o pertenece a otra organizacion.')
    }
  }

  const products = await loadAllRows<{ id: string }>((from, to) =>
    supabase
      .from('products')
      .select('id')
      .eq('organization_id', organizationId)
      .order('id', { ascending: true })
      .range(from, to)
  )

  if (products.length === 0) return 0

  const sourceStock = new Map<string, number>()
  if (initialization.mode === 'copy') {
    const inventoryRows = await loadAllRows<{ product_id: string; stock_quantity: number | null }>((from, to) =>
      supabase
        .from('branch_inventory')
        .select('product_id, stock_quantity')
        .eq('branch_id', initialization.sourceBranchId)
        .order('product_id', { ascending: true })
        .range(from, to)
    )

    for (const row of inventoryRows) {
      sourceStock.set(row.product_id, Math.max(0, Number(row.stock_quantity || 0)))
    }
  }

  const inventoryRows = products.map((product) => ({
    branch_id: branchId,
    product_id: product.id,
    stock_quantity: initialization.mode === 'copy' ? sourceStock.get(product.id) ?? 0 : 0,
    reserved_quantity: 0,
  }))

  for (let index = 0; index < inventoryRows.length; index += INVENTORY_INSERT_BATCH_SIZE) {
    const { error } = await supabase
      .from('branch_inventory')
      .upsert(inventoryRows.slice(index, index + INVENTORY_INSERT_BATCH_SIZE), {
        onConflict: 'branch_id,product_id',
      })
    if (error) throw error
  }

  return inventoryRows.length
}

type BranchMetrics = {
  users_count: number
  primary_users_count: number
  registers_count: number
  open_registers_count: number
  sales_count: number
  repairs_count: number
  revenue_total: number
}

const EMPTY_METRICS: BranchMetrics = {
  users_count: 0,
  primary_users_count: 0,
  registers_count: 0,
  open_registers_count: 0,
  sales_count: 0,
  repairs_count: 0,
  revenue_total: 0,
}

/**
 * Inicio del mes en la zona de la organizacion. Hacerlo con `setHours` en el
 * servidor resolveria contra la zona del host (UTC en produccion) y correria el
 * corte varias horas, metiendo ventas en el mes equivocado.
 */
async function resolveMonthStartIso(organizationId: string | null) {
  const supabase = createAdminSupabase()
  let timeZone: string | undefined

  if (organizationId) {
    const { data } = await supabase
      .from('organizations')
      .select('timezone')
      .eq('id', organizationId)
      .maybeSingle()
    timeZone = (data?.timezone as string | undefined) ?? undefined
  }

  const startOfToday = startOfDayInTimeZone(timeZone)
  // Retroceder al dia 1 conservando el instante de medianoche local.
  const localDay = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: timeZone || DEFAULT_TIME_ZONE, day: 'numeric' })
      .format(startOfToday)
  )
  const monthStart = new Date(startOfToday.getTime() - (localDay - 1) * 24 * 60 * 60 * 1000)
  return monthStart.toISOString()
}

/**
 * Respaldo sin RPC: una consulta por tabla para TODAS las sucursales y el
 * agrupado en memoria. Se usa mientras la migracion del agregado no este
 * aplicada. Sigue siendo 4 consultas en total en lugar de 6 por sucursal.
 */
async function loadBranchMetricsFallback(branchIds: string[], monthStartIso: string) {
  const supabase = createAdminSupabase()
  const metrics = new Map<string, BranchMetrics>()
  for (const id of branchIds) metrics.set(id, { ...EMPTY_METRICS })

  const bump = (branchId: unknown, apply: (entry: BranchMetrics) => void) => {
    const entry = metrics.get(String(branchId))
    if (entry) apply(entry)
  }

  // `sales` arrastra deriva de esquema: algunas instalaciones tienen
  // `total_amount`, otras `total`. Si la columna no existe la consulta falla,
  // asi que se reintenta con el set minimo.
  const loadSales = async () => {
    const full = await supabase
      .from('sales')
      .select('branch_id, total_amount, total')
      .in('branch_id', branchIds)
      .gte('created_at', monthStartIso)

    if (!full.error) return full
    return supabase
      .from('sales')
      .select('branch_id, total_amount')
      .in('branch_id', branchIds)
      .gte('created_at', monthStartIso)
  }

  const [assignments, registers, sales, repairs] = await Promise.all([
    supabase
      .from('user_branch_assignments')
      .select('branch_id, is_primary')
      .in('branch_id', branchIds)
      .eq('is_active', true),
    supabase
      .from('cash_registers')
      .select('branch_id, is_open')
      .in('branch_id', branchIds),
    loadSales(),
    supabase
      .from('repairs')
      .select('branch_id')
      .in('branch_id', branchIds),
  ])

  for (const row of (assignments.data ?? []) as Array<Record<string, unknown>>) {
    bump(row.branch_id, (entry) => {
      entry.users_count += 1
      if (row.is_primary) entry.primary_users_count += 1
    })
  }

  for (const row of (registers.data ?? []) as Array<Record<string, unknown>>) {
    bump(row.branch_id, (entry) => {
      entry.registers_count += 1
      if (row.is_open) entry.open_registers_count += 1
    })
  }

  for (const row of (sales.data ?? []) as Array<Record<string, unknown>>) {
    bump(row.branch_id, (entry) => {
      entry.sales_count += 1
      const amount = Number(row.total_amount ?? row.total ?? 0)
      if (Number.isFinite(amount)) entry.revenue_total += amount
    })
  }

  for (const row of (repairs.data ?? []) as Array<Record<string, unknown>>) {
    bump(row.branch_id, (entry) => { entry.repairs_count += 1 })
  }

  return metrics
}

/** Metricas de todas las sucursales en una sola consulta agregada. */
async function loadBranchMetrics(branchIds: string[], organizationId: string | null) {
  const metrics = new Map<string, BranchMetrics>()
  if (branchIds.length === 0) return metrics

  const supabase = createAdminSupabase()
  const monthStartIso = await resolveMonthStartIso(organizationId)

  const { data, error } = await supabase.rpc('branch_metrics', {
    p_branch_ids: branchIds,
    p_month_start: monthStartIso,
  })

  if (error) {
    // La migracion que crea el RPC puede no haber corrido todavia. En ese caso
    // se calculan las metricas en el servidor con consultas por lote: no es tan
    // exacto como el agregado en base (PostgREST corta las lecturas en 1000
    // filas), pero devuelve datos reales en lugar de ceros.
    logger.warn('branch_metrics RPC unavailable; falling back to batched queries', {
      error: error.message,
      organizationId,
    })
    return loadBranchMetricsFallback(branchIds, monthStartIso)
  }

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    metrics.set(String(row.branch_id), {
      users_count: Number(row.users_count ?? 0),
      primary_users_count: Number(row.primary_users_count ?? 0),
      registers_count: Number(row.registers_count ?? 0),
      open_registers_count: Number(row.open_registers_count ?? 0),
      sales_count: Number(row.sales_count ?? 0),
      repairs_count: Number(row.repairs_count ?? 0),
      revenue_total: Number(row.revenue_total ?? 0),
    })
  }

  for (const id of branchIds) {
    if (!metrics.has(id)) metrics.set(id, EMPTY_METRICS)
  }

  return metrics
}

async function getHandler(request: NextRequest, ctx: AdminAuthContext) {
  try {
    const supabase = createAdminSupabase()
    const requestedOrganizationId = toText(request.nextUrl.searchParams.get('organizationId'))
    const organizations = ctx.user.role === 'super_admin' ? await listOrganizations() : []

    if (ctx.user.role === 'super_admin' && !requestedOrganizationId) {
      return NextResponse.json({ branches: [], organizations })
    }

    if (ctx.user.role === 'super_admin' && !organizations.some((organization) => organization.id === requestedOrganizationId)) {
      return NextResponse.json({ error: 'Organizacion invalida.' }, { status: 400 })
    }

    let query = supabase
      .from('branches')
      .select('id, organization_id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (ctx.organizationId) {
      query = query.eq('organization_id', ctx.organizationId)
    } else if (requestedOrganizationId) {
      query = query.eq('organization_id', requestedOrganizationId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message || 'No se pudieron cargar las sucursales.' },
        { status: error.message?.includes('branches') ? 503 : 500 }
      )
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>
    const organizationMap = ctx.user.role === 'super_admin'
      ? await loadOrganizationMap(rows.map((branch) => String(branch.organization_id ?? '')))
      : new Map<string, OrganizationSummary>()

    const metricsByBranchId = await loadBranchMetrics(
      rows.map((branch) => String(branch.id)),
      ctx.organizationId ?? requestedOrganizationId ?? null
    )

    const branches = rows.map((branch) => ({
      ...branch,
      organization: typeof branch.organization_id === 'string'
        ? organizationMap.get(branch.organization_id) ?? null
        : null,
      ...(metricsByBranchId.get(String(branch.id)) ?? EMPTY_METRICS),
    }))

    return NextResponse.json({ branches, organizations })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function postHandler(request: NextRequest, ctx: AdminAuthContext) {
  try {
    const body = await request.json() as BranchPayload
    let inventoryInitialization: BranchInventoryInitialization
    try {
      inventoryInitialization = parseBranchInventoryInitialization(body.inventory_initialization)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Configuracion de inventario invalida.' },
        { status: 400 }
      )
    }

    const name = toText(body.name)
    const code = toText(body.code).toUpperCase() || slugify(name).slice(0, 12).toUpperCase()
    const slug = toText(body.slug) || slugify(name)

    if (!name) {
      return NextResponse.json({ error: 'El nombre de la sucursal es obligatorio.' }, { status: 400 })
    }

    if (!code) {
      return NextResponse.json({ error: 'No se pudo generar un código válido para la sucursal.' }, { status: 400 })
    }

    if (!slug) {
      return NextResponse.json({ error: 'No se pudo generar un identificador válido para la sucursal.' }, { status: 400 })
    }

    const supabase = createAdminSupabase()
    const organizationId = await resolveWritableOrganizationId(ctx, body.organization_id)

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Selecciona una organizacion valida para crear la sucursal.' },
        { status: 400 }
      )
    }

    const planGate = await canCreateResource(organizationId, 'branches')

    if (!planGate.allowed) {
      const planName = planGate.plan?.name || planGate.plan?.code || 'actual'
      const limitText = planGate.limit === null ? 'ilimitadas' : String(planGate.limit)
      return NextResponse.json(
        {
          error: planGate.blocked
            ? 'No se puede crear la sucursal porque la suscripcion esta suspendida o cancelada. Reactiva la suscripcion para habilitar mas sucursales.'
            : planGate.expired
              ? `No hay cupo para crear esta sucursal. Como el plan vencio, la organizacion quedo con el limite Free de ${limitText} sucursal(es). Actualiza el plan para habilitar mas sucursales.`
              : `No hay cupo para crear esta sucursal. El plan ${planName} permite ${limitText} sucursal(es). Actualiza el plan para habilitar mas sucursales.`,
          code: planGate.blocked ? 'SUBSCRIPTION_BLOCKED' : 'PLAN_LIMIT_REACHED',
          resource: 'branches',
          current: planGate.current,
          limit: planGate.limit,
        },
        { status: 402 }
      )
    }

    // Las restricciones de unicidad de la base solo cubren (org, code) y
    // (org, slug). Como el code/slug se derivan del nombre pero recortados y
    // normalizados, dos nombres distintos con el mismo prefijo — o el mismo
    // nombre escrito de nuevo — generan code/slug distintos y colaban un
    // duplicado por NOMBRE que la base no frena. El selector entonces mostraba
    // varias sucursales con el mismo nombre, indistinguibles. Se bloquea acá.
    const { data: existingByName, error: existingByNameError } = await supabase
      .from('branches')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .ilike('name', name)
      .maybeSingle()

    if (existingByNameError && existingByNameError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'No se pudo verificar si el nombre de la sucursal ya existe.' },
        { status: 500 }
      )
    }

    if (existingByName) {
      return NextResponse.json(
        { error: `Ya existe una sucursal llamada "${name}". Usá un nombre distinto.` },
        { status: 409 }
      )
    }

    const insertPayload: Record<string, unknown> = {
      organization_id: organizationId,
      name,
      code,
      slug,
      address: toOptionalText(body.address),
      city: toOptionalText(body.city),
      phone: toOptionalText(body.phone),
      email: toOptionalText(body.email),
      manager_name: toOptionalText(body.manager_name),
      is_active: toBoolean(body.is_active, true),
      is_default: toBoolean(body.is_default, false),
    }

    const { data, error } = await supabase
      .from('branches')
      .insert(insertPayload)
      .select('id, organization_id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .single()

    if (error || !data) {
      const status = error?.message?.includes('duplicate') || error?.message?.includes('unique') ? 409 : 500
      return NextResponse.json(
        { error: error?.message || 'No se pudo crear la sucursal.' },
        { status }
      )
    }

    let initializedProducts = 0
    try {
      initializedProducts = await initializeBranchInventory({
        supabase,
        organizationId,
        branchId: data.id,
        initialization: inventoryInitialization,
      })
    } catch (inventoryError) {
      const { error: rollbackError } = await supabase
        .from('branches')
        .delete()
        .eq('id', data.id)
        .eq('organization_id', organizationId)

      logger.error('Branch inventory initialization failed', {
        error: inventoryError instanceof Error ? inventoryError.message : inventoryError,
        rollbackError: rollbackError?.message,
        branchId: data.id,
        organizationId,
      })

      return NextResponse.json(
        {
          error: rollbackError
            ? 'No se pudo inicializar el inventario y la sucursal requiere revision manual.'
            : inventoryError instanceof Error
              ? inventoryError.message
              : 'No se pudo inicializar el inventario de la sucursal.',
          code: 'BRANCH_INVENTORY_INITIALIZATION_FAILED',
        },
        { status: 500 }
      )
    }

    const { error: assignmentError } = await supabase
      .from('user_branch_assignments')
      .insert({
        user_id: ctx.user.id,
        branch_id: data.id,
        is_active: true,
        is_primary: false,
        assigned_by: ctx.user.id,
      })
      .select('id')
      .maybeSingle()

    // No revierte el alta: la sucursal ya es valida sin la asignacion, pero si
    // esto falla el creador no la ve en su selector y hay que poder rastrearlo.
    if (assignmentError) {
      logger.warn('Branch created but creator assignment failed', {
        error: assignmentError.message,
        branchId: data.id,
        userId: ctx.user.id,
      })
    }

    return NextResponse.json({
      branch: data,
      inventory: {
        mode: inventoryInitialization.mode,
        products_initialized: initializedProducts,
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = withAdminAuth(getHandler)
export const POST = withAdminAuth(postHandler)
