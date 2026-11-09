import type { createAdminSupabase } from '@/lib/supabase/admin'

/**
 * Avisos que el superadmin publica para las tiendas (`global_notifications`),
 * con la lectura y el descarte de cada usuario (`global_notification_reads`).
 * Los usan la campana del panel web y la pantalla de notificaciones de la app.
 */

type AdminClient = ReturnType<typeof createAdminSupabase>

export type GlobalAnnouncementType = 'info' | 'warning' | 'success' | 'danger'

export type GlobalAnnouncementItem = {
  id: string
  title: string
  body: string
  type: GlobalAnnouncementType
  read: boolean
  timestamp: string
}

type GlobalNotificationRow = {
  id: string
  title: string
  body: string
  type: GlobalAnnouncementType
  sent_at: string | null
  created_at: string
}

/** Cuántos avisos recientes se muestran (los más viejos dejan de aparecer). */
export const GLOBAL_ANNOUNCEMENTS_LIMIT = 50

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Publicados para todas las tiendas o para esta organización, del más nuevo al más viejo. */
async function loadVisibleRows(admin: AdminClient, organizationId: string) {
  if (!UUID_PATTERN.test(organizationId)) return { rows: [] as GlobalNotificationRow[], error: null }
  const { data, error } = await admin
    .from('global_notifications')
    .select('id, title, body, type, sent_at, created_at')
    .eq('status', 'sent')
    .or(`target.eq.all,target_org_ids.cs.{${organizationId}}`)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(GLOBAL_ANNOUNCEMENTS_LIMIT)
  return { rows: (data ?? []) as GlobalNotificationRow[], error }
}

async function loadReads(admin: AdminClient, userId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, { dismissed: boolean }>()
  const { data } = await admin
    .from('global_notification_reads')
    .select('notification_id, dismissed')
    .eq('user_id', userId)
    .in('notification_id', ids)
  return new Map((data ?? []).map((r) => [r.notification_id as string, { dismissed: Boolean(r.dismissed) }]))
}

/** Avisos visibles para el usuario (sin los que descartó), con su estado de lectura. */
export async function loadGlobalAnnouncements(
  admin: AdminClient,
  organizationId: string,
  userId: string,
): Promise<{ items: GlobalAnnouncementItem[]; error: unknown }> {
  const { rows, error } = await loadVisibleRows(admin, organizationId)
  if (error) return { items: [], error }
  const reads = await loadReads(admin, userId, rows.map((r) => r.id))
  const items = rows
    .filter((r) => !reads.get(r.id)?.dismissed)
    .map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      type: r.type,
      read: reads.has(r.id),
      timestamp: r.sent_at ?? r.created_at,
    }))
  return { items, error: null }
}

export function countUnreadAnnouncements(items: GlobalAnnouncementItem[]): number {
  return items.filter((item) => !item.read).length
}

/**
 * Marca avisos como leídos (`ids` o todos los visibles) o los descarta.
 * Solo acepta avisos que esta organización puede ver. Marcar como leído no
 * deshace un descarte.
 */
export async function markGlobalAnnouncements(
  admin: AdminClient,
  input: { organizationId: string; userId: string; ids: string[] | 'all'; dismiss: boolean },
): Promise<{ updated: number; error: unknown }> {
  const { rows, error } = await loadVisibleRows(admin, input.organizationId)
  if (error) return { updated: 0, error }
  const visible = new Set(rows.map((r) => r.id))
  const targets = input.ids === 'all' ? [...visible] : input.ids.filter((id) => visible.has(id))
  if (targets.length === 0) return { updated: 0, error: null }

  const now = new Date().toISOString()
  const payload = targets.map((id) => ({
    notification_id: id,
    user_id: input.userId,
    read_at: now,
    ...(input.dismiss ? { dismissed: true } : {}),
  }))
  const { error: upsertError } = await admin
    .from('global_notification_reads')
    .upsert(payload, { onConflict: 'notification_id,user_id', ignoreDuplicates: !input.dismiss })
  return { updated: upsertError ? 0 : targets.length, error: upsertError }
}
