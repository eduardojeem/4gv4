'use client'

import { ArrowLeft, Edit, Trash2, Share2, Copy, Check, Star, StarOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Product } from '@/types/products'

interface ProductDetailHeaderProps {
  product: Product
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onShare: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

export function ProductDetailHeader({
  product,
  onBack,
  onEdit,
  onDelete,
  onShare,
  isFavorite = false,
  onToggleFavorite
}: ProductDetailHeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleCopySKU = () => {
    navigator.clipboard.writeText(product.sku)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getStockBadge = () => {
    if (product.stock_quantity === 0) {
      return <Badge variant="destructive">Agotado</Badge>
    }
    if (product.stock_quantity <= product.min_stock) {
      return <Badge className="bg-amber-500">Stock Bajo</Badge>
    }
    return <Badge className="bg-green-500">En Stock</Badge>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-b sticky top-0 z-10 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Left Section */}
          <div className="flex items-start gap-4 flex-1">
            <Button
              variant="outline"
              size="icon"
              onClick={onBack}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
                  {product.name}
                </h1>
                {getStockBadge()}
                {product.featured && (
                  <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                    Destacado
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">SKU:</span>
                  <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                    {product.sku}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopySKU}
                    className="h-6 w-6 p-0"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>

                {product.brand && (
                  <Badge variant="outline" className="text-xs">
                    {product.brand}
                  </Badge>
                )}

                {product.category && (
                  <Badge variant="outline" className="text-xs">
                    {product.category.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {onToggleFavorite && (
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleFavorite}
                className="hover:bg-yellow-50"
              >
                {isFavorite ? (
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onShare}
              className="hidden sm:flex"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Compartir
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
