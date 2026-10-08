import { loadStoreCustomerFeatures } from '@/lib/public/store-customer-features'
import TenantCustomerLoginClient from './login-client'

// Los textos dependen de lo que ofrece la tienda: sin taller no se habla de
// equipos ni reparaciones, sin créditos no se ofrecen cuotas.
export default async function Page({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params
  return <TenantCustomerLoginClient features={await loadStoreCustomerFeatures(organizationSlug)} />
}
