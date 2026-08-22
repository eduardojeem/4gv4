import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { fetchCustomerActivity } from './actions'
import { headers } from 'next/headers'
import { getPublicTenantPathPrefix } from '@/lib/public/tenant-path'
import { ProfileClient } from './profile-client'
import { EMPTY_CUSTOMER_ACCOUNT_SUMMARY } from '@/lib/profile/customer-account-summary'
import type { ProfileOrder } from '@/components/profile/profile-orders'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'

interface RecentProfileRepair {
  id: string
  ticket_number?: string | null
  brand?: string
  model?: string
  status: string
  created_at: string
  final_cost?: number | null
  estimated_cost?: number | null
  paid_amount?: number | null
  payment_status?: string | null
}

export default async function CustomerProfilePage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user
  
  const headerStore = await headers()
  const tenantSlug = headerStore.get('x-tenant-slug')
  const tenantPrefix = await getPublicTenantPathPrefix()
  
  if (!user) {
    const profilePath = tenantPrefix ? `${tenantPrefix}/perfil` : '/perfil'
    const loginPath = tenantPrefix ? `${tenantPrefix}/cliente/login` : '/login'
    redirect(`${loginPath}?next=${encodeURIComponent(profilePath)}`)
  }

  let organizationId: string | null = null
  if (tenantSlug) {
    const organization = await resolvePublicOrganizationBySlug(tenantSlug, createAdminSupabase())
    if (!organization) notFound()
    organizationId = organization.id
  }

  const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  let stats = { totalRepairs: 0, activeRepairs: 0, readyRepairs: 0, deliveredRepairs: 0, totalOrders: 0 }
  let accountSummary = EMPTY_CUSTOMER_ACCOUNT_SUMMARY
  let recentRepairs: RecentProfileRepair[] = []
  let recentOrders: ProfileOrder[] = []

  const activity = await fetchCustomerActivity(organizationId)
  const { history, orders, ordersCount } = activity
  accountSummary = activity.accountSummary
  stats = {
    totalRepairs: accountSummary.equipment.total,
    activeRepairs: accountSummary.equipment.active,
    readyRepairs: accountSummary.equipment.ready,
    deliveredRepairs: accountSummary.equipment.delivered,
    totalOrders: ordersCount || 0,
  }
  recentRepairs = history || []
  recentOrders = (orders || []).map((order) => ({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    payment_status: order.payment_status,
    fulfillment_type: order.fulfillment_type,
    customer_address: order.customer_address,
    estimated_delivery_date: order.estimated_delivery_date,
    total: Number(order.total || 0),
    store_credit_reserved: Number(order.store_credit_reserved || 0),
    store_credit_applied: Number(order.store_credit_applied || 0),
    amount_due: String(order.payment_status).toUpperCase() === 'PAID'
      ? 0
      : Math.max(0, Number(order.total || 0) - Number(order.store_credit_reserved || 0) - Number(order.store_credit_applied || 0)),
    created_at: order.created_at,
  }))

  const profileData = {
    name: profileRow?.full_name || user.user_metadata?.full_name || '',
    email: user.email || '',
    phone: profileRow?.phone || user.user_metadata?.phone || '',
    avatarUrl: profileRow?.avatar_url || user.user_metadata?.avatar_url || '',
    location: profileRow?.location || '',
    createdAt: user.created_at || '',
    role: profileRow?.role || 'cliente'
  }

  return (
    <ProfileClient 
      initialData={profileData} 
      userId={user.id} 
      tenantPrefix={tenantPrefix} 
      stats={stats}
      accountSummary={accountSummary}
      recentRepairs={recentRepairs}
      recentOrders={recentOrders}
    />
  )
}
