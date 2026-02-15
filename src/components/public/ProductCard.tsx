'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Package } from 'lucide-react'
import { PublicProduct } from '@/types/public'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'

interface ProductCardProps {
  product: PublicProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth()
  
  // Determinar si el usuario es mayorista
  const isWholesale = user?.role === 'mayorista' || user?.role === 'client_mayorista'
  
  // Determinar qué precio mostrar
  const displayPrice = isWholesale && product.wholesale_price 
    ? product.wholesale_price 
    : product.sale_price
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0
    }).format(price)
  }

  const isInStock = product.stock_quantity > 0
  const imageSrc = typeof product.image === 'string' 
    ? product.image.replace(/\)+$/, '').trim()
    : null

  return (
    <Link
      href={`/productos/${product.id}`}
      className="group block overflow-hidden rounded-lg border bg-card transition-all hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
        
        {/* Featured badge */}
        {product.featured && (
          <Badge className="absolute left-2 top-2" variant="default">
            Destacado
          </Badge>
        )}

        {/* Stock badge */}
        <Badge
          className="absolute right-2 top-2"
          variant={isInStock ? 'secondary' : 'destructive'}
        >
          {isInStock ? 'En stock' : 'Agotado'}
        </Badge>
        
        {/* Wholesale badge */}
        {isWholesale && product.wholesale_price && (
          <Badge className="absolute left-2 bottom-2 bg-gradient-to-r from-purple-600 to-blue-600">
            Precio Mayorista
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        {/* Brand */}
        {product.brand && (
          <p className="text-xs text-muted-foreground">{product.brand}</p>
        )}
        
        {/* Name */}
        <h3 className="mt-1 font-semibold line-clamp-2 group-hover:text-primary">
          {product.name}
        </h3>

        {/* Category */}
        {product.category && (
          <p className="mt-1 text-xs text-muted-foreground">
            {product.category.name}
          </p>
        )}

        {/* Price */}
        <div className="mt-3">
          <p className="text-lg font-bold text-primary">
            {formatPrice(displayPrice)}
          </p>
          {isWholesale && product.wholesale_price && product.wholesale_price < product.sale_price && (
            <p className="text-xs text-muted-foreground line-through">
              {formatPrice(product.sale_price)}
            </p>
          )}
        </div>

        {/* SKU */}
        <p className="mt-1 text-xs text-muted-foreground">
          SKU: {product.sku}
        </p>
      </div>
    </Link>
  )
}
