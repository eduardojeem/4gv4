import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import type { ProductVariantsPayload } from '@/lib/products/variant-contract'

export function ProductVariantReview({ value }: { value: ProductVariantsPayload }) {
  if (!value.hasVariants) return <p className="text-sm text-muted-foreground">Producto simple, sin variantes.</p>

  const stock = value.variants.reduce((total, variant) => total + variant.stockQuantity, 0)
  const prices = value.variants.map((variant) => variant.salePrice)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0

  return (
    <div className="grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-3 dark:bg-slate-900/40">
      <div><p className="text-xs text-muted-foreground">Variantes</p><Badge className="mt-1">{value.variants.length}</Badge></div>
      <div><p className="text-xs text-muted-foreground">Stock total</p><p className="font-semibold">{stock} unidades</p></div>
      <div><p className="text-xs text-muted-foreground">Rango de venta</p><p className="font-semibold">{minPrice === maxPrice ? formatCurrency(minPrice) : `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`}</p></div>
    </div>
  )
}
