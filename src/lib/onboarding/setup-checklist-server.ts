import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveOnboardingChecklist } from './shared-setup'
import { getTenantAdminSettings } from '@/lib/organization/admin-settings'

/** Estado agregado, sin devolver PII ni datos financieros al dashboard. */
export async function loadOrganizationSetupChecklist(admin: SupabaseClient, organizationId: string) {
  const [settings, organization, branch, company, checkout, products, members] = await Promise.all([
    admin.from('organization_settings').select('country_code, display_name, modules').eq('organization_id', organizationId).maybeSingle(),
    admin.from('organizations').select('name, logo_url, storefront_public, marketplace_public').eq('id', organizationId).maybeSingle(),
    admin.from('branches').select('id').eq('organization_id', organizationId).eq('is_default', true).maybeSingle(),
    admin.from('website_settings').select('value').eq('organization_id', organizationId).eq('key', 'company_info').maybeSingle(),
    admin.from('website_settings').select('value').eq('organization_id', organizationId).eq('key', 'checkout').maybeSingle(),
    admin.from('products').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('is_active', true),
    admin.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'active'),
  ])
  const error = [settings, organization, branch, company, checkout, products, members].find((result) => result.error)
  if (error?.error) throw new Error('Could not load organization setup checklist')

  const companyInfo = company.data?.value && typeof company.data.value === 'object' ? company.data.value as Record<string, unknown> : {}
  const checkoutValue = checkout.data?.value && typeof checkout.data.value === 'object' ? checkout.data.value as Record<string, unknown> : {}
  const payment = checkoutValue.payment && typeof checkoutValue.payment === 'object' ? checkoutValue.payment as Record<string, unknown> : {}
  const paymentConfigured = Object.values(payment).some((method) => method && typeof method === 'object' && (method as Record<string, unknown>).enabled === true)
  const name = typeof settings.data?.display_name === 'string' ? settings.data.display_name : organization.data?.name
  return deriveOnboardingChecklist({
    countryCode: settings.data?.country_code,
    businessName: name,
    branchExists: Boolean(branch.data),
    logoExists: Boolean(organization.data?.logo_url || (typeof companyInfo.logoUrl === 'string' && companyInfo.logoUrl.trim())),
    productsCount: products.count ?? 0,
    memberCount: members.count ?? 0,
    paymentConfigured,
    // El RUC se carga en Configuración (admin_settings) o en la ficha de la web.
    billingConfigured: Boolean(getTenantAdminSettings(settings.data?.modules).companyRuc?.trim())
      || (typeof companyInfo.ruc === 'string' && companyInfo.ruc.trim().length > 0),
    storefrontConfigured: organization.data?.storefront_public === true,
    marketplaceConfigured: organization.data?.marketplace_public === true,
  })
}
