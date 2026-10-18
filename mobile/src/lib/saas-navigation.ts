export const SAAS_SECTIONS = [
  { key: 'inicio', label: 'Inicio', href: '/saas', icon: 'home-outline' },
  { key: 'soluciones', label: 'Soluciones', href: '/saas/soluciones', icon: 'grid-outline' },
  { key: 'negocios', label: 'Negocios', href: '/saas/negocios', icon: 'storefront-outline' },
  { key: 'planes', label: 'Planes', href: '/saas/planes', icon: 'pricetags-outline' },
] as const;

export type SaasSection = typeof SAAS_SECTIONS[number]['key'];

export function getSaasSection(pathname: string): SaasSection | null {
  const path = pathname.replace(/\/$/, '');
  return SAAS_SECTIONS.find((section) => section.href === path)?.key ?? null;
}

/** Misma política de enlaces HTTP(S) que el branding público de la web. */
export function resolveSaasHref(href: string, siteUrl: string): string | null {
  const value = href.trim();
  if (!value || value.includes('\\') || value.startsWith('//')) return null;
  try {
    const url = new URL(value, siteUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch {
    return null;
  }
}
