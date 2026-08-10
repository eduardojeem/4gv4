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
      .select('id, ticket_number, brand:device_brand, model:device_model, status, created_at, final_cost, estimated_cost, paid_amount, payment_status, completed_at, delivered_at')
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
      .select('id, order_number, status, payment_status, fulfillment_type, customer_address, estimated_delivery_date, total, created_at')
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
      .select('amount')
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

    return { 
      repairs: repairs || [],
      history: history || [],
      orders: recentOrders || [],
      ordersCount: ordersCount || 0,
      accountSummary,
    }
  } catch (error) {
    console.error('Error fetching customer data:', error)
    throw error
  }
}
