import { NextResponse } from 'next/server'
import { requireAdmin, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { createAdminSupabase } from '@/lib/supabase/admin'

type BranchPayload = {
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

async function getBranchMetrics(branchId: string) {
  const supabase = createAdminSupabase()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthStartIso = monthStart.toISOString()

  const [
    usersCountResult,
    primaryUsersResult,
    registersCountResult,
    openRegistersCountResult,
    salesResult,
    repairsCountResult,
  ] = await Promise.all([
    supabase
      .from('user_branch_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('is_active', true),
    supabase
      .from('user_branch_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .eq('is_primary', true),
    supabase
      .from('cash_registers')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId),
    supabase
      .from('cash_registers')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('is_open', true),
    supabase
      .from('sales')
      .select('id, total_amount, total, created_at')
      .eq('branch_id', branchId)
      .gte('created_at', monthStartIso),
    supabase
      .from('repairs')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId),
  ])

  const salesRows = (salesResult.data ?? []) as Array<{
    total_amount?: number | string | null
    total?: number | string | null
  }>

  const revenueTotal = salesRows.reduce((sum, sale) => {
    const totalAmount = Number(sale.total_amount ?? sale.total ?? 0)
    return sum + (Number.isFinite(totalAmount) ? totalAmount : 0)
  }, 0)

  return {
    users_count: usersCountResult.count ?? 0,
    primary_users_count: primaryUsersResult.count ?? 0,
    registers_count: registersCountResult.count ?? 0,
    open_registers_count: openRegistersCountResult.count ?? 0,
    sales_count: salesRows.length,
    repairs_count: repairsCountResult.count ?? 0,
    revenue_total: revenueTotal,
  }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from('branches')
      .select('id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message || 'No se pudieron cargar las sucursales.' },
        { status: error.message?.includes('branches') ? 503 : 500 }
      )
    }

    const branches = await Promise.all(
      ((data ?? []) as Array<Record<string, unknown>>).map(async (branch) => ({
        ...branch,
        ...(await getBranchMetrics(String(branch.id))),
      }))
    )

    return NextResponse.json({ branches })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse

    const adminAuth = auth as Extract<AuthResult, { authenticated: true }>
    const body = await request.json() as BranchPayload

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
    const { data, error } = await supabase
      .from('branches')
      .insert({
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
      })
      .select('id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .single()

    if (error || !data) {
      const status = error?.message?.includes('duplicate') || error?.message?.includes('unique') ? 409 : 500
      return NextResponse.json(
        { error: error?.message || 'No se pudo crear la sucursal.' },
        { status }
      )
    }

    await supabase
      .from('user_branch_assignments')
      .insert({
        user_id: adminAuth.user.id,
        branch_id: data.id,
        is_active: true,
        is_primary: false,
        assigned_by: adminAuth.user.id,
      })
      .select('id')
      .maybeSingle()

    return NextResponse.json({ branch: data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
