import { NewOrderEntry } from '@/components/dashboard/orders/NewOrderEntry'
export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  const params = await searchParams
  return <NewOrderEntry expectedOrganizationId={params.organizationId} />
}
