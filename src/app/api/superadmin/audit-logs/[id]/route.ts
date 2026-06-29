import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const superAdmin = await getSuperAdminUser()
  if (!superAdmin) return NextResponse.json({ error: 'Acceso denegado.' }, { status: 403 })

  const { id } = await params
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('audit_log')
    .select('id, details, new_values, old_values')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 })
  return NextResponse.json(data)
}
