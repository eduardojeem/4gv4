import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  CAMPAIGN_COLUMNS,
  organizationRequiredResponse,
  campaignToClient,
  campaignToDb,
} from '@/lib/communications/mappers'

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
      .from('communication_campaigns')
      .select(CAMPAIGN_COLUMNS)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ campaigns: (data ?? []).map(campaignToClient) })
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
    const payload = campaignToDb(body)
    if (!payload.name) {
      return NextResponse.json({ error: 'El nombre de la campaña es obligatorio' }, { status: 400 })
    }

    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from('communication_campaigns')
      .insert({ ...payload, organization_id: organization.id, created_by: staffAuth.user.id })
      .select(CAMPAIGN_COLUMNS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ campaign: campaignToClient(data) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
