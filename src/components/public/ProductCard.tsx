'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Package, ShoppingCart } from 'lucide-react'
import { PublicProduct } from '@/types/public'
import { useAuth } from '@/contexts/auth-context'
import { formatPrice, cleanImageUrl } from '@/lib/utils'

interface ProductCardProps {
  product: PublicProduct
  priority?: boolean
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { user } = useAuth()

  const isWholesale =
    user?.user_metadata?.customer_type === 'mayorista' ||
    user?.user_metadata?.customer_type === 'client_mayorista'

  const displayPrice =
    isWholesale && product.wholesale_price
      ? product.wholesale_price
      : product.sale_price

  const isInStock = product.stock_quantity > 0
  const imageSrc = cleanImageUrl(product.image)

  const hasDiscount =
    isWholesale &&
    product.wholesale_price != null &&
    product.wholesale_price < product.sale_price

  return (
    <Link
      href={`/productos/${product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-200 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40"
    >
      {/* Cart icon on hover */}
      <div className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 scale-75">
        <ShoppingCart className="h-4 w-4" />
      </div>

      {/* Brand label */}
      {product.brand && (
        <div className="flex justify-end px-4 pt-3">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            {product.brand}
          </span>
        </div>
      )}

      {/* Product image */}
      <div className="relative mx-auto flex aspect-square w-full max-w-[200px] items-center justify-center p-4">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <Package className="h-20 w-20 text-muted-foreground/20" />
        )}

        {!isInStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px] rounded-lg">
            <span className="rounded-full bg-destructive/90 px-3 py-1 text-xs font-semibold text-destructive-foreground">
              Agotado
            </span>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="mx-4 border-t border-border/40" />

      {/* Product info */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3 gap-1.5">
        {/* SKU code */}
        <p className="text-xs text-muted-foreground">
          {'Cod: '}{product.sku}
        </p>

        {/* Product name */}
        <h3 className="text-sm font-medium leading-snug text-foreground line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        {/* Price */}
        <div className="mt-auto pt-2">
          <p className="text-xl font-bold text-primary">
            {formatPrice(displayPrice)}
          </p>
          {hasDiscount && (
            <p className="text-xs text-muted-foreground line-through">
              {formatPrice(product.sale_price)}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            IVA incluido
          </p>
        </div>
      </div>
    </Link>
  )
}
