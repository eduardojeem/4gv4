import type { ProductVariantInput } from './variant-contract'

export type VariantBulkAction = { type: 'price' | 'cost' | 'stock'; value: number } | { type: 'clearCost' } | { type: 'active'; value: boolean } | { type: 'sku'; base: string }
export const variantSelectionKey = (variant: ProductVariantInput) => variant.id ?? variant.clientKey

export function suggestVariantSku(base: string, variant: ProductVariantInput): string {
  const clean = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const suffix = Object.entries(variant.attributes).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => clean(value).slice(0, 3)).filter(Boolean).join('-')
  return `${clean(base).slice(0, 50) || 'VAR'}${suffix ? `-${suffix}` : ''}`
}

export function applyVariantBulkAction(
  variants: ProductVariantInput[], selected: Set<string>, action: VariantBulkAction,
  context: { canUpdateCost: boolean; branchId?: string | null },
): ProductVariantInput[] {
  if ((action.type === 'cost' || action.type === 'clearCost') && !context.canUpdateCost) throw new Error('No tenés permiso para modificar costos.')
  if (action.type === 'stock' && !context.branchId) throw new Error('Seleccioná una sucursal para asignar stock.')
  if ('value' in action && typeof action.value === 'number' && (!Number.isFinite(action.value) || action.value < 0 || (action.type === 'stock' && !Number.isInteger(action.value)))) throw new Error('Ingresá un valor válido, mayor o igual a cero.')
  const next = variants.map(variant => {
    if (!selected.has(variantSelectionKey(variant))) return variant
    switch (action.type) {
      case 'price': return { ...variant, salePrice: action.value }
      case 'cost': return { ...variant, purchasePrice: action.value }
      case 'clearCost': return { ...variant, purchasePrice: null }
      case 'stock': return { ...variant, stockQuantity: action.value }
      case 'active': return { ...variant, isActive: action.value }
      case 'sku': return { ...variant, sku: suggestVariantSku(action.base, variant) }
    }
  })
  if (action.type === 'sku') {
    const seen = new Set<string>()
    for (const variant of next) {
      const sku = variant.sku.trim().toLowerCase()
      if (seen.has(sku)) throw new Error('La sugerencia genera un SKU duplicado en el borrador. Ajustá los atributos o editá el SKU manualmente.')
      seen.add(sku)
    }
  }
  if (action.type === 'active' && !next.some(v => v.isActive)) throw new Error('Debe quedar al menos una variante activa.')
  return next
}
