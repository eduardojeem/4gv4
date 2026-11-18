'use client'

import { PackageCheck } from 'lucide-react'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { businessProductDetail, type BusinessDetailProduct } from '@/lib/products/business-product-detail'
import { ProductCatalogDetailsRead } from './ProductCatalogDetails'
import { ProductVisibilityControl, type ProductVisibilitySaved } from './ProductVisibilityControl'

export function ProductBusinessDetails({ product, variantId, selectedAttributes, onVisibilitySaved }: {
  product: BusinessDetailProduct & { id: string }
  variantId?: string
  selectedAttributes?: Record<string, unknown> | Array<{ attribute_name?: string; attribute_id?: string; value: string }>
  onVisibilitySaved?: ProductVisibilitySaved
}) {
  const { businessVertical, effectiveModules } = useSubscriptionStatus()
  const detail = businessProductDetail(product, businessVertical, selectedAttributes)
  return <div className="space-y-3">
    {(effectiveModules?.includes('inventory') || effectiveModules?.includes('services')) && <ProductCatalogDetailsRead key={product.id} productId={product.id} expiry={!detail.isService && effectiveModules?.includes('inventory') ? { expected: detail.tracksExpiry, variantId } : undefined} />}
    {onVisibilitySaved && <ProductVisibilityControl product={product} onSaved={onVisibilitySaved} />}
    <section className="space-y-3 rounded-xl border bg-muted/20 p-4" aria-label={`Detalles de ${detail.label}`}>
      <div><h3 className="flex items-center gap-2 text-sm font-semibold"><PackageCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />{detail.isService ? 'Información del servicio' : 'Características del producto'}</h3><p className="mt-1 text-xs text-muted-foreground">{detail.label}{selectedAttributes ? ' · Variante seleccionada' : ' · Datos registrados'}</p></div>
      {detail.rows.length ? <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">{detail.rows.map(row => <div key={row.label} className="min-w-0"><dt className="text-xs text-muted-foreground">{row.label}</dt><dd className="mt-0.5 break-words text-sm font-medium">{row.value}</dd></div>)}</dl> : <p className="text-xs text-muted-foreground">No hay características adicionales cargadas. Podés agregarlas al editar el producto y sus variantes.</p>}
      {detail.policies.length > 0 && <details className="border-t pt-3 text-sm"><summary className="cursor-pointer font-medium">Cobertura, cambios y devoluciones</summary><dl className="mt-3 space-y-3">{detail.policies.map(row => <div key={row.label}><dt className="text-xs font-semibold">{row.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{row.value}</dd></div>)}</dl></details>}
    </section>
    {detail.tracksExpiry && !effectiveModules?.includes('inventory') && <p className="text-xs text-muted-foreground">Para consultar lotes y vencimientos necesitás acceso al módulo Inventario.</p>}
  </div>
}
