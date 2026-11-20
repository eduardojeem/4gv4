import { publicLocation, type MarketplaceLocation } from '../../../src/lib/public/marketplace-location';

/** Lo que devuelve la geocodificación inversa del celular (solo los campos que usamos). */
export type DeviceAddress = {
  isoCountryCode?: string | null;
  city?: string | null;
  district?: string | null;
  subregion?: string | null;
};

type LocationFacets = {
  countries: { code: string; label: string; count: number }[];
  allCities: { key: string; label: string; count: number; countryCode: string | null }[];
} | null | undefined;

export type NearbyMatch =
  | { kind: 'city'; selection: MarketplaceLocation; label: string }
  | { kind: 'country'; selection: MarketplaceLocation; label: string; city: string | null }
  | { kind: 'none'; city: string | null };

/**
 * Convierte la ubicación del celular en el filtro de ubicación del marketplace.
 * Las tiendas no tienen coordenadas: «cerca» es la misma ciudad y, si en tu
 * ciudad no hay tiendas, el mismo país.
 */
export function matchNearbyLocation(address: DeviceAddress | null | undefined, facets: LocationFacets): NearbyMatch {
  const country = address?.isoCountryCode?.trim().toUpperCase() || null;
  const candidates = [address?.city, address?.district, address?.subregion].filter((value): value is string => Boolean(value?.trim()));
  const cities = facets?.allCities ?? [];

  for (const candidate of candidates) {
    const location = publicLocation(country, candidate);
    if (!location) continue;
    const city = cities.find((item) => item.key === location.key);
    if (city) {
      return { kind: 'city', selection: { country: location.countryCode ?? 'unknown', city: city.key }, label: city.label };
    }
  }

  const deviceCity = candidates[0]?.trim() ?? null;
  const countryFacet = country ? facets?.countries.find((item) => item.code === country) : undefined;
  if (country && countryFacet) {
    return { kind: 'country', selection: { country, city: 'all' }, label: countryFacet.label, city: deviceCity };
  }
  return { kind: 'none', city: deviceCity };
}
