export type MarketplaceNavTab = 'inicio' | 'productos' | 'ofertas' | 'tiendas' | 'perfil';
export type MarketplaceBottomBarKey = 'inicio' | 'productos' | 'plus' | 'ofertas' | 'cuenta';

export type MarketplaceBottomTabItem = {
  key: MarketplaceBottomBarKey;
  label: string;
  icon: 'storefront-outline' | 'cube-outline' | 'add' | 'pricetag-outline' | 'person-outline';
  activeIcon: 'storefront' | 'cube' | 'close' | 'pricetag' | 'person';
  targetTab?: MarketplaceNavTab;
  isAction?: boolean;
  accessibilityLabel: string;
};

export type MarketplaceQuickActivityKey = 'orders' | 'repairs';

export type LocationFacetLike = {
  countries?: { code: string; label: string }[];
  allCities?: { key: string; label: string }[];
  cities?: { key: string; label: string }[];
} | null | undefined;

const VALID_TABS: readonly MarketplaceNavTab[] = ['inicio', 'productos', 'ofertas', 'tiendas', 'perfil'];

export function resolveInitialMarketplaceTab(paramTab?: string): MarketplaceNavTab {
  if (paramTab && (VALID_TABS as readonly string[]).includes(paramTab)) {
    return paramTab as MarketplaceNavTab;
  }
  return 'inicio';
}

export function marketplaceBottomTabs({ signedIn }: { signedIn: boolean }): MarketplaceBottomTabItem[] {
  return [
    {
      key: 'inicio',
      label: 'Inicio',
      icon: 'storefront-outline',
      activeIcon: 'storefront',
      targetTab: 'inicio',
      accessibilityLabel: 'Inicio del Marketplace',
    },
    {
      key: 'productos',
      label: 'Productos',
      icon: 'cube-outline',
      activeIcon: 'cube',
      targetTab: 'productos',
      accessibilityLabel: 'Catálogo de productos',
    },
    {
      key: 'plus',
      label: 'Explorar',
      icon: 'add',
      activeIcon: 'close',
      isAction: true,
      accessibilityLabel: 'Abrir accesos rápidos del Marketplace',
    },
    {
      key: 'ofertas',
      label: 'Ofertas',
      icon: 'pricetag-outline',
      activeIcon: 'pricetag',
      targetTab: 'ofertas',
      accessibilityLabel: 'Ver ofertas del Marketplace',
    },
    {
      key: 'cuenta',
      label: signedIn ? 'Mi Perfil' : 'Acceder',
      icon: 'person-outline',
      activeIcon: 'person',
      targetTab: 'perfil',
      accessibilityLabel: signedIn ? 'Abrir mi perfil' : 'Acceder a tu cuenta',
    },
  ];
}

export function isMarketplaceTabHighlighted(
  barKey: MarketplaceBottomBarKey,
  activeTab: MarketplaceNavTab,
  quickMenuOpen: boolean
): boolean {
  if (quickMenuOpen) return barKey === 'plus';
  switch (barKey) {
    case 'inicio':
      return activeTab === 'inicio';
    case 'productos':
      return activeTab === 'productos';
    case 'ofertas':
      return activeTab === 'ofertas';
    case 'cuenta':
      return activeTab === 'perfil';
    case 'plus':
      return false;
  }
}

export function marketplaceQuickActivityKeys(signedIn: boolean): MarketplaceQuickActivityKey[] {
  return signedIn ? ['orders', 'repairs'] : [];
}

export function formatMarketplaceLocationChip(
  selection: { country: string; city: string },
  facets?: LocationFacetLike
): string {
  if (selection.city !== 'all') {
    const match =
      facets?.allCities?.find((city) => city.key === selection.city) ??
      facets?.cities?.find((city) => city.key === selection.city);
    return match?.label ?? selection.city.split(':').pop() ?? 'Tu ciudad';
  }
  if (selection.country !== 'all') {
    const match = facets?.countries?.find((country) => country.code === selection.country);
    return match?.label ?? selection.country;
  }
  return 'Todas las zonas';
}
