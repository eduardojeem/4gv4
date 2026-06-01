import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { normalizeOrder } from '@/lib/orders/helpers'
import { resolvePublicOrganization } from '@/lib/saas/public-tenant'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const admin = createAdminSupabase()
    const organization = await resolvePublicOrganization(request, admin)

    if (!organization) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) throw profileError

    const email = user.email?.trim().toLowerCase() || ''
    const phone = typeof profile?.phone === 'string' ? profile.phone.trim() : ''

    let customerQuery = admin
      .from('customers')
      .select('id')
      .eq('organization_id', organization.id)

    const customerFilters = [`profile_id.eq.${user.id}`]
    if (email) customerFilters.push(`email.ilike.${email}`)
    if (phone) customerFilters.push(`phone.eq.${phone}`)

    customerQuery = customerQuery.or(customerFilters.join(','))

    const { data: customers, error: customersError } = await customerQuery
    if (customersError) throw customersError

    const customerIds = (customers || [])
      .map((customer) => customer.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    const orderFilters: string[] = []
    if (customerIds.length > 0) {
      orderFilters.push(`customer_id.in.(${customerIds.join(',')})`)
    }
    if (email) orderFilters.push(`customer_email.ilike.${email}`)
    if (phone) orderFilters.push(`customer_phone.eq.${phone}`)

    if (orderFilters.length === 0) {
      return NextResponse.json({ success: true, data: { orders: [], organization } })
    }

    const { data: orders, error: ordersError } = await admin
      .from('customer_orders')
      .select('*, order_items:customer_order_items(*)')
      .eq('organization_id', organization.id)
      .or(orderFilters.join(','))
      .order('created_at', { ascending: false })
      .limit(50)

    if (ordersError) throw ordersError

    return NextResponse.json({
      success: true,
      data: {
        orders: (orders || []).map(normalizeOrder),
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo_url: organization.logo_url,
        },
      },
    })
  } catch (error) {
    logger.error('Authenticated public orders API error', { error })
    return NextResponse.json(
      { success: false, error: 'No se pudieron cargar tus pedidos.' },
      { status: 500 }
    )
  }
}
