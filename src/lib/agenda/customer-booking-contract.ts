export type CustomerBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
export type CustomerBookingItem = {
  id: string
  serviceName: string
  startsAt: string
  endsAt: string
  status: CustomerBookingStatus
  professionalName: string | null
  store: { name: string; slug: string; timeZone: string; currency: string }
}
export type CustomerBookingPage = {
  items: CustomerBookingItem[]
  nextCursor: string | null
  kind: 'upcoming' | 'past'
}
export type CustomerBookingDetail = CustomerBookingItem & {
  price: number | null
  managePath: string | null
  attentionMode: 'local' | 'home' | null
  address: string | null
}
