import { createAdminSupabase } from '@/lib/supabase/admin'
import { NotificationsDashboard, type GlobalNotification, type OrgOption } from '@/components/superadmin/NotificationsDashboard'

export const revalidate = 0

async function getData() {
  const admin = createAdminSupabase()

  const [notifResult, orgsResult, readsResult] = await Promise.all([
    admin
      .from('global_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    admin
      .from('organizations')
      .select('id, name, slug')
      .order('name'),
    admin
      .from('global_notification_reads')
      .select('notification_id, dismissed'),
  ])

  const readsByNotif = new Map<string, { readCount: number; dismissedCount: number }>()
  if (readsResult.data) {
    for (const r of readsResult.data as Array<{ notification_id: string; dismissed: boolean }>) {
      const prev = readsByNotif.get(r.notification_id) ?? { readCount: 0, dismissedCount: 0 }
      prev.readCount++
      if (r.dismissed) prev.dismissedCount++
      readsByNotif.set(r.notification_id, prev)
    }
  }

  const rawNotifications = (notifResult.data ?? []) as Array<Record<string, unknown>>
  const notifications: GlobalNotification[] = rawNotifications.map((n) => {
    const id = String(n.id)
    const stats = readsByNotif.get(id)
    return {
      id,
      title: String(n.title ?? ''),
      body: String(n.body ?? ''),
      type: (n.type ?? 'info') as GlobalNotification['type'],
      target: (n.target ?? 'all') as GlobalNotification['target'],
      target_org_ids: Array.isArray(n.target_org_ids) ? (n.target_org_ids as string[]) : null,
      status: (n.status ?? 'draft') as GlobalNotification['status'],
      scheduled_at: n.scheduled_at ? String(n.scheduled_at) : null,
      sent_at: n.sent_at ? String(n.sent_at) : null,
      created_at: String(n.created_at ?? ''),
      read_count: stats?.readCount ?? 0,
      dismissed_count: stats?.dismissedCount ?? 0,
    }
  })

  const organizations: OrgOption[] = (
    (orgsResult.data ?? []) as Array<{ id: string; name: string; slug?: string }>
  ).map(o => ({ id: o.id, name: o.name, slug: o.slug }))

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
