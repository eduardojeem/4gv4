'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

export async function fetchCustomerActivity(customerIds: string[], organizationId: string | null) {
  try {
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    
    if (!user) {
      throw new Error('Unauthorized')
    }

    // Security check: ensure the requested customerIds actually belong to the authenticated user
    const { data: validCustomers } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', user.id)
      .in('id', customerIds)

    const validIds = validCustomers?.map(c => c.id) || []
    
    if (validIds.length === 0) {
      return { repairs: [], history: [] }
    }

    // BUG FIX: Bypass the restrictive branch RLS policy for repairs since customers do not have branch access.
    const adminSupabase = createAdminSupabase()
    
    let repairsQuery = adminSupabase
      .from('repairs')
      .select('status')
      .in('customer_id', validIds)
      
    if (organizationId) {
      repairsQuery = repairsQuery.eq('organization_id', organizationId)
    }
    
    const { data: repairs, error: repairsError } = await repairsQuery
    if (repairsError) throw repairsError

    let historyQuery = adminSupabase
      .from('repairs')
      .select('id, brand:device_brand, model:device_model, status, created_at, final_cost')
      .in('customer_id', validIds)
      .order('created_at', { ascending: false })
      .limit(5)
      
    if (organizationId) {
      historyQuery = historyQuery.eq('organization_id', organizationId)
    }
    
    const { data: history, error: historyError } = await historyQuery
    if (historyError) throw historyError

    let ordersQuery = adminSupabase
      .from('customer_orders')
      .select('id, order_number, status, payment_status, fulfillment_type, customer_address, estimated_delivery_date, total, created_at', { count: 'exact' })
      .in('customer_id', validIds)
      .order('created_at', { ascending: false })
      .limit(5)
      
    if (organizationId) {
      ordersQuery = ordersQuery.eq('organization_id', organizationId)
    }

    const { data: orders, count: ordersCount, error: ordersError } = await ordersQuery
    if (ordersError) throw ordersError

    return { 
      repairs: repairs || [], 
      history: history || [],
      orders: orders || [],
      ordersCount: ordersCount || 0
    }
  } catch (error) {
    console.error('Error fetching customer data:', error)
    throw error
  }
}
