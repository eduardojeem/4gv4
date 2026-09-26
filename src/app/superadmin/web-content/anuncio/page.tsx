import { MarketplaceAnnouncementsForm } from '@/components/superadmin/MarketplaceAnnouncementsForm'
import { getPlatformAnnouncementsUncached } from '@/lib/platform/announcement'

export const dynamic = 'force-dynamic'

export default async function MarketplaceAnnouncementPage() {
  const announcements = await getPlatformAnnouncementsUncached()
  return <MarketplaceAnnouncementsForm initial={announcements} />
}
