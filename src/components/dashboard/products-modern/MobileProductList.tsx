import React from 'react'
import { Edit, MoreVertical, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/currency'
import { isServiceLikeProduct } from '@/lib/products-dashboard-utils'
import type { ProductGridProps } from './ProductGrid'
import { AppImage } from '@/components/ui/app-image'
import { cn } from '@/lib/utils'

function ProductThumbnail({ src }: { src?: string }) {
  const [failed, setFailed] = React.useState(false)
  return <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-muted/40 p-1">
    {src && !failed ? <AppImage src={src} alt="" width={64} height={64} sizes="64px" className="h-full w-full object-contain" onError={() => setFailed(true)} /> : <Package className="h-7 w-7 text-muted-foreground" aria-hidden="true" />}
  </div>
}

export function MobileProductList(props: ProductGridProps) {
  if (props.loading) return <p role="status" className="py-8 text-center">Cargando productos…</p>
  return <ul aria-label="Productos" className="space-y-3">
    {props.products.map(product => {
      const stock = product.variants?.length
        ? product.variants.reduce((sum, variant) => sum + Number('stockQuantity' in variant ? variant.stockQuantity : variant.stock_quantity ?? 0), 0)
        : Number(product.stock_quantity ?? 0)
      const prices = product.variants?.map(variant => Number('salePrice' in variant ? variant.salePrice : variant.sale_price ?? product.sale_price)) ?? []
      const priceLabel = prices.length ? (Math.min(...prices) === Math.max(...prices) ? formatCurrency(prices[0]) : `${formatCurrency(Math.min(...prices))} – ${formatCurrency(Math.max(...prices))}`) : formatCurrency(product.sale_price)
      const selected = props.selectedProductIds.includes(product.id)
      return <li key={product.id} className={cn('min-w-0 rounded-xl border bg-card text-card-foreground', selected && 'border-primary ring-1 ring-primary')}>
        <div className="flex items-center justify-between border-b px-2">
        <label className="flex min-h-11 min-w-11 items-center gap-2 px-1">
          <input type="checkbox" className="h-5 w-5 accent-blue-600" aria-label={`Seleccionar ${product.name}`} checked={props.selectedProductIds.includes(product.id)} onChange={() => props.onProductSelect(product.id)} />
          <span className="text-xs text-muted-foreground">{selected ? 'Seleccionado' : 'Seleccionar'}</span>
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={`Acciones de ${product.name}`}><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="min-h-11" onSelect={() => props.onProductViewDetails(product)}>Ver detalle</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onSelect={() => props.onProductEdit(product)}>Editar</DropdownMenuItem>
            <DropdownMenuItem className="min-h-11" onSelect={() => props.onProductDuplicate(product)}>Duplicar</DropdownMenuItem>
            {props.onProductToggleActive && <DropdownMenuItem className="min-h-11" onSelect={() => props.onProductToggleActive?.(product, product.is_active === false)}>{product.is_active === false ? 'Activar' : 'Desactivar'}</DropdownMenuItem>}
            <DropdownMenuItem className="min-h-11 text-destructive" onSelect={() => props.onProductDelete(product)}>Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
        <div className="flex min-w-0 items-start gap-3 p-3">
          <ProductThumbnail key={product.images?.[0] || product.image || product.image_url} src={product.images?.[0] || product.image || product.image_url} />
          <div className="min-w-0 flex-1">
            <button type="button" className="min-h-11 w-full text-left text-sm font-semibold leading-snug break-words focus-visible:outline-2 focus-visible:outline-primary" onClick={() => props.onProductViewDetails(product)}>{product.name}</button>
            <p className="truncate text-xs text-muted-foreground" title={product.sku || undefined}>{product.sku || 'Sin SKU'}</p>
            {product.variants?.length ? <p className="mt-1 text-xs text-muted-foreground">{product.variants.length} variantes</p> : null}
          </div>
        </div>
        <div className="mx-3 flex flex-wrap items-center justify-between gap-2 border-t py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Precio de venta</p>
            <p className="text-base font-bold tabular-nums break-words">{priceLabel}</p>
          </div>
          <p className={cn('rounded-md px-2 py-1 text-xs font-medium', stock <= 0 && !isServiceLikeProduct(product) ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-muted text-foreground')}>
            {isServiceLikeProduct(product) ? 'Servicio' : `Stock: ${stock}`}{product.is_active === false ? ' · Inactivo' : ''}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => props.onProductViewDetails(product)}>Ver detalle</Button>
          <Button type="button" variant="outline" className="min-h-11" aria-label={`Editar ${product.name}`} onClick={() => props.onProductEdit(product)}><Edit className="h-4 w-4" />Editar</Button>
        </div>
      </li>
    })}
  </ul>
}
