import React from 'react'
import { MoreVertical, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/currency'
import { isServiceLikeProduct } from '@/lib/products-dashboard-utils'
import type { ProductGridProps } from './ProductGrid'
import { AppImage } from '@/components/ui/app-image'

function ProductThumbnail({ src }: { src?: string }) {
  const [failed, setFailed] = React.useState(false)
  return src && !failed ? <AppImage src={src} alt="" width={48} height={48} sizes="48px" className="h-12 w-12 shrink-0 rounded-lg object-contain" onError={() => setFailed(true)} /> : <Package className="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden="true" />
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
      return <li key={product.id} className="flex min-w-0 gap-2 rounded-xl border p-3">
        <label className="flex min-h-11 w-11 shrink-0 items-center justify-center self-start">
          <input type="checkbox" className="h-5 w-5 accent-blue-600" aria-label={`Seleccionar ${product.name}`} checked={props.selectedProductIds.includes(product.id)} onChange={() => props.onProductSelect(product.id)} />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ProductThumbnail key={product.images?.[0] || product.image} src={product.images?.[0] || product.image} />
            <button type="button" className="min-h-11 min-w-0 text-left font-semibold break-words" onClick={() => props.onProductViewDetails(product)}>{product.name}</button>
          </div>
          <p className="truncate text-xs text-muted-foreground">{product.sku || 'Sin SKU'}</p>
          <p className="mt-1 font-semibold">{priceLabel}</p>
          <p className="text-sm">{isServiceLikeProduct(product) ? 'Servicio' : `Stock: ${stock}`}{product.is_active === false ? ' · Inactivo' : ''}</p>
        </div>
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
      </li>
    })}
  </ul>
}
