import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'

type BranchUpdatePayload = {
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

function toBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

async function loadBranchDetail(
  request: NextRequest,
  ctx: AdminAuthContext & { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    if (!id) {
      return NextResponse.json({ error: 'Sucursal inválida.' }, { status: 400 })
    }

    const supabase = createAdminSupabase()
    let branchQuery = supabase
      .from('branches')
      .select('id, organization_id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .eq('id', id)

    if (ctx.organizationId) {
      branchQuery = branchQuery.eq('organization_id', ctx.organizationId)
    }

    const { data: branch, error: branchError } = await branchQuery.maybeSingle()
    if (branchError) throw branchError
    if (!branch?.organization_id) {
      return NextResponse.json({ error: 'Sucursal no encontrada.' }, { status: 404 })
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_branch_assignments')
      .select('user_id, is_primary, created_at, updated_at')
      .eq('branch_id', branch.id)
      .eq('is_active', true)

    if (assignmentsError) throw assignmentsError

    const userIds = Array.from(new Set((assignments || []).map((row) => row.user_id).filter(Boolean)))
    if (userIds.length === 0) {
      return NextResponse.json({ branch, users: [] })
    }

    const [{ data: profiles, error: profilesError }, { data: memberships, error: membershipsError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, status, department, avatar_url, updated_at')
        .in('id', userIds),
      supabase
        .from('organization_members')
        .select('user_id, role, status')
        .eq('organization_id', branch.organization_id)
        .in('user_id', userIds),
    ])

    if (profilesError) throw profilesError
    if (membershipsError) throw membershipsError

    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]))
    const membershipById = new Map((memberships || []).map((membership) => [membership.user_id, membership]))
    const users = (assignments || []).map((assignment) => {
      const profile = profileById.get(assignment.user_id)
      const membership = membershipById.get(assignment.user_id)

      return {
        id: assignment.user_id,
        full_name: profile?.full_name || null,
        email: profile?.email || null,
        phone: profile?.phone || null,
        role: membership?.role || profile?.role || null,
        status: membership?.status || profile?.status || null,
        department: profile?.department || null,
        avatar_url: profile?.avatar_url || null,
        is_primary: Boolean(assignment.is_primary),
        assigned_at: assignment.created_at,
        updated_at: profile?.updated_at || assignment.updated_at,
      }
    }).sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1
      return (left.full_name || left.email || '').localeCompare(right.full_name || right.email || '', 'es')
    })

    return NextResponse.json({ branch, users })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function patchHandler(
  request: NextRequest,
  ctx: AdminAuthContext & { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params
    const body = await request.json() as BranchUpdatePayload

    if (!id) {
      return NextResponse.json({ error: 'Sucursal inválida.' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {}
    const name = toText(body.name)
    const code = toText(body.code)
    const slug = toText(body.slug)

    if (name) patch.name = name
    if (code) patch.code = code.toUpperCase()
    if (slug) patch.slug = slug
    if ('address' in body) patch.address = toOptionalText(body.address)
    if ('city' in body) patch.city = toOptionalText(body.city)
    if ('phone' in body) patch.phone = toOptionalText(body.phone)
    if ('email' in body) patch.email = toOptionalText(body.email)
    if ('manager_name' in body) patch.manager_name = toOptionalText(body.manager_name)

    const isActive = toBoolean(body.is_active)
    const isDefault = toBoolean(body.is_default)

    if (typeof isActive === 'boolean') patch.is_active = isActive
    if (typeof isDefault === 'boolean') patch.is_default = isDefault

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No hay cambios para aplicar.' }, { status: 400 })
    }

    const supabase = createAdminSupabase()

    // Mismo criterio que al crear: no permitir renombrar una sucursal al
    // nombre de otra ya existente en la organización (la unicidad de la base
    // solo cubre code/slug, no el nombre visible). Se resuelve el org de la
    // propia sucursal para cubrir también al super_admin, que no trae
    // ctx.organizationId fijado.
    if (patch.name) {
      const { data: target } = await supabase
        .from('branches')
        .select('organization_id')
        .eq('id', id)
        .maybeSingle()

      const scopeOrgId = ctx.organizationId ?? target?.organization_id ?? null
      if (scopeOrgId) {
        const { data: nameClash } = await supabase
          .from('branches')
          .select('id')
          .eq('organization_id', scopeOrgId)
          .eq('is_active', true)
          .ilike('name', String(patch.name))
          .neq('id', id)
          .maybeSingle()

        if (nameClash) {
          return NextResponse.json(
            { error: `Ya existe otra sucursal llamada "${patch.name}". Usá un nombre distinto.` },
            { status: 409 }
          )
        }
      }
    }

    // Desactivar la ultima sucursal activa deja a la organizacion sin lugar
    // operativo: caja, stock y reparaciones dependen de que exista una.
    if (isActive === false) {
      const { data: current } = await supabase
        .from('branches')
        .select('organization_id, is_default, is_active')
        .eq('id', id)
        .maybeSingle()

      if (current?.is_active !== false && current?.organization_id) {
        const { count: otherActive } = await supabase
          .from('branches')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', current.organization_id)
          .eq('is_active', true)
          .neq('id', id)

        if ((otherActive ?? 0) === 0) {
          return NextResponse.json(
            { error: 'No podés desactivar la única sucursal activa. Activá otra sucursal primero.' },
            { status: 409 }
          )
        }

        if (current.is_default) {
          return NextResponse.json(
            { error: 'No podés desactivar la sucursal predeterminada. Asigná otra como predeterminada primero.' },
            { status: 409 }
          )
        }
      }
    }

    let updateQuery = supabase
      .from('branches')
      .update(patch)
      .eq('id', id)

    if (ctx.organizationId) {
      updateQuery = updateQuery.eq('organization_id', ctx.organizationId)
    }

    const { data, error } = await updateQuery
      .select('id, organization_id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .maybeSingle()

    if (error || !data) {
      if (!data && !error) {
        return NextResponse.json({ error: 'Sucursal no encontrada.' }, { status: 404 })
      }
      const status = error?.message?.includes('duplicate') || error?.message?.includes('unique') ? 409 : 500
      return NextResponse.json(
        { error: error?.message || 'No se pudo actualizar la sucursal.' },
        { status }
      )
    }

    return NextResponse.json({ branch: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth((req, authCtx) =>
    patchHandler(req, { ...authCtx, params: context.params })
  )(request)
}

export function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth((req, authCtx) =>
    loadBranchDetail(req, { ...authCtx, params: context.params })
  )(request)
}
