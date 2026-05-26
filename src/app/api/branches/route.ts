import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff } from '@/lib/auth/require-auth'

export async function GET() {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse

  try {
    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from('branches')
      .select('id, code, name, slug, address, city, phone, email, manager_name, is_active, is_default, created_at, updated_at')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ branches: data ?? [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
