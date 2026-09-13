import { unstable_cache } from 'next/cache'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  MAX_PLATFORM_ANNOUNCEMENTS,
  normalizeAnnouncement,
  normalizeAnnouncementList,
  type Announcement,
} from '@/lib/announcements/announcement'

/**
 * El aviso del marketplace, que edita el superadmin. Vive junto a la marca de
 * la plataforma, en `system_settings.features`, y se lee sin sesion porque el
 * marketplace es publico.
 */
/** Antes habia un solo aviso; se sigue leyendo para no perderlo. */
const LEGACY_KEY = 'marketplaceAnnouncement'
const ANNOUNCEMENTS_KEY = 'marketplaceAnnouncements'

export const PLATFORM_ANNOUNCEMENT_TAG = 'platform:announcement'

export function getAnnouncementsFromFeatures(features: unknown): Announcement[] {
  const record = (features && typeof features === 'object' ? features : {}) as Record<string, unknown>
  const stored = record[ANNOUNCEMENTS_KEY] ?? record[LEGACY_KEY]
  return normalizeAnnouncementList(stored, MAX_PLATFORM_ANNOUNCEMENTS)
}

export function withAnnouncementsInFeatures(features: unknown, announcements: Announcement[]) {
  const record = (features && typeof features === 'object' ? features : {}) as Record<string, unknown>
  return {
    ...record,
    [ANNOUNCEMENTS_KEY]: announcements.slice(0, MAX_PLATFORM_ANNOUNCEMENTS).map(normalizeAnnouncement),
  }
}

async function getPlatformAnnouncementsUncached() {
  const admin = createAdminSupabase()
  const { data } = await admin
    .from('system_settings')
    .select('features')
    .eq('id', 'system')
    .maybeSingle()

  return getAnnouncementsFromFeatures((data as { features?: unknown } | null)?.features)
}

export const getPlatformAnnouncements = unstable_cache(
  getPlatformAnnouncementsUncached,
  ['platform-announcements'],
  { revalidate: 300, tags: [PLATFORM_ANNOUNCEMENT_TAG] }
)
