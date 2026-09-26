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
  if (mode === 'whatsapp' && !/^[1-9]\d{7,14}$/.test(company.whatsapp?.replace(/\D/g, '') ?? '')) {
    issues.push('Configurá un WhatsApp válido con código de país para recibir consultas.')
  }
  return issues
}
