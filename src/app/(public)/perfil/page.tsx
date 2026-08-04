import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchCustomerActivity } from './actions'
import { headers } from 'next/headers'
import { getPublicTenantPathPrefix } from '@/lib/public/tenant-path'
import { ProfileClient } from './profile-client'

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
    const { data: organization } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', tenantSlug)
      .maybeSingle()
    organizationId = organization?.id ?? null
  }

  const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  let customerQuery = supabase.from('customers').select('id').eq('profile_id', user.id)
  if (organizationId) customerQuery = customerQuery.eq('organization_id', organizationId)
  const { data: customerData } = await customerQuery

  const customerIds = (customerData || []).map(r => r.id).filter((id): id is string => typeof id === 'string' && id.length > 0)

  let stats = { totalRepairs: 0, activeRepairs: 0, completedRepairs: 0, totalOrders: 0 }
  let recentRepairs: any[] = []
  let recentOrders: any[] = []

  if (customerIds.length > 0) {
    const { repairs, history, orders, ordersCount } = await fetchCustomerActivity(customerIds, organizationId)
    const activeStatuses = ['recibido', 'diagnostico', 'reparacion', 'listo', 'pausado']
    stats = {
      totalRepairs: repairs?.length || 0,
      activeRepairs: repairs?.filter(r => activeStatuses.includes(r.status)).length || 0,
      completedRepairs: repairs?.filter(r => r.status === 'entregado').length || 0,
      totalOrders: ordersCount || 0,
    }
    recentRepairs = history || []
    recentOrders = (orders || []).map((order: any) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      fulfillment_type: order.fulfillment_type,
      customer_address: order.customer_address,
      estimated_delivery_date: order.estimated_delivery_date,
      total: Number(order.total || 0),
      created_at: order.created_at,
    }))
  }

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
      recentRepairs={recentRepairs}
      recentOrders={recentOrders}
    />
  )
}
