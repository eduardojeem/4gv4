'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Package, ShoppingCart, Eye } from 'lucide-react'
import { PublicProduct } from '@/types/public'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { formatPrice, cleanImageUrl } from '@/lib/utils'

interface ProductCardProps {
  product: PublicProduct
  priority?: boolean
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const { user } = useAuth()
  
  // Determinar si el usuario es mayorista basado en metadata
  const isWholesale = user?.user_metadata?.customer_type === 'mayorista' || 
                      user?.user_metadata?.customer_type === 'client_mayorista'
  
  // Determinar qué precio mostrar
  const displayPrice = isWholesale && product.wholesale_price 
    ? product.wholesale_price 
    : product.sale_price
  
  const isInStock = product.stock_quantity > 0
  const imageSrc = cleanImageUrl(product.image)
  
  // Calcular descuento si es mayorista
  const hasDiscount = isWholesale && product.wholesale_price && product.wholesale_price < product.sale_price
  const discountPercent = hasDiscount 
    ? Math.round(((product.sale_price - product.wholesale_price!) / product.sale_price) * 100)
    : 0

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/50">
      <Link href={`/productos/${product.id}`} className="block">
        {/* Image Container */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted to-muted/50">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              priority={priority}
              placeholder="blur"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted via-muted/80 to-muted/50">
              <Package className="h-20 w-20 text-muted-foreground/40" />
            </div>
          )}
          
          {/* Overlay on Hover */}
          <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center">
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="gap-2">
                <Eye className="h-4 w-4" />
                Ver detalles
              </Button>
            </div>
          </div>
          
          {/* Top Badges */}
          <div className="absolute left-3 top-3 flex flex-col gap-2">
            {product.featured && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 border-0 shadow-lg">
                ⭐ Destacado
              </Badge>
            )}
            {hasDiscount && (
              <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 border-0 shadow-lg">
                -{discountPercent}%
              </Badge>
            )}
          </div>

          {/* Stock Badge */}
          <Badge
            className={`absolute right-3 top-3 shadow-lg ${
              isInStock 
                ? 'bg-green-600 hover:bg-green-700 border-0' 
                : 'bg-red-600 hover:bg-red-700 border-0'
            }`}
          >
            {isInStock ? `${product.stock_quantity} disponibles` : 'Agotado'}
          </Badge>
          
          {/* Wholesale Badge */}
          {isWholesale && product.wholesale_price && (
            <Badge className="absolute left-3 bottom-3 bg-gradient-to-r from-purple-600 to-blue-600 border-0 shadow-lg">
              💼 Precio Mayorista
            </Badge>
          )}
        </div>

        {/* Info Section */}
        <div className="p-4 space-y-3">
          {/* Brand & Category */}
          <div className="flex items-center justify-between text-xs">
            {product.brand && (
              <span className="font-medium text-muted-foreground uppercase tracking-wide">
                {product.brand}
              </span>
            )}
            {product.category && (
              <Badge variant="outline" className="text-xs">
                {product.category.name}
              </Badge>
            )}
          </div>
          
          {/* Name */}
          <h3 className="font-semibold text-base line-clamp-2 min-h-[3rem] group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          {/* Price Section */}
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-primary">
                {formatPrice(displayPrice)}
              </p>
              {hasDiscount && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.sale_price)}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              por {product.unit_measure}
            </p>
          </div>

          {/* SKU */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              SKU: <span className="font-mono">{product.sku}</span>
            </p>
          </div>
        </div>
      </Link>
    </div>
  )
}
