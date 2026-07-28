import { redirect } from 'next/navigation'

export default function SubscriptionBillingPage() {
  redirect('/admin/subscriptions#billing-form')
}
