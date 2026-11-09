import type { Metadata } from 'next'
import { BookingPageContent, bookingPageMetadata, serviceFromSearchParams } from '@/components/public/agenda/booking-page'

type Props = { params: Promise<{ organizationSlug: string }>; searchParams?: Promise<{ servicio?: string | string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { organizationSlug } = await params
  return bookingPageMetadata(organizationSlug)
}

export default async function BookingPage({ params, searchParams }: Props) {
  const { organizationSlug } = await params
  return <BookingPageContent slug={organizationSlug} initialServiceId={serviceFromSearchParams(await searchParams)} />
}
