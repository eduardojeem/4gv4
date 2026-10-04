import {
  deviceModelSortKey,
  normalizeDeviceBrand,
  normalizeDeviceModel,
} from '@/lib/products/device-compatibility'
import type { DeviceOptions } from '@/lib/products/device-options'

/**
 * Catálogo global de modelos de equipos (tabla `global_device_models`).
 *
 * Cada tienda sugería marca y modelo solo con lo que ella misma ya había
 * cargado: una tienda nueva no tenía ninguna sugerencia y cada una escribía
 * «iPhone 13» a su manera. La plataforma mantiene una lista común que se suma
 * a la de cada tienda.
 */

export const DEVICE_TYPES = ['smartphone', 'tablet', 'laptop', 'watch', 'other'] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  smartphone: 'Celular',
  tablet: 'Tablet',
  laptop: 'Notebook',
  watch: 'Reloj',
  other: 'Otro',
}

export type GlobalDeviceModel = {
  id: string
  global_brand_id?: string | null
  brand: string
  global_brands?: { name: string } | Array<{ name: string }> | null
  model: string
  device_type: DeviceType
  aliases: string[] | null
  release_year: number | null
  is_active: boolean
}

/** Usa la relación nueva y conserva `brand` como fallback para filas históricas. */
export function resolveGlobalDeviceModelBrand(model: Pick<GlobalDeviceModel, 'brand' | 'global_brands'>): string {
  const related = Array.isArray(model.global_brands) ? model.global_brands[0] : model.global_brands
  return related?.name?.trim() || model.brand
}

export type UsageRows = {
  products: Array<{ organization_id: string | null; device_brand: string | null; device_models: string[] | null }>
  repairs: Array<{ organization_id: string | null; device_brand: string | null; device_model: string | null }>
}

export type DeviceModelCandidate = {
  brand: string
  model: string
  /** Veces que aparece en productos y reparaciones. */
  uses: number
  /** Tiendas distintas que lo usan. */
  stores: number
}

const key = (brand: string, model: string) => `${brand.toLowerCase()}|${model.toLowerCase()}`

/** Claves por las que un modelo del catálogo reconoce lo que escriben las tiendas. */
export function catalogKeys(catalog: GlobalDeviceModel[]): Map<string, GlobalDeviceModel> {
  const keys = new Map<string, GlobalDeviceModel>()
  for (const item of catalog) {
    const brand = normalizeDeviceBrand(resolveGlobalDeviceModelBrand(item))
    if (!brand) continue
    for (const name of [item.model, ...(item.aliases ?? [])]) {
      const model = normalizeDeviceModel(name)
      if (model) keys.set(key(brand, model), item)
    }
  }
  return keys
}

/** Cada par marca/modelo que cargaron las tiendas, ya normalizado. */
function usagePairs(rows: UsageRows) {
  const pairs: Array<{ brand: string; model: string; organizationId: string | null }> = []
  const add = (rawBrand: string | null, rawModel: string | null, organizationId: string | null) => {
    const brand = normalizeDeviceBrand(rawBrand)
    const model = normalizeDeviceModel(rawModel)
    if (brand && model) pairs.push({ brand, model, organizationId })
  }
  for (const row of rows.products) for (const model of row.device_models ?? []) add(row.device_brand, model, row.organization_id)
  for (const row of rows.repairs) add(row.device_brand, row.device_model, row.organization_id)
  return pairs
}

/**
 * Lo que las tiendas ya usan: cuántas tiendas usan cada modelo del catálogo y
 * los modelos que usan pero el catálogo todavía no tiene (para sumarlos).
 */
export function summarizeDeviceUsage(rows: UsageRows, catalog: GlobalDeviceModel[]) {
  const keys = catalogKeys(catalog)
  const storesByCatalog = new Map<string, Set<string>>()
  const candidates = new Map<string, { brand: string; model: string; uses: number; stores: Set<string> }>()

  for (const pair of usagePairs(rows)) {
    const match = keys.get(key(pair.brand, pair.model))
    if (match) {
      const stores = storesByCatalog.get(match.id) ?? new Set<string>()
      if (pair.organizationId) stores.add(pair.organizationId)
      storesByCatalog.set(match.id, stores)
      continue
    }
    const candidateKey = key(pair.brand, pair.model)
    const entry = candidates.get(candidateKey) ?? { brand: pair.brand, model: pair.model, uses: 0, stores: new Set<string>() }
    entry.uses += 1
    if (pair.organizationId) entry.stores.add(pair.organizationId)
    candidates.set(candidateKey, entry)
  }

  return {
    storesByModel: new Map([...storesByCatalog].map(([id, stores]) => [id, stores.size])),
    candidates: [...candidates.values()]
      .map((entry): DeviceModelCandidate => ({ brand: entry.brand, model: entry.model, uses: entry.uses, stores: entry.stores.size }))
      .sort((a, b) => b.stores - a.stores || b.uses - a.uses || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model)),
  }
}

/** Ordena el catálogo por marca y, dentro de cada marca, en orden de modelo. */
export function sortDeviceModels<T extends Pick<GlobalDeviceModel, 'brand' | 'model'> & Partial<Pick<GlobalDeviceModel, 'global_brands'>>>(catalog: T[]): T[] {
  return [...catalog].sort((a, b) =>
    resolveGlobalDeviceModelBrand(a).localeCompare(resolveGlobalDeviceModelBrand(b), 'es') ||
    deviceModelSortKey(a.model).localeCompare(deviceModelSortKey(b.model), 'es') ||
    a.model.localeCompare(b.model, 'es'))
}

/**
 * Suma el catálogo global a las sugerencias de una tienda. Lo de la tienda va
 * primero (es lo que más usa); las marcas y modelos del catálogo que no tenía
 * se agregan después, así una tienda nueva no arranca con la lista vacía.
 */
export function mergeCatalogIntoOptions(options: DeviceOptions, catalog: GlobalDeviceModel[]): DeviceOptions {
  const brands = [...options.brands]
  const modelsByBrand: Record<string, string[]> = Object.fromEntries(
    Object.entries(options.modelsByBrand).map(([brand, models]) => [brand, [...models]]),
  )

  for (const item of sortDeviceModels(catalog.filter((entry) => entry.is_active))) {
    const brand = normalizeDeviceBrand(resolveGlobalDeviceModelBrand(item))
    const model = normalizeDeviceModel(item.model)
    if (!brand || !model) continue
    if (!brands.includes(brand)) brands.push(brand)
    const models = modelsByBrand[brand] ?? []
    if (!models.some((existing) => existing.toLowerCase() === model.toLowerCase())) models.push(model)
    modelsByBrand[brand] = models
  }

  for (const brand of Object.keys(modelsByBrand)) {
    modelsByBrand[brand] = [...modelsByBrand[brand]].sort(
      (a, b) => deviceModelSortKey(a).localeCompare(deviceModelSortKey(b), 'es') || a.localeCompare(b, 'es'),
    )
  }
  return { brands, modelsByBrand }
}
