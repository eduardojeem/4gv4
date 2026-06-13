import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  MESSAGE_COLUMNS,
  organizationRequiredResponse,
  messageToClient,
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
      .from('communication_messages')
      .select(MESSAGE_COLUMNS)
      .eq('organization_id', organization.id)
      .order('sent_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ messages: (data ?? []).map(messageToClient) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
