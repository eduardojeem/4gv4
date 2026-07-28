import { redirect } from 'next/navigation'

export default function SubscriptionPaymentsPage() {
  redirect('/admin/subscriptions#payment-history')
}
