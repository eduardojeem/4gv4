import { productFormProfile } from './vertical-product-form'
import { getVerticalAttributeSuggestions } from './vertical-attributes'

type AttributeValues = Record<string, unknown> | Array<{ attribute_name?: string; attribute_id?: string; value?: unknown }>
export type BusinessDetailProduct = {
  unit_measure?: string | null
  brand?: string | null
  device_brand?: string | null
  device_models?: string[] | null
  warranty_months?: number | null
  warranty_info?: string | null
  return_policy?: string | null
  exchange_policy?: string | null
  variant_attribute_config?: unknown
  variants?: Array<{ attributes?: unknown; is_active?: boolean | null; isActive?: boolean; active?: boolean }>
}

function entries(value: unknown): Array<[string, string]> {
  if (Array.isArray(value)) return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const key = item.attribute_name || item.attribute_id
    return typeof key === 'string' && typeof item.value === 'string' && item.value.trim() ? [[key, item.value.trim()] as [string, string]] : []
  })
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, val]) => typeof val === 'string' && val.trim() ? [[key, val.trim()] as [string, string]] : [])
}

/** Describe solo datos persistidos; el rubro cambia etiquetas, nunca inventa valores. */
export function businessProductDetail(product: BusinessDetailProduct, vertical?: string | null, selectedAttributes?: AttributeValues) {
  const profile = productFormProfile(vertical)
  const isService = product.unit_measure?.trim().toLowerCase() === 'servicio'
  const labels = new Map(getVerticalAttributeSuggestions(profile.vertical).map(attr => [attr.key, attr.label]))
  if (Array.isArray(product.variant_attribute_config)) for (const attr of product.variant_attribute_config) {
    if (typeof attr?.key === 'string' && typeof attr?.label === 'string') labels.set(attr.key, attr.label)
  }
  const values = new Map<string, Set<string>>()
  const attributeEntries = selectedAttributes !== undefined
    ? entries(selectedAttributes)
    : (product.variants ?? []).filter(v => v.is_active !== false && v.isActive !== false && v.active !== false).flatMap(v => entries(v.attributes))
  for (const [key, val] of attributeEntries) {
    if (!values.has(key)) values.set(key, new Set())
    values.get(key)!.add(val)
  }
  const rows = Array.from(values, ([key, vals]) => ({ label: labels.get(key) || key.replace(/_/g, ' '), value: [...vals].join(' · ') }))
  if (product.brand?.trim()) rows.unshift({ label: 'Marca', value: product.brand.trim() })
  const compatibility = [product.device_brand, ...(product.device_models ?? [])].filter(Boolean).join(' · ')
  if (compatibility) rows.push({ label: 'Compatible con', value: compatibility })
  if (product.warranty_months != null && product.warranty_months > 0) rows.push({ label: 'Garantía registrada', value: `${product.warranty_months} meses` })
  const policies = [
    { label: 'Cobertura', value: product.warranty_info },
    { label: 'Devoluciones', value: product.return_policy },
    { label: 'Cambios', value: product.exchange_policy },
  ].filter((row): row is { label: string; value: string } => typeof row.value === 'string' && Boolean(row.value.trim()))
  return { label: profile.label, isService, tracksExpiry: !isService && (profile.tracksExpiry || profile.vertical === 'barbershop' || profile.vertical === 'beauty_services'), rows, policies }
}
