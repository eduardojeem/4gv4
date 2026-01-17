'use client'

import { Eye, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { RecentProduct } from '../lib/search-history'

interface RecentProductsProps {
  products: RecentProduct[]
  onProductClick?: (productId: string) => void
  className?: string
}

export function RecentProducts({
  products,
  onProductClick,
  className
}: RecentProductsProps) {
  if (products.length === 0) return null

  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    
    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `Hace ${minutes}m`
    if (hours < 24) return `Hace ${hours}h`
    return 'Hace más de 1 día'
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-green-600" />
          Productos Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {products.slice(0, 6).map((product) => (
            <button
              key={product.product_id}
              onClick={() => onProductClick?.(product.product_id)}
              className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate mb-1">
                  {product.product_name}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(product.last_viewed)}</span>
                  {product.view_count > 1 && (
                    <Badge variant="secondary" className="text-xs">
                      {product.view_count}x visto
                    </Badge>
                  )}
                </div>
              </div>
              
              {onProductClick && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-2 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onProductClick(product.product_id)
                  }}
                >
                  Ver
                </Button>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
