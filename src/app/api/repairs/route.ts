import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { withBranchFilter } from '@/lib/branches/client'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { roleHasPermission } from '@/lib/saas/permissions'
import { canCreateRepair } from '@/lib/saas/subscription-service'
import {
  isNextResponse,
  resolveRepairRouteContext,
} from '@/app/api/repairs/_lib'

const REPAIR_SELECT_VARIANTS = [
  `
    *,
    customer:customers(id, customer_code, name, first_name, last_name, phone, email),
    technician:profiles(id, full_name),
    images:repair_images(id, image_url, description)
  `,
  `
    *,
    customer:customers(id, name, phone, email),
    technician:profiles(id, full_name),
    images:repair_images(id, image_url, description)
  `,
  `
    *,
    customer:customers(id, first_name, last_name, phone, email),
    technician:profiles(id, full_name),
    images:repair_images(id, image_url, description)
  `,
]

const FULL_REPAIR_SELECT = `
  *,
  customer:customers(id, name, phone, email),
  technician:profiles(id, full_name),
  images:repair_images(id, image_url, description),
  parts:repair_parts(*),
  notes:repair_notes(*)
`

function organizationRequiredResponse() {
  return NextResponse.json(
    {
      error: 'No se pudo resolver la organizacion activa para cargar reparaciones.',
      code: 'ACTIVE_ORGANIZATION_REQUIRED',
      hint: 'Verifica que el usuario tenga una membresia activa en organization_members y que exista la cookie active_organization_id o una organizacion activa por defecto.',
    },
    { status: 403 }
  )
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveRepairRouteContext(request, 'repairs.orders.create')
    if (isNextResponse(ctx)) return ctx

    const body = await request.json() as Record<string, unknown>
    const { parts, notes, images, ...repairFields } = body as {
      parts?: Array<Record<string, unknown>>
      notes?: Array<Record<string, unknown>>
      images?: string[]
      [key: string]: unknown
    }

    // Límite mensual de reparaciones según el plan (free 10/mes, basic 100/mes, pro+ ilimitado).
    const planGate = await canCreateRepair(ctx.organizationId)
    if (!planGate.allowed) {
      const planName = planGate.plan?.name || planGate.plan?.code || 'actual'
      const limitText = planGate.limit === null ? 'ilimitadas' : String(planGate.limit)
      return NextResponse.json(
        {
          error: planGate.blocked
            ? 'No se puede crear la reparacion porque la suscripcion esta suspendida o cancelada. Reactiva la suscripcion para habilitar mas reparaciones.'
            : planGate.expired
              ? `No hay cupo para crear esta reparacion. Como el plan vencio, la organizacion quedo con el limite Free de ${limitText} reparaciones por mes. Actualiza el plan para crear mas.`
              : `No hay cupo para crear esta reparacion. El plan ${planName} permite ${limitText} reparaciones por mes. Actualiza el plan para crear mas.`,
          code: planGate.blocked ? 'SUBSCRIPTION_BLOCKED' : 'PLAN_LIMIT_REACHED',
          resource: 'repairs',
          current: planGate.current,
          limit: planGate.limit,
        },
        { status: 402 }
      )
    }

    const supabase = ctx.supabase

    const { data: newRepair, error: createError } = await supabase
      .from('repairs')
      .insert({
        ...repairFields,
        organization_id: ctx.organizationId,
        branch_id: ctx.branchId,
      })
      .select('id')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    const repairId = newRepair.id

    try {
      if (parts && parts.length > 0) {
        const { error: partsError } = await supabase
          .from('repair_parts')
          .insert(parts.map((p) => ({ ...p, repair_id: repairId })))
        if (partsError) throw partsError
      }

      if (notes && notes.length > 0) {
        const { error: notesError } = await supabase
          .from('repair_notes')
          .insert(notes.map((n) => ({
            ...n,
            repair_id: repairId,
            author_id: ctx.userId,
            author_name: typeof n.author_name === 'string' ? n.author_name : 'Sistema',
          })))
        if (notesError) throw notesError
      }

      if (Array.isArray(images) && images.length > 0) {
        const imageRows = images
          .filter((url): url is string => typeof url === 'string' && url.length > 0)
          .map((url) => ({
            repair_id: repairId,
            image_url: url,
            image_type: 'general',
          }))

        if (imageRows.length > 0) {
          const { error: imagesError } = await supabase
            .from('repair_images')
            .insert(imageRows)
          if (imagesError) throw imagesError
        }
      }
    } catch (relatedError) {
      await supabase.from('repairs').delete().eq('id', repairId)
      const message = relatedError instanceof Error ? relatedError.message : 'No se pudieron guardar los detalles de la reparacion'
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const { data: fullRepair, error: fetchError } = await supabase
      .from('repairs')
      .select(FULL_REPAIR_SELECT)
      .eq('id', repairId)
      .eq('organization_id', ctx.organizationId)
      .eq('branch_id', ctx.branchId)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    return NextResponse.json({ repair: fullRepair }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse
  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)

  if (!organization) {
    return organizationRequiredResponse()
  }
  if (!roleHasPermission(organization.role, 'repairs.orders.read')) {
    return NextResponse.json({ error: 'No tenes permiso para ver reparaciones.' }, { status: 403 })
  }

  try {
    const branchId = request.headers.get('x-branch-id')
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || 50)))
    const status = searchParams.get('status') || null
    const search = (searchParams.get('search') || '').trim()
    const offset = (page - 1) * pageSize

    const supabase = createAdminSupabase()
    let lastError: unknown = null

    for (const selectExpr of REPAIR_SELECT_VARIANTS) {
      let query = supabase
        .from('repairs')
        .select(selectExpr, { count: 'exact' })
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      query = withBranchFilter(query, branchId)

      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      if (search) {
        query = query.or(`device_brand.ilike.%${search}%,device_model.ilike.%${search}%,problem_description.ilike.%${search}%,ticket_number.ilike.%${search}%`)
      }

      const { data, error, count } = await query

      if (!error) {
        return NextResponse.json({
          repairs: data ?? [],
          pagination: {
            page,
            pageSize,
            total: count ?? 0,
            totalPages: Math.ceil((count ?? 0) / pageSize),
          },
        })
      }

      lastError = error
      const message = String(error.message || '').toLowerCase()
      const isSchemaError = message.includes('column') || message.includes('does not exist')
      if (!isSchemaError) break
    }

    const message = lastError instanceof Error ? lastError.message : 'No se pudieron cargar las reparaciones'
    return NextResponse.json({ error: message }, { status: 500 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
