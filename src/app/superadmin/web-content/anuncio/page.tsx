import { MarketplaceAnnouncementsForm } from '@/components/superadmin/MarketplaceAnnouncementsForm'
import { getPlatformAnnouncements } from '@/lib/platform/announcement'

export const dynamic = 'force-dynamic'

export default async function MarketplaceAnnouncementPage() {
  const announcements = await getPlatformAnnouncements()
  return <MarketplaceAnnouncementsForm initial={announcements} />
}
