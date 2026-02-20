'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Package, ShoppingCart } from 'lucide-react'
import { PublicProduct } from '@/types/public'
import { useAuth } from '@/contexts/auth-context'
import { formatPrice } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'

interface ProductCardProps {
  product: PublicProduct
  priority?: boolean
  isWholesale?: boolean
}

export function ProductCard(props: ProductCardProps) {
  const { product, priority = false } = props
  const { user } = useAuth()
  const [imageError, setImageError] = useState(false)

  // Use prop if provided (Server Component), otherwise fall back to client auth
  const isWholesale = props.isWholesale ?? (
    user?.user_metadata?.customer_type === 'mayorista' ||
    user?.user_metadata?.customer_type === 'client_mayorista'
  )

  const displayPrice =
    isWholesale && product.wholesale_price
      ? product.wholesale_price
      : product.sale_price

  const isInStock = product.stock_quantity > 0
  const imageSrc = resolveProductImageUrl(product.image)

  // Debug: Log image info in development
  if (process.env.NODE_ENV === 'development' && !imageError) {
    console.log('Product:', product.name, 'Image:', product.image, 'Resolved:', imageSrc)
  }

  const hasDiscount =
    isWholesale &&
    product.wholesale_price != null &&
    product.wholesale_price < product.sale_price

  return (
    <Link
      href={`/productos/${product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40 hover:-translate-y-1"
    >
      {/* Cart icon on hover */}
      <div className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 scale-75">
        <ShoppingCart className="h-4.5 w-4.5" />
      </div>

      {/* Brand label */}
      {product.brand && (
        <div className="absolute left-3 top-3 z-10">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary backdrop-blur-sm">
            {product.brand}
          </span>
        </div>
      )}

      {/* Product image - Mejorado */}
      <div className="relative w-full bg-gradient-to-br from-muted/30 via-muted/10 to-muted/30 overflow-hidden">
        <div className="relative aspect-[4/3] w-full">
          {imageSrc && !imageError ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="relative w-full h-full">
                <Image
                  src={imageSrc}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-contain transition-all duration-500 group-hover:scale-110"
                  priority={priority}
                  quality={80}
                  onError={(e) => {
                    // console.error('Image failed to load:', imageSrc, 'for product:', product.name)
                    setImageError(true)
                  }}
                  unoptimized={imageSrc.startsWith('data:') || imageSrc === '/placeholder-product.svg'}
                />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-muted/40">
                <Package className="h-12 w-12 text-muted-foreground/40" />
              </div>
            </div>
          )}

          {!isInStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <span className="rounded-full bg-destructive px-4 py-1.5 text-xs font-semibold text-destructive-foreground shadow-lg">
                Agotado
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-border/40" />

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
