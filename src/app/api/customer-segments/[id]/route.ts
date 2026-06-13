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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse
  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)
  if (!organization) return organizationRequiredResponse()

  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const payload = toDbPayload(body)

    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from('customer_segments')
      .update(payload)
      .eq('id', id)
      .eq('organization_id', organization.id) // evita editar segmentos de otra org
      .select(SEGMENT_COLUMNS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Segmento no encontrado' }, { status: 404 })
    return NextResponse.json({ segment: toClient(data) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse
  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)
  if (!organization) return organizationRequiredResponse()

  try {
    const { id } = await params
    const supabase = createAdminSupabase()
    const { error } = await supabase
      .from('customer_segments')
      .delete()
      .eq('id', id)
      .eq('organization_id', organization.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
