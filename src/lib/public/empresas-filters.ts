import { normalizeCity, removeAccents } from '@/lib/public/city-normalizer'
import { rubroLabel } from '@/lib/public/organization-rubro'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

/**
 * Filtros del directorio de empresas (/marketplace/empresas).
 *
 * Viven acá, fuera del componente, para que los chips, el buscador y los
 * contadores usen las mismas reglas: antes los chips tenían nombres propios
 * («Indumentaria & Moda») distintos de los de las tarjetas («Moda & Retail»),
 * faltaba Barbería, y el buscador comparaba contra el código interno en inglés
 * (`electronics`), así que «tecnología» o «ropa» no encontraban nada.
 */

/** Orden de los chips. Un rubro que no esté acá igual aparece, al final. */
export const RUBRO_ORDER = ['tecnologia', 'indumentaria', 'alimentos', 'ferreteria', 'belleza', 'barberia', 'hogar', 'salud', 'automotor', 'comercio'] as const

/** Palabras con las que la gente busca cada rubro, además de su nombre. */
const RUBRO_KEYWORDS: Record<string, string> = {
  tecnologia: 'tecnologia celulares telefonos electronica computadoras informatica',
  indumentaria: 'indumentaria ropa moda calzados zapatos vestimenta',
  alimentos: 'alimentos comida gastronomia restaurante supermercado bebidas',
  ferreteria: 'ferreteria herramientas construccion obras materiales',
  belleza: 'belleza cosmetica estetica maquillaje spa unas',
  barberia: 'barberia peluqueria corte cabello',
  hogar: 'hogar muebles bazar decoracion',
  salud: 'salud farmacia',
  automotor: 'automotor autos motos repuestos',
  comercio: 'comercio general variedades',
}

export const DEFAULT_RUBRO = 'comercio'

export function organizationRubro(org: Pick<MarketplaceOrganization, 'rubro'>): string {
  return org.rubro || DEFAULT_RUBRO
}

export type EmpresasFilters = { query: string; rubro: string; city: string }

function matchesCity(org: MarketplaceOrganization, city: string): boolean {
  if (!city || city === 'all') return true
  const target = normalizeCity(city)?.key || removeAccents(city)
  const orgCity = normalizeCity(org.city)
  if (!orgCity) return false
  return orgCity.key === target || orgCity.display.toLowerCase() === city.toLowerCase()
}

function matchesRubro(org: MarketplaceOrganization, rubro: string): boolean {
  return !rubro || rubro === 'all' || organizationRubro(org) === rubro
}

export function matchesQuery(org: MarketplaceOrganization, query: string): boolean {
  const q = removeAccents(query)
  if (!q) return true
  const rubro = organizationRubro(org)
  const city = normalizeCity(org.city)
  const haystack = [
    org.name,
    org.slug,
    org.city,
    org.address,
    city?.display,
    city?.key,
    rubroLabel(rubro),
    RUBRO_KEYWORDS[rubro],
    org.business_vertical,
  ]
  return haystack.some((value) => Boolean(value) && removeAccents(String(value)).includes(q))
}

export function filterOrganizations(organizations: MarketplaceOrganization[], filters: EmpresasFilters, skip?: 'rubro' | 'city') {
  return organizations.filter((org) =>
    (skip === 'rubro' || matchesRubro(org, filters.rubro))
    && (skip === 'city' || matchesCity(org, filters.city))
    && matchesQuery(org, filters.query))
}

export type RubroFacet = { id: string; label: string; count: number }

/**
 * Los rubros que hay en el directorio, cada uno con cuántas tiendas quedan si
 * se lo elige con la búsqueda y la ciudad actuales. Antes el número se
 * contaba sobre todas las tiendas: con «celulares» quedaban 2 y el chip seguía
 * prometiendo 5.
 */
export function rubroFacets(organizations: MarketplaceOrganization[], filters: EmpresasFilters): RubroFacet[] {
  const present = new Set(organizations.map(organizationRubro))
  const counts = new Map<string, number>()
  for (const org of filterOrganizations(organizations, filters, 'rubro')) {
    const rubro = organizationRubro(org)
    counts.set(rubro, (counts.get(rubro) ?? 0) + 1)
  }
  const position = (id: string) => {
    const index = (RUBRO_ORDER as readonly string[]).indexOf(id)
    return index === -1 ? RUBRO_ORDER.length : index
  }
  return [...present]
    .sort((a, b) => position(a) - position(b) || a.localeCompare(b))
    .map((id) => ({ id, label: rubroLabel(id) ?? id, count: counts.get(id) ?? 0 }))
}

export type CityFacet = { key: string; display: string; count: number }

/** Las ciudades del directorio, contadas con la búsqueda y el rubro actuales. */
export function cityFacets(organizations: MarketplaceOrganization[], filters: EmpresasFilters): CityFacet[] {
  const map = new Map<string, CityFacet>()
  for (const org of organizations) {
    const city = normalizeCity(org.city)
    if (city && !map.has(city.key)) map.set(city.key, { key: city.key, display: city.display, count: 0 })
  }
  for (const org of filterOrganizations(organizations, filters, 'city')) {
    const city = normalizeCity(org.city)
    const facet = city ? map.get(city.key) : undefined
    if (facet) facet.count += 1
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
}

export const SORT_OPTIONS = [
  { id: 'destacadas', label: 'Destacadas' },
  { id: 'calificacion', label: 'Mejor calificadas' },
  { id: 'productos', label: 'Más productos' },
  { id: 'nombre', label: 'Nombre (A-Z)' },
] as const

export type SortId = (typeof SORT_OPTIONS)[number]['id']

export function parseSort(value: string | null | undefined): SortId {
  return SORT_OPTIONS.some((option) => option.id === value) ? (value as SortId) : 'destacadas'
}

/** «Destacadas» respeta el orden en que llegan del servidor. */
export function sortOrganizations(organizations: MarketplaceOrganization[], sort: SortId): MarketplaceOrganization[] {
  if (sort === 'destacadas') return organizations
  const sorted = [...organizations]
  if (sort === 'nombre') return sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  if (sort === 'productos') return sorted.sort((a, b) => (b.products_count ?? 0) - (a.products_count ?? 0))
  return sorted.sort((a, b) =>
    Number(b.review_rating_avg ?? 0) - Number(a.review_rating_avg ?? 0)
    || Number(b.review_count ?? 0) - Number(a.review_count ?? 0))
}
