import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { withBranchFilter } from '@/lib/branches/client'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

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

export async function POST(request: NextRequest) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse
  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)

  if (!organization) {
    return NextResponse.json({ error: 'Organizacion requerida' }, { status: 403 })
  }

  try {
    const body = await request.json() as Record<string, unknown>
    const { parts, notes, ...repairFields } = body as {
      parts?: Array<Record<string, unknown>>
      notes?: Array<Record<string, unknown>>
      [key: string]: unknown
    }

    const supabase = createAdminSupabase()

    const { data: newRepair, error: createError } = await supabase
      .from('repairs')
      .insert({ ...repairFields, organization_id: organization.id })
      .select('id')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    const repairId = newRepair.id

    if (parts && parts.length > 0) {
      const { error: partsError } = await supabase
        .from('repair_parts')
        .insert(parts.map((p) => ({ ...p, repair_id: repairId })))
      if (partsError) {
        return NextResponse.json({ error: partsError.message }, { status: 500 })
      }
    }

    if (notes && notes.length > 0) {
      const { error: notesError } = await supabase
        .from('repair_notes')
        .insert(notes.map((n) => ({ ...n, repair_id: repairId })))
      if (notesError) {
        return NextResponse.json({ error: notesError.message }, { status: 500 })
      }
    }

    const { data: fullRepair, error: fetchError } = await supabase
      .from('repairs')
      .select(FULL_REPAIR_SELECT)
      .eq('id', repairId)
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
    return NextResponse.json({ error: 'Organizacion requerida' }, { status: 403 })
  }

  try {
    const branchId = request.headers.get('x-branch-id')
    const supabase = createAdminSupabase()
    let lastError: unknown = null

    for (const selectExpr of REPAIR_SELECT_VARIANTS) {
      let query = supabase
        .from('repairs')
        .select(selectExpr)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })

      query = withBranchFilter(query, branchId)
      const { data, error } = await query

      if (!error) {
        return NextResponse.json({ repairs: data ?? [] })
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
