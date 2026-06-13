import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  SEGMENT_COLUMNS,
  organizationRequiredResponse,
  toClient,
  toDbPayload,
} from '@/lib/customer-segments/mappers'

export async function GET() {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse
  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)
  if (!organization) return organizationRequiredResponse()

  try {
    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from('customer_segments')
      .select(SEGMENT_COLUMNS)
      .eq('organization_id', organization.id)
      .order('priority', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ segments: (data ?? []).map(toClient) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse
  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)
  if (!organization) return organizationRequiredResponse()

  try {
    const body = (await request.json()) as Record<string, unknown>
    const payload = toDbPayload(body)
    if (!payload.name) {
      return NextResponse.json({ error: 'El nombre del segmento es obligatorio' }, { status: 400 })
    }

    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from('customer_segments')
      .insert({ ...payload, organization_id: organization.id, created_by: staffAuth.user.id })
      .select(SEGMENT_COLUMNS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ segment: toClient(data) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
