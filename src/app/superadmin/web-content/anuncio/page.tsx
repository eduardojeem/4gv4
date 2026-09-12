import { MarketplaceAnnouncementForm } from '@/components/superadmin/MarketplaceAnnouncementForm'
import { getPlatformAnnouncement } from '@/lib/platform/announcement'

export const dynamic = 'force-dynamic'

export default async function MarketplaceAnnouncementPage() {
  const announcement = await getPlatformAnnouncement()
  return <MarketplaceAnnouncementForm initial={announcement} />
}
