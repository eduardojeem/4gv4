import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

export async function GET(request: NextRequest) {
  try {
    // Requiere staff autenticado: evita enumeración pública de SKUs.
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const { user } = auth as Extract<AuthResult, { authenticated: true }>

    const organization = await getCurrentOrganizationContext(user.id)
    if (!organization) {
      return NextResponse.json({ error: 'Sin organización activa' }, { status: 403 })
    }

    const sku = request.nextUrl.searchParams.get('sku')
    if (!sku) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Unicidad acotada a la organización del usuario (limit(1), nunca maybeSingle).
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .eq('organization_id', organization.id)
      .limit(1)

    if (error) {
      console.error('Error checking SKU:', error)
      return NextResponse.json({ error: 'Error checking SKU' }, { status: 500 })
    }

    const exists = (data?.length ?? 0) > 0
    return NextResponse.json({ isUnique: !exists, exists })
  } catch (error) {
    console.error('Error in check-sku endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
