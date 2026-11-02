import type { Metadata } from 'next'
import { requireSuperAdmin } from '@/lib/superadmin/auth'
import { getFeedbackInbox, parseFeedbackFilters } from '@/lib/feedback/user-feedback'
import { FeedbackInbox } from '@/components/superadmin/feedback/FeedbackInbox'

export const metadata: Metadata = { title: 'Comentarios | Superadmin' }
export const dynamic = 'force-dynamic'

export default async function SuperAdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireSuperAdmin()
  const filters = parseFeedbackFilters(await searchParams)
  const inbox = await getFeedbackInbox(filters)
  return <FeedbackInbox filters={filters} {...inbox} />
}
