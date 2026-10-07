import { hasStoreWhatsapp } from '@/lib/whatsapp-number'
import type { CompanyInfo, PublicCommerceMode } from '@/types/website-settings'

export function resolvePublicationUpdate(
  current: { storefront_public: boolean | null; marketplace_public: boolean | null },
  update: { storefrontPublic?: boolean; marketplacePublic?: boolean },
) {
  const storefrontPublic = update.storefrontPublic ?? current.storefront_public === true
  return {
    storefrontPublic,
    marketplacePublic: storefrontPublic && (update.marketplacePublic ?? current.marketplace_public === true),
  }
}

export function getPublicationIssues(company: Partial<Pick<CompanyInfo, 'name' | 'phone' | 'whatsapp'>>, mode: PublicCommerceMode): string[] {
  const issues: string[] = []
  if (!company.name || company.name.trim().length < 2) issues.push('Completá el nombre comercial.')
  if ((company.phone?.replace(/\D/g, '').length ?? 0) < 6) issues.push('Completá un teléfono de contacto válido.')
  // La misma regla que usa la tienda: el WhatsApp o, si falta, el teléfono.
  if (mode === 'whatsapp' && !hasStoreWhatsapp(company)) {
    issues.push('Cargá un WhatsApp válido (por ejemplo 0981 123456) para recibir consultas.')
  }
  return issues
}
