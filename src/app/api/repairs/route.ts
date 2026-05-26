import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getAuthResponse, requireStaff } from '@/lib/auth/require-auth'
import { withBranchFilter } from '@/lib/branches/client'

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

export async function GET(request: NextRequest) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse

  try {
    const branchId = request.headers.get('x-branch-id')
    const supabase = createAdminSupabase()
    let lastError: unknown = null

    for (const selectExpr of REPAIR_SELECT_VARIANTS) {
      let query = supabase
        .from('repairs')
        .select(selectExpr)
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
