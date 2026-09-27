import type { LandingAssessment, LandingCheckKey, LandingStatus } from '@/lib/superadmin/landing-readiness'
import type { StoreCommerce } from '@/lib/superadmin/landing-commerce'

/**
 * Filtros de la lista de tiendas.
 *
 * Antes había un solo filtro a la vez, repartido entre los cuadros de estado y
 * las barras de lo que falta: no se podía pedir «incompletas sin logo que
 * venden». Ahora se combinan: dentro de un mismo grupo alcanza con una opción
 * (incompleta o no publicada) y entre grupos tienen que cumplirse todos.
 *
 * Viven en la dirección de la página para poder compartirla o volver atrás.
 */

export const LANDING_STATUSES: LandingStatus[] = ['ready', 'incomplete', 'hidden', 'maintenance']
export const LANDING_CHECK_KEYS: LandingCheckKey[] = ['published', 'products', 'contact', 'logo', 'hero', 'banner', 'location', 'social']

export type LandingSalesFilter = 'all' | 'with' | 'without'
export type LandingVisibilityFilter = 'all' | 'marketplace' | 'hidden'
/** Cuándo se editó la página por última vez. */
export type LandingEditedFilter = 'all' | 'recent' | 'stale' | 'never'

/** Más de un mes sin tocar la página: probablemente la dejaron de atender. */
export const STALE_EDIT_DAYS = 30

export type LandingFilters = {
  q: string
  statuses: LandingStatus[]
  missing: LandingCheckKey[]
  sales: LandingSalesFilter
  visibility: LandingVisibilityFilter
  plans: string[]
  verticals: string[]
  edited: LandingEditedFilter
}

export const EMPTY_LANDING_FILTERS: LandingFilters = {
  q: '',
  statuses: [],
  missing: [],
  sales: 'all',
  visibility: 'all',
  plans: [],
  verticals: [],
  edited: 'all',
}

export const VERTICAL_LABELS: Record<string, string> = {
  general: 'Comercio general',
  clothing: 'Ropa y moda',
  cosmetics: 'Cosmética y belleza',
  electronics: 'Tecnología y celulares',
  food: 'Alimentos',
  hardware: 'Ferretería',
  other: 'Otros rubros',
}

export const verticalLabel = (value: string) => VERTICAL_LABELS[value] ?? value

type FilterableRow = {
  name: string
  slug: string
  marketplacePublic: boolean
  plan?: string | null
  vertical?: string | null
  assessment: LandingAssessment
}

const DAY = 86_400_000

/** Sin tildes ni mayúsculas: «raices» encuentra «Raíces». */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const planOf = (row: FilterableRow) => (row.plan || 'FREE').toUpperCase()
const verticalOf = (row: FilterableRow) => row.vertical || 'general'

export function editedBucket(lastUpdatedAt: string | null, now: number): Exclude<LandingEditedFilter, 'all'> {
  if (!lastUpdatedAt) return 'never'
  return now - new Date(lastUpdatedAt).getTime() > STALE_EDIT_DAYS * DAY ? 'stale' : 'recent'
}

const pickList = <T extends string>(value: string | undefined, allowed?: readonly T[]): T[] =>
  [...new Set((value ?? '').split(',').map((item) => item.trim()).filter((item): item is T =>
    Boolean(item) && (!allowed || (allowed as readonly string[]).includes(item))))]

const EDITED_PARAM: Record<Exclude<LandingEditedFilter, 'all'>, string> = { recent: 'reciente', stale: 'vieja', never: 'nunca' }

/** Lee los filtros de la dirección. Lo que no se reconoce se ignora. */
export function parseLandingFilters(params: Record<string, string | undefined>): LandingFilters {
  const edited = (Object.entries(EDITED_PARAM).find(([, value]) => value === params.editada)?.[0] ?? 'all') as LandingEditedFilter
  return {
    q: (params.q ?? '').slice(0, 80),
    statuses: pickList(params.estado, LANDING_STATUSES),
    missing: pickList(params.falta, LANDING_CHECK_KEYS),
    sales: params.ventas === 'con' ? 'with' : params.ventas === 'sin' ? 'without' : 'all',
    visibility: params.vitrina === 'si' ? 'marketplace' : params.vitrina === 'no' ? 'hidden' : 'all',
    plans: pickList(params.plan).map((plan) => plan.toUpperCase()).filter((plan) => /^[A-Z0-9_+-]{1,20}$/.test(plan)),
    verticals: pickList(params.rubro).filter((vertical) => /^[a-z_]{1,30}$/.test(vertical)),
    edited,
  }
}

/** Las claves de filtro en la dirección. */
export const LANDING_FILTER_PARAMS = ['q', 'estado', 'falta', 'ventas', 'vitrina', 'plan', 'rubro', 'editada']

/** Solo lo que no está en su valor por defecto, para que la dirección quede corta. */
export function serializeLandingFilters(filters: LandingFilters): Record<string, string> {
  const out: Record<string, string> = {}
  if (filters.q.trim()) out.q = filters.q.trim()
  if (filters.statuses.length) out.estado = filters.statuses.join(',')
  if (filters.missing.length) out.falta = filters.missing.join(',')
  if (filters.sales !== 'all') out.ventas = filters.sales === 'with' ? 'con' : 'sin'
  if (filters.visibility !== 'all') out.vitrina = filters.visibility === 'marketplace' ? 'si' : 'no'
  if (filters.plans.length) out.plan = filters.plans.join(',')
  if (filters.verticals.length) out.rubro = filters.verticals.join(',')
  if (filters.edited !== 'all') out.editada = EDITED_PARAM[filters.edited]
  return out
}

export function countActiveFilters(filters: LandingFilters): number {
  return (filters.q.trim() ? 1 : 0) + filters.statuses.length + filters.missing.length +
    (filters.sales !== 'all' ? 1 : 0) + (filters.visibility !== 'all' ? 1 : 0) +
    filters.plans.length + filters.verticals.length + (filters.edited !== 'all' ? 1 : 0)
}

export const storeHasSales = (sales: StoreCommerce | null | undefined) =>
  Boolean(sales && (sales.sold > 0 || sales.counterSales > 0 || sales.onlineOrders > 0))

type Facet = 'q' | 'statuses' | 'missing' | 'sales' | 'visibility' | 'plans' | 'verticals' | 'edited'

/**
 * Si la tienda pasa los filtros. `ignore` deja afuera un grupo: sirve para
 * contar cuántas quedarían al elegir otra opción de ese mismo grupo.
 */
export function matchesLandingFilters(
  row: FilterableRow,
  filters: LandingFilters,
  sales: StoreCommerce | null | undefined,
  now: number,
  ignore?: Facet,
): boolean {
  const needle = normalizeSearch(filters.q)
  if (ignore !== 'q' && needle && !normalizeSearch(row.name).includes(needle) && !normalizeSearch(row.slug).includes(needle)) return false
  if (ignore !== 'statuses' && filters.statuses.length && !filters.statuses.includes(row.assessment.status)) return false
  if (ignore !== 'missing' && filters.missing.length &&
    !row.assessment.checks.some((check) => !check.ok && filters.missing.includes(check.key))) return false
  if (ignore !== 'sales' && filters.sales !== 'all' && storeHasSales(sales) !== (filters.sales === 'with')) return false
  if (ignore !== 'visibility' && filters.visibility !== 'all' && row.marketplacePublic !== (filters.visibility === 'marketplace')) return false
  if (ignore !== 'plans' && filters.plans.length && !filters.plans.includes(planOf(row))) return false
  if (ignore !== 'verticals' && filters.verticals.length && !filters.verticals.includes(verticalOf(row))) return false
  if (ignore !== 'edited' && filters.edited !== 'all' && editedBucket(row.assessment.lastUpdatedAt, now) !== filters.edited) return false
  return true
}

export type LandingFacetCounts = {
  statuses: Record<LandingStatus, number>
  missing: Record<LandingCheckKey, number>
  sales: Record<Exclude<LandingSalesFilter, 'all'>, number>
  visibility: Record<Exclude<LandingVisibilityFilter, 'all'>, number>
  /** Solo los planes y rubros que tiene alguna tienda. */
  plans: Record<string, number>
  verticals: Record<string, number>
  edited: Record<Exclude<LandingEditedFilter, 'all'>, number>
}

/** Cuántas tiendas quedarían con cada opción, respetando los demás filtros. */
export function landingFacetCounts<R extends FilterableRow>(
  rows: R[],
  filters: LandingFilters,
  salesOf: (row: R) => StoreCommerce | null | undefined,
  now: number,
): LandingFacetCounts {
  const counts: LandingFacetCounts = {
    statuses: { ready: 0, incomplete: 0, hidden: 0, maintenance: 0 },
    missing: { published: 0, products: 0, contact: 0, logo: 0, hero: 0, banner: 0, location: 0, social: 0 },
    sales: { with: 0, without: 0 },
    visibility: { marketplace: 0, hidden: 0 },
    plans: {},
    verticals: {},
    edited: { recent: 0, stale: 0, never: 0 },
  }

  for (const row of rows) {
    const sales = salesOf(row)
    const passes = (facet: Facet) => matchesLandingFilters(row, filters, sales, now, facet)
    // Toda opción existente aparece, aunque con los filtros actuales quede en cero.
    counts.plans[planOf(row)] ??= 0
    counts.verticals[verticalOf(row)] ??= 0

    if (passes('statuses')) counts.statuses[row.assessment.status] += 1
    if (passes('missing')) for (const check of row.assessment.checks) if (!check.ok) counts.missing[check.key] += 1
    if (passes('sales')) counts.sales[storeHasSales(sales) ? 'with' : 'without'] += 1
    if (passes('visibility')) counts.visibility[row.marketplacePublic ? 'marketplace' : 'hidden'] += 1
    if (passes('plans')) counts.plans[planOf(row)] += 1
    if (passes('verticals')) counts.verticals[verticalOf(row)] += 1
    if (passes('edited')) counts.edited[editedBucket(row.assessment.lastUpdatedAt, now)] += 1
  }

  return counts
}

/** Agrega o saca una opción de un grupo de selección múltiple. */
export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

// ── Vistas rápidas ──────────────────────────────────────────────────────────

export type LandingPreset = {
  id: string
  label: string
  hint: string
  filters: Partial<LandingFilters>
  /** Necesita las métricas de ventas para tener sentido. */
  needsSales?: boolean
}

/** Las preguntas que se hacen seguido, a un toque. */
export const LANDING_PRESETS: LandingPreset[] = [
  {
    id: 'sin-productos',
    label: 'Publicadas sin productos',
    hint: 'Se puede entrar, pero no hay nada para comprar',
    filters: { statuses: ['incomplete'], missing: ['products'] },
  },
  {
    id: 'venden-incompletas',
    label: 'Venden y les falta algo',
    hint: 'Ya facturan: completar la página rinde enseguida',
    filters: { statuses: ['incomplete'], sales: 'with' },
    needsSales: true,
  },
  {
    id: 'listas-sin-ventas',
    label: 'Listas pero sin ventas',
    hint: 'La página está bien y no vendieron en el período',
    filters: { statuses: ['ready'], sales: 'without' },
    needsSales: true,
  },
  {
    id: 'abandonadas',
    label: 'Sin editar hace más de un mes',
    hint: 'Nadie tocó la página en más de 30 días',
    filters: { edited: 'stale' },
  },
  {
    id: 'no-publicadas',
    label: 'No publicadas',
    hint: 'Nadie puede entrar a la landing',
    filters: { statuses: ['hidden'] },
  },
]

export const presetFilters = (preset: LandingPreset): LandingFilters => ({ ...EMPTY_LANDING_FILTERS, ...preset.filters })

/** Si los filtros actuales son exactamente los de la vista rápida. */
export function isPresetActive(filters: LandingFilters, preset: LandingPreset): boolean {
  return JSON.stringify(serializeLandingFilters(filters)) === JSON.stringify(serializeLandingFilters(presetFilters(preset)))
}

// ── Exportar ────────────────────────────────────────────────────────────────

const csvCell = (value: unknown) => {
  const text = String(value ?? '')
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * La lista filtrada como CSV para abrir en Excel: punto y coma como separador
 * y marca BOM, que es lo que espera Excel en castellano para leer tildes.
 */
export function landingRowsToCsv<R extends FilterableRow & { activeProducts: number | null }>(
  rows: R[],
  salesOf: (row: R) => StoreCommerce | null | undefined,
  statusLabel: (status: LandingStatus) => string,
): string {
  const header = [
    'Tienda', 'Dirección', 'Estado', 'Puntos cumplidos', 'Le falta', 'Plan', 'Rubro', 'Marketplace',
    'Productos activos', 'Vendido (Gs.)', 'Ventas en local', 'Pedidos web', 'Visitantes', 'Conversión (%)', 'Última edición',
  ]
  const lines = rows.map((row) => {
    const sales = salesOf(row)
    const { assessment } = row
    return [
      row.name,
      `/${row.slug}`,
      statusLabel(assessment.status),
      `${assessment.checks.filter((check) => check.ok).length}/${assessment.checks.length}`,
      assessment.checks.filter((check) => !check.ok).map((check) => check.label).join(', '),
      planOf(row),
      verticalLabel(verticalOf(row)),
      row.marketplacePublic ? 'Sí' : 'No',
      row.activeProducts ?? '',
      sales ? Math.round(sales.sold) : '',
      sales?.counterSales ?? '',
      sales?.onlineOrders ?? '',
      sales?.visitors ?? '',
      sales?.conversion ?? '',
      assessment.lastUpdatedAt ? assessment.lastUpdatedAt.slice(0, 10) : 'Nunca',
    ].map(csvCell).join(';')
  })
  return `﻿${[header.map(csvCell).join(';'), ...lines].join('\r\n')}`
}
