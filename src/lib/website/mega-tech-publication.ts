import type { StorefrontCapabilities } from './storefront-capabilities'
import { isPublicRepairsAvailable, isPublicServicesPageAvailable } from './services'
import { hidesPublicPrice } from '@/lib/products/price-visibility'
import { withOrgQuery } from '@/lib/saas/tenant'
import type { PublicProduct } from '@/types/public'
import type { WebsiteSettings } from '@/types/website-settings'

export function resolveTechPublication(settings: WebsiteSettings | null, modules: Pick<StorefrontCapabilities, 'hasCatalog' | 'hasServices' | 'hasRepairs'>) {
  const services = modules.hasServices && isPublicServicesPageAvailable(settings?.company_info?.servicesPageEnabled, settings?.services)
  return {
    catalog: modules.hasCatalog,
    offers: modules.hasCatalog && Boolean(settings) && settings?.offers_section?.enabled !== false,
    repairs: modules.hasRepairs && isPublicRepairsAvailable(settings?.company_info, settings?.services),
    services,
    booking: services && settings?.booking_section?.enabled === true,
  }
}

export const techOffersKey = (slug: string) => withOrgQuery('/api/public/products?per_page=8&sort=newest&has_offer=true', slug)
export function hasTechOffer(product: PublicProduct) {
  return !hidesPublicPrice(product) && product.has_offer !== false && product.offer_price != null && product.offer_price > 0 && product.offer_price < product.sale_price
}

export function publishedPaymentLabels(checkout: WebsiteSettings['checkout'], controls?: Record<string, boolean>): string[] {
  const labels = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', digital_wallet: 'Billetera digital' }
  return (Object.keys(labels) as Array<keyof typeof labels>).flatMap(key => {
    const method = checkout?.payment?.[key]
    return method?.enabled === true && controls?.[key] === true ? [method.label?.trim() || labels[key]] : []
  })
}
