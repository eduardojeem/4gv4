import { createAdminSupabase } from '@/lib/supabase/admin'
import { NotificationsDashboard, type GlobalNotification, type OrgOption } from '@/components/superadmin/NotificationsDashboard'

export const revalidate = 0

async function getData() {
  const admin = createAdminSupabase()

  const [notifResult, orgsResult] = await Promise.all([
    admin
      .from('global_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    admin
      .from('organizations')
      .select('id, name')
      .order('name'),
  ])

  const notifications: GlobalNotification[] = (notifResult.data ?? []) as GlobalNotification[]

  const organizations: OrgOption[] = (
    (orgsResult.data ?? []) as Array<{ id: string; name: string }>
  ).map(o => ({ id: o.id, name: o.name }))

  return { notifications, total: notifications.length, organizations }
}

export default async function SuperAdminNotificationsPage() {
  const { notifications, total, organizations } = await getData()
  return (
    <NotificationsDashboard
      notifications={notifications}
      total={total}
      organizations={organizations}
    />
  )
}
