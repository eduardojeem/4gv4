import 'server-only'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { ALL_STORE_CUSTOMER_FEATURES, type StoreCustomerFeatures } from '@/lib/public/customer-access-copy'

/** Lo que una tienda ofrece a sus clientes, según sus módulos. */
export async function loadStoreCustomerFeatures(organizationSlug: string): Promise<StoreCustomerFeatures> {
  const organization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)
  if (!organization) return ALL_STORE_CUSTOMER_FEATURES
  const [repairs, credits, orders, services] = await Promise.all([
    isOrganizationModuleEnabled(organization.id, 'repairs'),
    isOrganizationModuleEnabled(organization.id, 'credits'),
    isOrganizationModuleEnabled(organization.id, 'orders'),
    isOrganizationModuleEnabled(organization.id, 'services'),
  ])
  return { repairs, credits, orders, services }
}
