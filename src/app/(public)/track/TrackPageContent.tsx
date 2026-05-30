import { headers } from 'next/headers'
import { TrackOrderClient } from '@/components/public/orders/TrackOrderClient'

export async function TrackPageContent() {
  const headerStore = await headers()
  const organizationSlug = headerStore.get('x-tenant-slug')

  return <TrackOrderClient organizationSlug={organizationSlug} />
}
