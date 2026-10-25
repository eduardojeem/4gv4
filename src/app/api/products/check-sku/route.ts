import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { moduleAccessResponse } from '@/lib/api/api-route-modules'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { findProductSku } from '@/lib/products/sku'

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
    {
      // El módulo de la sección (ver ROUTE_MODULES): apagado o fuera del plan, no responde.
      const denied = await moduleAccessResponse(organization.id, ['inventory', 'services'])
      if (denied) return denied
    }

    const sku = request.nextUrl.searchParams.get('sku')
    if (!sku?.trim()) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const excludeId = request.nextUrl.searchParams.get('excludeId') || undefined
    if (excludeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(excludeId)) {
      return NextResponse.json({ error: 'Id de producto inválido' }, { status: 400 })
    }
    const exists = Boolean(await findProductSku(supabase, organization.id, sku, excludeId))
    return NextResponse.json({ isUnique: !exists, exists })
  } catch (error) {
    console.error('Error in check-sku endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
