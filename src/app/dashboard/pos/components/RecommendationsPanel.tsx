'use client'

import { Sparkles, TrendingUp, Users, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProductRecommendation } from '../lib/recommendation-engine'

interface RecommendationsPanelProps {
  recommendations: ProductRecommendation[]
  onAddToCart?: (productId: string) => void
  className?: string
}

export function RecommendationsPanel({
  recommendations,
  onAddToCart,
  className
}: RecommendationsPanelProps) {
  if (recommendations.length === 0) return null

  const getReasonIcon = (reason: string) => {
    if (reason.includes('frecuente')) return Users
    if (reason.includes('categoría')) return Tag
    return TrendingUp
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 border-green-200'
    if (confidence >= 0.6) return 'bg-blue-100 text-blue-800 border-blue-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-purple-600" />
          Sugerencias Inteligentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.slice(0, 5).map((rec) => {
            const ReasonIcon = getReasonIcon(rec.reason)
            
            return (
              <div
                key={rec.product_id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ReasonIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="font-medium text-sm truncate">
                      {rec.product_name}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {rec.reason}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn('text-xs', getConfidenceColor(rec.confidence))}
                    >
                      {(rec.confidence * 100).toFixed(0)}% confianza
                    </Badge>
                    {rec.price && (
                      <span className="text-xs font-medium text-green-600">
                        ${rec.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                
                {onAddToCart && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAddToCart(rec.product_id)}
                    className="ml-3 flex-shrink-0"
                  >
                    Agregar
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {recommendations.length > 5 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            +{recommendations.length - 5} sugerencias más
          </p>
        )}
      </CardContent>
    </Card>
  )
}
