'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  calculateCustomerAccountSummary,
  EMPTY_CUSTOMER_ACCOUNT_SUMMARY,
} from '@/lib/profile/customer-account-summary'

export async function fetchCustomerActivity(organizationId: string | null) {
  try {
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    
    if (!user) {
      throw new Error('Unauthorized')
    }

    // Resolve customer records from the authenticated identity. Never accept
    // customer IDs from the browser or rely on customer-facing RLS for this lookup.
    const adminSupabase = createAdminSupabase()
    let validCustomersQuery = adminSupabase
      .from('customers')
      .select('id')
      .eq('profile_id', user.id)

    if (organizationId) {
      validCustomersQuery = validCustomersQuery.eq('organization_id', organizationId)
    }

    const { data: validCustomers, error: validCustomersError } = await validCustomersQuery
    if (validCustomersError) throw validCustomersError

    const validIds = validCustomers?.map(c => c.id) || []
    
    if (validIds.length === 0) {
      return {
        repairs: [],
        history: [],
        orders: [],
        ordersCount: 0,
        accountSummary: EMPTY_CUSTOMER_ACCOUNT_SUMMARY,
        storeCreditsByOrganization: [],
      }
    }

    // Customer accounts do not receive branch-level staff permissions, so all
    // reads below run server-side after the ownership and tenant checks above.
    let repairsFinancialQuery = adminSupabase
      .from('repairs')
      .select('status, final_cost, estimated_cost, paid_amount, payment_status')
      .in('customer_id', validIds)
      .or('is_deleted.is.null,is_deleted.eq.false')

    let recentRepairsQuery = adminSupabase
      .from('repairs')
      .select('id, ticket_number, brand:device_brand, model:device_model, status, created_at, final_cost, estimated_cost, paid_amount, payment_status, completed_at, delivered_at, organization_id')
      .in('customer_id', validIds)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at', { ascending: false })
      .limit(6)

    if (organizationId) {
      repairsFinancialQuery = repairsFinancialQuery.eq('organization_id', organizationId)
      recentRepairsQuery = recentRepairsQuery.eq('organization_id', organizationId)
    }

    let ordersFinancialQuery = adminSupabase
      .from('customer_orders')
      .select('status, payment_status, total', { count: 'exact' })
      .in('customer_id', validIds)

    let recentOrdersQuery = adminSupabase
      .from('customer_orders')
      .select('id, order_number, status, payment_status, fulfillment_type, customer_address, estimated_delivery_date, total, store_credit_reserved, store_credit_applied, created_at, organization_id')
      .in('customer_id', validIds)
      .order('created_at', { ascending: false })
      .limit(5)

    if (organizationId) {
      ordersFinancialQuery = ordersFinancialQuery.eq('organization_id', organizationId)
      recentOrdersQuery = recentOrdersQuery.eq('organization_id', organizationId)
    }

    let creditsQuery = adminSupabase
      .from('customer_credits')
      .select('status, credit_installments(amount, amount_paid, status, due_date)')
      .in('customer_id', validIds)
      .in('status', ['active', 'defaulted'])

    let storeCreditsQuery = adminSupabase
      .from('customer_store_credits')
      .select('amount, organization_id')
      .in('customer_id', validIds)

    if (organizationId) {
      creditsQuery = creditsQuery.eq('organization_id', organizationId)
      storeCreditsQuery = storeCreditsQuery.eq('organization_id', organizationId)
    }

    const [
      { data: repairs, error: repairsError },
      { data: history, error: historyError },
      { data: orders, count: ordersCount, error: ordersError },
      { data: recentOrders, error: recentOrdersError },
      { data: credits, error: creditsError },
      { data: storeCredits, error: storeCreditsError },
    ] = await Promise.all([
      repairsFinancialQuery,
      recentRepairsQuery,
      ordersFinancialQuery,
      recentOrdersQuery,
      creditsQuery,
      storeCreditsQuery,
    ])

    if (repairsError) throw repairsError
    if (historyError) throw historyError
    if (ordersError) throw ordersError
    if (recentOrdersError) throw recentOrdersError
    if (creditsError) throw creditsError
    if (storeCreditsError) {
      console.warn('Store credit balance is unavailable:', storeCreditsError.message)
    }

    const accountSummary = calculateCustomerAccountSummary({
      repairs: repairs || [],
      orders: orders || [],
      credits: credits || [],
      storeCreditMovements: storeCredits || [],
    })

    // Enrich history and recentOrders with organization details (name, slug, logo_url)
    const orgIds = Array.from(
      new Set(
        [
          ...(history || []).map((r: { organization_id?: string | null }) => r.organization_id),
          ...(recentOrders || []).map((o: { organization_id?: string | null }) => o.organization_id),
          ...(storeCredits || []).map((c: { organization_id?: string | null }) => c.organization_id),
        ].filter((id): id is string => Boolean(id))
      )
    )

    let orgMap = new Map<string, { id: string; name: string; slug: string; logo_url?: string | null }>()
    if (orgIds.length > 0) {
      const { data: orgsData } = await adminSupabase
        .from('organizations')
        .select('id, name, slug, logo_url')
        .in('id', orgIds)

      if (orgsData) {
        orgMap = new Map(orgsData.map((org) => [org.id, org]))
      }
    }

    const enrichedHistory = (history || []).map((r: any) => ({
      ...r,
      organization: r.organization_id ? orgMap.get(r.organization_id) || null : null,
    }))

    const enrichedOrders = (recentOrders || []).map((o: any) => ({
      ...o,
      organization: o.organization_id ? orgMap.get(o.organization_id) || null : null,
    }))

    // El saldo a favor no se puede sumar entre tiendas: lo que sobra en una no
    // se gasta en otra. Se devuelve abierto por organizacion para que el perfil
    // muestre de quien es cada guarani en vez de un total que nadie puede usar.
    const storeCreditTotals = new Map<string, number>()
    for (const movement of storeCredits || []) {
      const orgId = (movement as { organization_id?: string | null }).organization_id
      if (!orgId) continue
      const amount = Number((movement as { amount?: number | string | null }).amount || 0)
      if (!Number.isFinite(amount)) continue
      storeCreditTotals.set(orgId, (storeCreditTotals.get(orgId) || 0) + amount)
    }

    const storeCreditsByOrganization = Array.from(storeCreditTotals.entries())
      .map(([orgId, amount]) => ({ organization: orgMap.get(orgId) || null, amount }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    return { 
      repairs: repairs || [],
      history: enrichedHistory,
      orders: enrichedOrders,
      ordersCount: ordersCount || 0,
      accountSummary,
      storeCreditsByOrganization,
    }
  } catch (error) {
    console.error('Error fetching customer data:', error)
    throw error
  }
}
