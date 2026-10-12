import type { MarketplaceOrganization } from '@/lib/public/marketplace'
import { rubroLabel } from '@/lib/public/organization-rubro'

/**
 * El directorio de /saas/negocios por páginas. El servidor arma la página con
 * la lista que ya tiene en caché y el navegador recibe solo esas tiendas, sin
 * los productos destacados que la tarjeta no usa.
 */

export const BUSINESS_DIRECTORY_PAGE_SIZE = 9
/** Tope del directorio que se pagina: la misma consulta (y caché) que /marketplace/empresas. */
export const BUSINESS_DIRECTORY_MAX_STORES = 120

export type DirectoryStore = Omit<MarketplaceOrganization, 'featured_products'>

export interface BusinessDirectorySummary {
  stores: number
  cities: number
  products: number
  /** Rubros con tiendas publicadas y cuántas hay de cada uno, de mayor a menor. */
  rubros: Array<[string, number]>
}

export interface BusinessDirectoryPage {
  items: DirectoryStore[]
  /** Tiendas que cumplen el filtro y la búsqueda. */
  total: number
  page: number
  pageSize: number
  pageCount: number
  /** De todas las tiendas publicadas, sin filtro: para las cifras y los rubros. */
  summary: BusinessDirectorySummary
}

export interface BusinessDirectoryQuery {
  page?: number
  rubro?: string | null
  q?: string | null
  pageSize?: number
}

/** «ENCARNACION» y «Encarnación» son la misma ciudad. */
export function cityKey(city?: string | null) {
  return (city ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Primero las tiendas con más productos publicados; a igualdad, las que tienen logo; después por nombre. */
export function compareShowcase(a: DirectoryStore, b: DirectoryStore) {
  return (b.products_count ?? 0) - (a.products_count ?? 0)
    || Number(Boolean(b.logo_url)) - Number(Boolean(a.logo_url))
    || a.name.localeCompare(b.name, 'es')
}

export function summarizeDirectory(stores: DirectoryStore[]): BusinessDirectorySummary {
  const cities = new Set(stores.map((store) => cityKey(store.city)).filter(Boolean))
  const rubros = new Map<string, number>()
  for (const store of stores) {
    if (!store.rubro || !rubroLabel(store.rubro)) continue
    rubros.set(store.rubro, (rubros.get(store.rubro) ?? 0) + 1)
  }
  return {
    stores: stores.length,
    cities: cities.size,
    products: stores.reduce((total, store) => total + (store.products_count ?? 0), 0),
    rubros: [...rubros.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  }
}

function matchesQuery(store: DirectoryStore, q: string) {
  if (!q) return true
  return [store.name, store.city, store.slogan, rubroLabel(store.rubro)]
    .some((value) => (value ?? '').toLowerCase().includes(q))
}

/** La página pedida, con el filtro y la búsqueda aplicados. Una página fuera de rango devuelve la última. */
export function pageDirectory(stores: Array<DirectoryStore | MarketplaceOrganization>, query: BusinessDirectoryQuery = {}): BusinessDirectoryPage {
  const all = stores.map(({ featured_products: _featured, ...store }: DirectoryStore & { featured_products?: unknown }) => store as DirectoryStore)
  const pageSize = Math.min(Math.max(Math.trunc(query.pageSize ?? BUSINESS_DIRECTORY_PAGE_SIZE), 1), 48)
  const rubro = query.rubro && query.rubro !== 'all' ? query.rubro : null
  const q = (query.q ?? '').trim().toLowerCase().slice(0, 60)

  const filtered = all
    .filter((store) => (!rubro || store.rubro === rubro) && matchesQuery(store, q))
    .sort(compareShowcase)
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(Math.max(Math.trunc(query.page ?? 1) || 1, 1), pageCount)

  return {
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    pageCount,
    summary: summarizeDirectory(all),
  }
}

/**
 * Desde cuánto una cifra suma en vez de restar. La página busca que un comercio
 * se sume: «10 negocios» o «2 ciudades» dicen «esto recién empieza». Cada cifra
 * aparece sola cuando llega a su mínimo; mientras tanto la portada muestra los
 * negocios reales.
 */
export const DIRECTORY_STAT_MINIMUMS = { stores: 30, cities: 5, products: 1000 } as const

export type DirectoryStat = { key: keyof typeof DIRECTORY_STAT_MINIMUMS; value: number; label: string }

export function visibleDirectoryStats(summary: Pick<BusinessDirectorySummary, 'stores' | 'cities' | 'products'>): DirectoryStat[] {
  const stats: DirectoryStat[] = [
    { key: 'stores', value: summary.stores, label: summary.stores === 1 ? 'negocio publicado' : 'negocios publicados' },
    { key: 'cities', value: summary.cities, label: summary.cities === 1 ? 'ciudad' : 'ciudades' },
    { key: 'products', value: summary.products, label: summary.products === 1 ? 'producto publicado' : 'productos publicados' },
  ]
  return stats.filter((stat) => stat.value >= DIRECTORY_STAT_MINIMUMS[stat.key])
}

/** Hasta seis negocios con logo, para la portada mientras no haya cifras que mostrar. */
export function showcaseLogos(stores: DirectoryStore[], limit = 6): DirectoryStore[] {
  return stores.filter((store) => Boolean(store.logo_url)).slice(0, limit)
}
