import { unstable_cache } from 'next/cache'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { EMPTY_ANNOUNCEMENT, normalizeAnnouncement, type Announcement } from '@/lib/announcements/announcement'

/**
 * El aviso del marketplace, que edita el superadmin. Vive junto a la marca de
 * la plataforma, en `system_settings.features`, y se lee sin sesion porque el
 * marketplace es publico.
 */
const ANNOUNCEMENT_KEY = 'marketplaceAnnouncement'

export const PLATFORM_ANNOUNCEMENT_TAG = 'platform:announcement'

export function getAnnouncementFromFeatures(features: unknown): Announcement {
  const record = (features && typeof features === 'object' ? features : {}) as Record<string, unknown>
  return normalizeAnnouncement(record[ANNOUNCEMENT_KEY] ?? EMPTY_ANNOUNCEMENT)
}

export function withAnnouncementInFeatures(features: unknown, announcement: Announcement) {
  const record = (features && typeof features === 'object' ? features : {}) as Record<string, unknown>
  return {
    ...record,
    [ANNOUNCEMENT_KEY]: normalizeAnnouncement(announcement),
  }
}

async function getPlatformAnnouncementUncached() {
  const admin = createAdminSupabase()
  const { data } = await admin
    .from('system_settings')
    .select('features')
    .eq('id', 'system')
    .maybeSingle()

  return getAnnouncementFromFeatures((data as { features?: unknown } | null)?.features)
}

export const getPlatformAnnouncement = unstable_cache(
  getPlatformAnnouncementUncached,
  ['platform-announcement'],
  { revalidate: 300, tags: [PLATFORM_ANNOUNCEMENT_TAG] }
)
