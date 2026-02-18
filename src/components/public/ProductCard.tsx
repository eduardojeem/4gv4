'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Package, ArrowRight } from 'lucide-react'
import { PublicProduct } from '@/types/public'
import { Badge } from '@/components/ui/badge'
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
  const discountPercent = hasDiscount
    ? Math.round(
        ((product.sale_price - product.wholesale_price!) / product.sale_price) *
          100
      )
    : 0

  return (
    <Link
      href={`/productos/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:shadow-lg hover:border-primary/30"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.featured && (
            <Badge className="bg-foreground text-background border-0 text-xs font-medium shadow-sm">
              Destacado
            </Badge>
          )}
          {hasDiscount && (
            <Badge className="bg-primary text-primary-foreground border-0 text-xs font-medium shadow-sm">
              -{discountPercent}%
            </Badge>
          )}
        </div>

        {!isInStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <span className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background">
              Agotado
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4 gap-2">
        {/* Brand + Category row */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {product.brand && (
            <span className="font-medium uppercase tracking-wider">
              {product.brand}
            </span>
          )}
          {product.brand && product.category && (
            <span className="text-border">{'/'}</span>
          )}
          {product.category && <span>{product.category.name}</span>}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {/* Price + CTA */}
        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <p className="text-lg font-bold text-foreground">
              {formatPrice(displayPrice)}
            </p>
            {hasDiscount && (
              <p className="text-xs text-muted-foreground line-through">
                {formatPrice(product.sale_price)}
              </p>
            )}
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}
